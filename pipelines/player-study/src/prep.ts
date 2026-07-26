// prep: 動画を claim してフルDL → 1fpsスキャン → ストックアンカー検出 → スキャングリッド合成 →
// MANIFEST.json を生成する（決定論・LLMなし）。
//   npm run prep -- <video_id>            — 明示 video_id（DB接続）
//   npm run prep -- --next                — status=cataloged の最古1件を処理
//   npm run prep -- <video_id> --local [--player P --char C --title "…" --url URL]
//                                         — DBなし。MANIFEST をローカル生成（監査用に workdir 残置）
import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CELL_WIDTH,
  GRID_COLS,
  GRID_ROWS,
  MAIN_REPO_ENV_PATH,
  WORK_ROOT,
} from "./config.js";
import { coalesceAnchors, detectStockAnchors } from "./lib/anchor.js";
import { normalizeChar } from "./lib/char-normalize.js";
import { dedupFrames } from "./lib/frames.js";
import { assignGridCells } from "./lib/grid.js";
import { loadEnvFileOptional } from "./lib/load-env.js";
import { buildManifest, type ManifestGrid } from "./lib/manifest.js";
import { parseMatchTitle, resolveMatchup } from "./lib/title-parse.js";
import {
  failVideo,
  fetchOldestCataloged,
  fetchStudyVideo,
  markPrepped,
  type StudyVideoRow,
  type SupabaseConfig,
} from "./lib/supabase-client.js";
import {
  composeGrid,
  downloadFull,
  extractScanFrames,
  getDurationFromFile,
  hudRoiThumbnails,
  scanThumbnails16,
} from "./lib/video.js";
import { ANCHOR_ENABLED, ANCHOR_ROIS } from "./config.js";

interface PrepArgs {
  videoId: string | null;
  next: boolean;
  local: boolean;
  player: string | null;
  char: string | null;
  title: string | null;
  url: string | null;
}

