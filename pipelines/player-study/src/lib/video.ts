// yt-dlp / ffmpeg / ffprobe を叩く IO 層。パーサ（duration）は純関数として分離しテスト対象にする。
// review-match/src/lib/video.ts の流儀を踏襲。yt-dlp/ffmpeg/ffprobe は PATH 上（/opt/homebrew/bin）想定。
import { spawn } from "node:child_process";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  ANCHOR_THUMB_H,
  ANCHOR_THUMB_W,
  DEDUP_THUMB_SIZE,
  MAX_HEIGHT,
  SCAN_FPS,
  type AnchorRoi,
} from "../config.js";
import { sliceBuffers } from "./frames.js";

// ---------- 純パーサ ----------

/** ffprobe / yt-dlp の数値出力から秒数を得る。取れなければ 0。 */
export function parseDuration(stdout: string): number {
  const line = stdout
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^\d/.test(l));
  if (!line) return 0;
  const n = Number.parseFloat(line);
  return Number.isFinite(n) ? n : 0;
}

// ---------- プロセス実行 ----------

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(cmd: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => reject(new Error(`${cmd} 実行失敗: ${e.message}`)));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

function runBinary(
  cmd: string,
  args: string[],
): Promise<{ code: number; stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => reject(new Error(`${cmd} 実行失敗: ${e.message}`)));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout: Buffer.concat(chunks), stderr }));
  });
}

// ---------- yt-dlp / ffprobe ----------

/** フル動画を 480p 以下で DL（video.mp4）。 */
export async function downloadFull(videoUrl: string, outPath: string): Promise<void> {
  const r = await run("yt-dlp", [
    videoUrl,
    "-f",
    `bv*[height<=${MAX_HEIGHT}]+ba/b[height<=${MAX_HEIGHT}]/best`,
    "--merge-output-format",
    "mp4",
    // web(default)クライアントのDASH URLがSABR限定配信で403になることがある（2026-07実測）。
    // androidクライアントをフォールバックに加えるとURL付きformatが得られる。
    "--extractor-args",
    "youtube:player_client=default,android",
    "-o",
    outPath,
    "--no-warnings",
    "-q",
  ]);
  if (r.code !== 0) {
    throw new Error(`yt-dlp フルDL失敗: ${r.stderr.slice(0, 800) || r.stdout.slice(0, 400)}`);
  }
}

/** ローカル動画ファイルの長さ（秒）を ffprobe で取得。 */
export async function getDurationFromFile(videoPath: string): Promise<number> {
  const r = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    videoPath,
  ]);
  return parseDuration(r.stdout);
}

// ---------- スキャンフレーム抽出（1fps）----------

export interface ScanFrame {
  path: string; // raw_%05d.jpg の絶対パス
  t_sec: number; // 実時刻（1fps なので index-1 秒）
}

/**
 * 動画から SCAN_FPS（=1）でフレームを抽出し raw_%05d.jpg にする。
 * 返り値の t_sec は raw ファイルの並び順に一致（k番目→(k-1)/fps 秒）。
 */
export async function extractScanFrames(videoPath: string, rawDir: string): Promise<ScanFrame[]> {
  await mkdir(rawDir, { recursive: true });
  const r = await run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-nostats",
    "-loglevel",
    "error",
    "-i",
    videoPath,
    "-vf",
    `fps=${SCAN_FPS}`,
    "-q:v",
    "3",
    join(rawDir, "raw_%05d.jpg"),
  ]);
  const files = (await readdir(rawDir))
    .filter((f) => /^raw_\d+\.jpg$/.test(f))
    .sort();
  if (files.length === 0) {
    throw new Error(`スキャンフレーム抽出結果が空: ${r.stderr.slice(0, 600)}`);
  }
  return files.map((f, i) => ({ path: join(rawDir, f), t_sec: Math.round((i / SCAN_FPS) * 100) / 100 }));
}

/**
 * raw_%05d.jpg 連番の指定ROI（ストックアイコン行などの小領域）を 32x8 RGB へ縮小し、
 * 768byte/枚のサムネイル列を返す（アンカー検出 anchor.ts 用）。並びは raw 昇順。
 * ROIをストックアイコンの極小領域に絞る理由は config.ts の実測メモ参照。
 */
