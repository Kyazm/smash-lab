// yt-dlp / ffmpeg / ffprobe を叩く IO 層。パーサ（duration / fps / showinfo pts_time）は
// 純関数として分離しテスト対象にする。crv core.py の extract_frames 手法を移植。
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { FRAME_WIDTH, SCENE_THRESHOLD } from "../config.js";

// ---------- 純パーサ ----------

/** `yt-dlp --print duration` / ffprobe の出力から秒数を得る。取れなければ 0。 */
export function parseDuration(stdout: string): number {
  const line = stdout
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^\d/.test(l));
  if (!line) return 0;
  const n = Number.parseFloat(line);
  return Number.isFinite(n) ? n : 0;
}

/** ffprobe avg_frame_rate（"30000/1001" 等）を fps に変換。取れなければ 25。 */
export function parseFps(stdout: string): number {
  const s = stdout.trim();
  const m = s.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (m) {
    const num = Number.parseFloat(m[1]);
    const den = Number.parseFloat(m[2]);
    if (den !== 0 && Number.isFinite(num) && Number.isFinite(den)) return num / den;
    return 25;
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 25;
}

/**
 * ffmpeg showinfo が stderr に吐く各フレームの `pts_time:` を出現順に配列で返す（純関数）。
 * select フィルタ通過フレームと1対1で並ぶ。実時刻 = セグメント開始 + pts_time。
 */
export function parseShowinfoPtsTimes(stderr: string): number[] {
  const out: number[] = [];
  const re = /pts_time:\s*(\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stderr)) !== null) {
    out.push(Number.parseFloat(m[1]));
  }
  return out;
}

/** EVERY_N = max(1, round(fps * fpsFloorSec))。密度フロア。 */
export function computeEveryN(fps: number, fpsFloorSec: number): number {
  return Math.max(1, Math.round(fps * fpsFloorSec));
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

function runBinary(cmd: string, args: string[]): Promise<{ code: number; stdout: Buffer; stderr: string }> {
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

// ---------- yt-dlp / ffprobe / ffmpeg ----------

/** 動画長を取得（yt-dlp --print duration）。 */
export async function getDuration(url: string): Promise<number> {
  const r = await run("yt-dlp", ["--print", "duration", "--no-warnings", "-q", url]);
  if (r.code !== 0 && !r.stdout.trim()) {
    throw new Error(`yt-dlp duration 取得失敗: ${r.stderr.slice(0, 400)}`);
  }
  return parseDuration(r.stdout);
}

/** 区間ダウンロード（`*S-E`、キーフレーム強制）。outPath は .mp4 で作られる。 */
export async function downloadSection(
  url: string,
  startSec: number,
  endSec: number,
  outPath: string,
): Promise<void> {
  const section = `*${startSec}-${endSec}`;
  const r = await run("yt-dlp", [
    url,
    "--download-sections",
    section,
    "--force-keyframes-at-cuts",
    "-o",
    outPath,
    "--merge-output-format",
    "mp4",
    "--no-warnings",
    "-q",
  ]);
  if (r.code !== 0) {
    throw new Error(`yt-dlp 区間DL失敗 (${section}): ${r.stderr.slice(0, 600)}`);
  }
}

/** 動画の平均 fps を取得（ffprobe avg_frame_rate）。 */
export async function getFps(videoPath: string): Promise<number> {
  const r = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=avg_frame_rate",
    "-of",
    "default=nw=1:nk=1",
    videoPath,
  ]);
  return parseFps(r.stdout);
}

export interface ExtractedFrame {
  path: string; // raw_%05d.jpg の絶対パス
  ptsTime: number; // セグメント内相対時刻（秒）
}

/**
 * 場面変化 + 密度フロアでフレーム抽出し、showinfo の pts_time と raw ファイルを対応づける。
 * ffmpeg -vf "select='gt(scene,TH)+not(mod(n,EVERY_N))',showinfo,scale=W:-1" -vsync vfr raw_%05d.jpg
 * 返り値の ptsTime は raw ファイルの並び順に一致。pts が取れないフレームは
 * 前後から線形補間せず、セグメント長で均等近似する（枚数不一致時のみ）。
 */
export async function extractFrames(
  videoPath: string,
  framesDir: string,
  everyN: number,
  segmentDurationSec: number,
): Promise<ExtractedFrame[]> {
  const vf =
    `select='gt(scene,${SCENE_THRESHOLD})+not(mod(n,${everyN}))',showinfo,scale=${FRAME_WIDTH}:-1`;
  const r = await run("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    videoPath,
    "-vf",
    vf,
    "-vsync",
    "vfr",
    join(framesDir, "raw_%05d.jpg"),
  ]);
  // ffmpeg は 0 以外でも一部フレームを書けることがあるため、ファイル存在で判定する
  const files = (await readdir(framesDir))
    .filter((f) => /^raw_\d+\.jpg$/.test(f))
    .sort()
    .map((f) => join(framesDir, f));
  if (files.length === 0) {
    throw new Error(`フレーム抽出結果が空: ${r.stderr.slice(0, 600)}`);
  }
  const ptsTimes = parseShowinfoPtsTimes(r.stderr);

  return files.map((path, i) => {
    let pts: number;
    if (i < ptsTimes.length) {
      pts = ptsTimes[i];
    } else {
      // 稀な枚数不一致時のフォールバック: セグメント内で均等近似
      pts = files.length > 1 ? (i / (files.length - 1)) * segmentDurationSec : 0;
    }
    return { path, ptsTime: pts };
  });
}

/** Buffer を 768byte(16x16 RGB) 単位に分割して Uint8Array[] にする（純関数）。 */
export function sliceThumbnails(buf: Uint8Array): Uint8Array[] {
  const size = 16 * 16 * 3; // 768
  const count = Math.floor(buf.length / size);
  const thumbs: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    thumbs.push(buf.subarray(i * size, (i + 1) * size));
  }
  return thumbs;
}

/**
 * framesDir の raw_%05d.jpg 連番を 16x16 RGB(768byte/枚) サムネイルへ落とす（dedup 用）。
 * `ffmpeg -i raw_%05d.jpg -vf scale=16:16 -f rawvideo -pix_fmt rgb24 -` の stdout を分割。
 * 返り値は raw ファイルの連番昇順に一致し、extractFrames の返り値と同順。
 * @param expectedCount 期待枚数（raw ファイル数）。不一致なら例外。
 */
export async function thumbnailSequence(
  framesDir: string,
  expectedCount: number,
): Promise<Uint8Array[]> {
  if (expectedCount === 0) return [];
  const r = await runBinary("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-loglevel",
    "error",
    "-start_number",
    "1",
    "-i",
    join(framesDir, "raw_%05d.jpg"),
    "-vf",
    "scale=16:16",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-",
  ]);
  const thumbs = sliceThumbnails(r.stdout);
  if (thumbs.length !== expectedCount) {
    throw new Error(
      `サムネイル生成数(${thumbs.length}) が raw フレーム数(${expectedCount}) と不一致: ${r.stderr.slice(0, 400)}`,
    );
  }
  return thumbs;
}