function parseArgs(argv: string[]): PrepArgs {
  function valueOf(flag: string): string | null {
    const i = argv.indexOf(flag);
    if (i === -1) return null;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${flag} に値を指定してください`);
    return v;
  }
  const next = argv.includes("--next");
  const local = argv.includes("--local");
  const positional = argv.filter((a) => !a.startsWith("--"));
  // フラグ値として消費された位置引数を除外（--player Marss 等の値を video_id と誤認しないため）
  const flagValues = new Set<string>();
  for (const f of ["--player", "--char", "--title", "--url"]) {
    const i = argv.indexOf(f);
    if (i !== -1 && argv[i + 1]) flagValues.add(argv[i + 1]);
  }
  const videoId = positional.find((p) => !flagValues.has(p)) ?? null;
  return {
    videoId: next ? null : videoId,
    next,
    local,
    player: valueOf("--player"),
    char: valueOf("--char"),
    title: valueOf("--title"),
    url: valueOf("--url"),
  };
}

interface PrepMeta {
  title: string;
  studied_player: string | null;
  studied_char: string | null;
  opp_chars_hint: string[];
  needs_review: boolean;
}

function metaFromRow(row: StudyVideoRow): PrepMeta {
  return {
    title: row.title ?? "",
    studied_player: row.studied_player,
    studied_char: row.studied_char,
    opp_chars_hint: row.opp_chars_hint ?? [],
    needs_review: row.needs_review ?? false,
  };
}

function metaFromFlags(args: PrepArgs): PrepMeta {
  const title = args.title ?? "";
  const player = args.player;
  if (title) {
    const parsed = parseMatchTitle(title);
    const resolved = resolveMatchup(parsed, player ?? "");
    const studiedChar = args.char
      ? normalizeChar(args.char)
      : resolved.studiedCharRaw
        ? normalizeChar(resolved.studiedCharRaw)
        : null;
    return {
      title,
      studied_player: player,
      studied_char: studiedChar,
      opp_chars_hint: resolved.oppCharsHint,
      needs_review: resolved.needsReview || !parsed.ok,
    };
  }
  return {
    title,
    studied_player: player,
    studied_char: args.char ? normalizeChar(args.char) : null,
    opp_chars_hint: [],
    needs_review: false,
  };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function buildWorkspace(
  videoId: string,
  videoUrl: string,
  meta: PrepMeta,
  workdir: string,
): Promise<{ grids: ManifestGrid[]; anchors: number[]; keptCount: number; duration: number }> {
  const videoPath = join(workdir, "video.mp4");
  const rawDir = join(workdir, "_scan_raw");
  const scanDir = join(workdir, "scan");
  await mkdir(scanDir, { recursive: true });

  // 1) フルDL（既に video.mp4 があれば再DLしない = ローカル再実行が速い）
  if (await fileExists(videoPath)) {
    console.log(`[prep] video.mp4 既存 → DLスキップ`);
  } else {
    console.log(`[prep] yt-dlp フルDL(<=480p): ${videoUrl}`);
    await downloadFull(videoUrl, videoPath);
  }
  const duration = await getDurationFromFile(videoPath);
  console.log(`[prep] duration=${duration}s`);

  // 2) 1fps スキャンフレーム抽出
  const scanFrames = await extractScanFrames(videoPath, rawDir);
  console.log(`[prep] スキャンフレーム ${scanFrames.length} 枚（1fps）`);

  // 3) ストック変化アンカー（実験的・既定OFF。カメラパンによる背景変化で分離不能と実測済み、config.ts参照。
  //    KO特定はスキャングリッドのClaude目視に委ねる）
  const rawAnchorSecs: number[] = [];
  if (ANCHOR_ENABLED) {
    for (const roi of ANCHOR_ROIS) {
      const thumbs = await hudRoiThumbnails(rawDir, scanFrames.length, roi);
      rawAnchorSecs.push(...detectStockAnchors(thumbs, { fps: 1 }));
    }
  }
  const anchors = coalesceAnchors(rawAnchorSecs, 2);
  console.log(`[prep] ストックアンカー候補 ${anchors.length} 秒: [${anchors.slice(0, 20).join(", ")}${anchors.length > 20 ? ", …" : ""}]`);

  // 4) スキャンリール: dedup(緩め) → 3x3 グリッド合成
  const thumbs16 = await scanThumbnails16(rawDir, scanFrames.length);
  const keptIdx = dedupFrames(thumbs16); // 既定 ratio=SCAN_DEDUP_RATIO(0.05)
  const keptFrames = keptIdx.map((i) => scanFrames[i]);
  console.log(`[prep] dedup 後 ${keptFrames.length} 枚（元 ${scanFrames.length}）`);

  const grids = assignGridCells(keptFrames.map((f) => f.t_sec), GRID_ROWS, GRID_COLS);
  const perGrid = GRID_ROWS * GRID_COLS;
  const manifestGrids: ManifestGrid[] = [];
  for (const g of grids) {
    const groupPaths = keptFrames
      .slice(g.grid_index * perGrid, g.grid_index * perGrid + perGrid)
      .map((f) => f.path);
    const rel = `scan/grid_${String(g.grid_index + 1).padStart(2, "0")}.jpg`;
    await composeGrid(
      groupPaths,
      join(workdir, rel),
      GRID_COLS,
      GRID_ROWS,
      CELL_WIDTH,
      join(workdir, `_tile_${g.grid_index}`),
    );
    manifestGrids.push({ path: rel, cells: g.cells });
  }
  console.log(`[prep] グリッド ${manifestGrids.length} 枚 → scan/`);

  // 5) MANIFEST 書き出し
  const manifest = buildManifest({
    video_id: videoId,
    title: meta.title,
    duration_sec: duration,
    studied_player: meta.studied_player,
    studied_char: meta.studied_char,
    opp_chars_hint: meta.opp_chars_hint,
    needs_review: meta.needs_review,
    kill_anchors: anchors,
    scan_frame_count: scanFrames.length,
    grids: manifestGrids,
    workdir,
  });
  await writeFile(join(workdir, "MANIFEST.json"), JSON.stringify(manifest, null, 2), "utf-8");

  // 6) 中間フレーム掃除（video.mp4 は zoom で使うので残す。raw スキャンフレームは破棄）
  await rm(rawDir, { recursive: true, force: true });

  return { grids: manifestGrids, anchors, keptCount: keptFrames.length, duration };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // ---- video_id とメタ、DB設定を解決 ----
  let cfg: SupabaseConfig | null = null;
  if (!args.local) {
    const env = await loadEnvFileOptional(MAIN_REPO_ENV_PATH);
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      cfg = { url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY };
    } else if (args.next) {
      throw new Error(`--next は DB が必要ですが ${MAIN_REPO_ENV_PATH} に認証情報がありません`);
    } else {
      console.log("[prep] SUPABASE 未設定 → ローカル動作（--local 相当。DB更新なし）");
    }
  }

  let videoId: string;
  let meta: PrepMeta;
  if (args.next) {
    const row = await fetchOldestCataloged(cfg!);
    if (!row) {
      console.log("[prep] status=cataloged の対象なし。終了。");
      return;
    }
    videoId = row.video_id;
    meta = metaFromRow(row);
    console.log(`[prep] --next claim: ${videoId} (${meta.studied_player}/${meta.studied_char})`);
  } else {
    if (!args.videoId) throw new Error("使い方: prep -- <video_id> | --next [--local …]");
    videoId = args.videoId;
    if (cfg && !args.local) {
      const row = await fetchStudyVideo(cfg, videoId);
      meta = row ? metaFromRow(row) : metaFromFlags(args);
      if (!row) console.log(`[prep] DBに study_videos(${videoId}) 無し → フラグからメタ構築`);
    } else {
      meta = metaFromFlags(args);
    }
  }

  const videoUrl = args.url ?? `https://www.youtube.com/watch?v=${videoId}`;
  const workdir = join(WORK_ROOT, videoId);
  await mkdir(workdir, { recursive: true });

  try {
    const res = await buildWorkspace(videoId, videoUrl, meta, workdir);
    if (cfg && !args.local) {
      await markPrepped(cfg, videoId);
      console.log(`[prep] study_videos(${videoId}) status→prepped`);
    }
    console.log(
      `[prep] 完了: ${videoId} duration=${res.duration}s アンカー ${res.anchors.length} 秒 ` +
        `グリッド ${res.grids.length} 枚（dedup ${res.keptCount} 枚）→ ${workdir}`,
    );
  } catch (e) {
    const msg = (e as Error).message;
    console.error(`[prep] 失敗 (${videoId}): ${msg}`);
    if (cfg && !args.local) {
      await failVideo(cfg, videoId, `prep: ${msg}`).catch(() => {});
      console.error(`[prep] status→error（workdir は残置: ${workdir}）`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