export async function hudRoiThumbnails(
  rawDir: string,
  expectedCount: number,
  roi: AnchorRoi,
): Promise<Uint8Array[]> {
  if (expectedCount === 0) return [];
  const w = roi.x1 - roi.x0;
  const h = roi.y1 - roi.y0;
  const vf = `crop=iw*${w}:ih*${h}:iw*${roi.x0}:ih*${roi.y0},scale=${ANCHOR_THUMB_W}:${ANCHOR_THUMB_H}`;
  const r = await runBinary("ffmpeg", [
    "-y",
    "-hide_banner",
    "-nostats",
    "-loglevel",
    "error",
    "-start_number",
    "1",
    "-i",
    join(rawDir, "raw_%05d.jpg"),
    "-vf",
    vf,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-",
  ]);
  const size = ANCHOR_THUMB_W * ANCHOR_THUMB_H * 3;
  const thumbs = sliceBuffers(r.stdout, size);
  if (thumbs.length !== expectedCount) {
    throw new Error(
      `HUD帯サムネイル数(${thumbs.length}) が raw フレーム数(${expectedCount}) と不一致: ${r.stderr.slice(0, 400)}`,
    );
  }
  return thumbs;
}

/**
 * raw_%05d.jpg 連番を 16x16 RGB(768byte/枚) サムネイルへ落とす（dedup 用）。並びは raw 昇順。
 */
export async function scanThumbnails16(rawDir: string, expectedCount: number): Promise<Uint8Array[]> {
  if (expectedCount === 0) return [];
  const r = await runBinary("ffmpeg", [
    "-y",
    "-hide_banner",
    "-nostats",
    "-loglevel",
    "error",
    "-start_number",
    "1",
    "-i",
    join(rawDir, "raw_%05d.jpg"),
    "-vf",
    `scale=${DEDUP_THUMB_SIZE}:${DEDUP_THUMB_SIZE}`,
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-",
  ]);
  const size = DEDUP_THUMB_SIZE * DEDUP_THUMB_SIZE * 3;
  const thumbs = sliceBuffers(r.stdout, size);
  if (thumbs.length !== expectedCount) {
    throw new Error(
      `16x16サムネイル数(${thumbs.length}) が raw フレーム数(${expectedCount}) と不一致: ${r.stderr.slice(0, 400)}`,
    );
  }
  return thumbs;
}

/**
 * 採用フレーム（絶対パス配列、1グループ=最大 rows*cols 枚）を tile 合成して outPath に1枚書く。
 * 端数グループも EOF フラッシュで1枚出力される。cellWidth へスケール（アスペクト維持）してから tile。
 */
export async function composeGrid(
  framePaths: string[],
  outPath: string,
  cols: number,
  rows: number,
  cellWidth: number,
  tmpDir: string,
): Promise<void> {
  await mkdir(tmpDir, { recursive: true });
  // 決定論的な順序で連番へコピー（glob 順の不定性を避ける）
  for (let i = 0; i < framePaths.length; i++) {
    await copyFile(framePaths[i], join(tmpDir, `g_${String(i + 1).padStart(3, "0")}.jpg`));
  }
  const r = await run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-nostats",
    "-loglevel",
    "error",
    "-start_number",
    "1",
    "-i",
    join(tmpDir, "g_%03d.jpg"),
    "-vf",
    `scale=${cellWidth}:-1,tile=${cols}x${rows}`,
    "-frames:v",
    "1",
    outPath,
  ]);
  await rm(tmpDir, { recursive: true, force: true });
  if (r.code !== 0) {
    throw new Error(`グリッド合成失敗 (${outPath}): ${r.stderr.slice(0, 500)}`);
  }
}

// ---------- 密バースト抽出 ----------

export interface BurstFrame {
  path: string; // frame_%03d.jpg 絶対パス
  index: number; // 1始まり
  t_sec: number; // 実時刻 = start + (index-1)/fps
}

/**
 * [startSec, startSec+spanSec] を fps で密抽出し frame_%03d.jpg にする（実時刻保持）。
 * 返り値は frame 昇順、各 t_sec 付き。
 */
export async function extractBurst(
  videoPath: string,
  startSec: number,
  spanSec: number,
  fps: number,
  outDir: string,
): Promise<BurstFrame[]> {
  await mkdir(outDir, { recursive: true });
  const r = await run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-nostats",
    "-loglevel",
    "error",
    "-ss",
    String(startSec),
    "-i",
    videoPath,
    "-t",
    String(spanSec),
    "-vf",
    `fps=${fps}`,
    "-q:v",
    "2",
    join(outDir, "frame_%03d.jpg"),
  ]);
  const files = (await readdir(outDir))
    .filter((f) => /^frame_\d+\.jpg$/.test(f))
    .sort();
  if (files.length === 0) {
    throw new Error(`バースト抽出結果が空 (t=${startSec}s): ${r.stderr.slice(0, 500)}`);
  }
  return files.map((f, i) => ({
    path: join(outDir, f),
    index: i + 1,
    t_sec: Math.round((startSec + i / fps) * 100) / 100,
  }));
}
