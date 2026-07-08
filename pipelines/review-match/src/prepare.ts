// prep / dry-run のエントリ。pending をclaimして作業ディレクトリ(フレーム+MANIFEST)を生成する。
//   npm run prep                       — pending 1件claim→処理
//   npm run prep -- --all              — 該当pending全件
//   npm run prep -- --retry            — error 行を対象
//   npm run prep -- --retry-stale      — 1時間超 processing 行を対象
//   npm run dry-run -- --url <URL> --t 93,210[,…]   — DB書込なし。MANIFEST生成まで
// LLM 呼び出しは含まない（ADR-0019 / docs/13）。
import { join } from "node:path";
import {
  MAIN_REPO_ENV_PATH,
  STALE_PROCESSING_MIN,
  WORK_DIR,
} from "./config.js";
import { buildWorkspace } from "./lib/build-workspace.js";
import { loadEnvFile, loadEnvFileOptional } from "./lib/load-env.js";
import { HABIT_TAGS_FALLBACK, type FocusPoint, type HabitTag } from "./lib/manifest.js";
import type { TimestampInput } from "./lib/scenes.js";
import {
  claimReview,
  fetchActiveFocusPoints,
  fetchCharacterName,
  fetchHabitTags,
  fetchReviewsByStatus,
  type ReviewRow,
  type SupabaseConfig,
} from "./lib/supabase-client.js";
import { getDuration } from "./lib/video.js";
import { parseTimestampList, parseVideoId } from "./lib/youtube.js";

interface PrepArgs {
  dryRun: boolean;
  all: boolean;
  retry: boolean;
  retryStale: boolean;
  url: string | null;
  timestamps: number[] | null;
}

function parseArgs(argv: string[]): PrepArgs {
  const dryRun = argv.includes("--dry-run");
  const all = argv.includes("--all");
  const retry = argv.includes("--retry");
  const retryStale = argv.includes("--retry-stale");

  let url: string | null = null;
  const urlIdx = argv.indexOf("--url");
  if (urlIdx !== -1) {
    url = argv[urlIdx + 1] ?? null;
    if (!url || url.startsWith("--")) throw new Error("--url に YouTube URL を指定してください");
  }

  let timestamps: number[] | null = null;
  const tIdx = argv.indexOf("--t");
  if (tIdx !== -1) {
    const raw = argv[tIdx + 1] ?? "";
    if (!raw || raw.startsWith("--")) throw new Error("--t に 93,210 のようにタイムスタンプを指定してください");
    timestamps = parseTimestampList(raw);
  }

  return { dryRun, all, retry, retryStale, url, timestamps };
}

function habitTagsToManifest(rows: Array<{ slug: string; label: string }>): HabitTag[] {
  return rows.map((r) => ({ slug: r.slug, label: r.label }));
}

function timestampsFromReview(row: ReviewRow): TimestampInput[] {
  const arr = Array.isArray(row.requested_timestamps) ? row.requested_timestamps : [];
  return arr
    .filter((t) => typeof t?.t_sec === "number" && Number.isFinite(t.t_sec))
    .map((t) => ({ t_sec: t.t_sec, ...(typeof t.label === "string" ? { label: t.label } : {}) }));
}

function printSummary(reviewId: string, res: Awaited<ReturnType<typeof buildWorkspace>>): void {
  console.log(`[done] review=${reviewId} 総フレーム ${res.totalFrames} 枚 → ${res.manifestPath}`);
  for (const s of res.perScene) {
    if (s.skipped) {
      console.log(`  scene[${s.index}] t=${s.t_sec}s: SKIP (${s.skipped})`);
    } else {
      const sample = s.sampleTSecs.length > 0 ? ` 例tSec=${s.sampleTSecs.join(", ")}` : "";
      console.log(`  scene[${s.index}] t=${s.t_sec}s: ${s.frameCount}枚${sample}`);
    }
  }
}

// ---------------- dry-run ----------------

async function runDryRun(args: PrepArgs): Promise<void> {
  if (!args.url || !args.timestamps) {
    throw new Error("dry-run には --url と --t が必須です");
  }
  const env = await loadEnvFileOptional(MAIN_REPO_ENV_PATH);
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  // habit_tags 語彙: DB read-only 取得。env 未設定なら docs/13 の15語フォールバック。
  let habitTags: HabitTag[];
  if (supabaseUrl && serviceRoleKey) {
    try {
      habitTags = habitTagsToManifest(await fetchHabitTags({ url: supabaseUrl, serviceRoleKey }));
      if (habitTags.length === 0) habitTags = HABIT_TAGS_FALLBACK;
    } catch (e) {
      console.log(`[warn] habit_tags のDB取得に失敗、フォールバック使用: ${(e as Error).message}`);
      habitTags = HABIT_TAGS_FALLBACK;
    }
  } else {
    console.log("[dry-run] SUPABASE 未設定 → habit_tags は docs/13 の15語フォールバックを使用");
    habitTags = HABIT_TAGS_FALLBACK;
  }

  const videoId = parseVideoId(args.url);
  const duration = await getDuration(args.url);
  console.log(`[dry-run] videoId=${videoId} duration=${duration}s timestamps=${args.timestamps.join(",")}`);

  const workDir = join(WORK_DIR, `dry-run-${videoId}`);
  const res = await buildWorkspace({
    review_id: `dry-run-${videoId}`,
    workDir,
    video: { url: args.url, videoId, duration_sec: duration },
    timestamps: args.timestamps.map((t) => ({ t_sec: t })),
    request: {
      opponent_character: { id: null, name: null },
      mode: null,
      result: null,
      memo: null,
    },
    focus_points: [], // dry-run では focus_points 注入なし
    habit_tags: habitTags,
  });
  printSummary(`dry-run-${videoId}`, res);
  console.log(`[dry-run] 作業ディレクトリ: ${workDir}（監査用に残置）`);
}

// ---------------- prep ----------------

async function processReview(cfg: SupabaseConfig, claimed: ReviewRow): Promise<void> {
  const reviewId = claimed.id;
  const match = claimed.match;
  if (!match) throw new Error(`review=${reviewId}: matches の埋め込みが取得できません`);
  if (!match.video_url) throw new Error(`review=${reviewId}: matches.video_url が空です`);

  const [opponentName, focusRows, habitRows] = await Promise.all([
    match.opponent_character_id
      ? fetchCharacterName(cfg, match.opponent_character_id)
      : Promise.resolve(null),
    fetchActiveFocusPoints(cfg, match.user_id),
    fetchHabitTags(cfg),
  ]);

  const focusPoints: FocusPoint[] = focusRows.map((f) => ({
    id: f.id,
    body: f.body,
    category: f.category,
  }));
  let habitTags = habitTagsToManifest(habitRows);
  if (habitTags.length === 0) habitTags = HABIT_TAGS_FALLBACK;

  const timestamps = timestampsFromReview(claimed);
  if (timestamps.length === 0) throw new Error(`review=${reviewId}: requested_timestamps が空です`);

  const duration = await getDuration(match.video_url);
  const videoId = parseVideoId(match.video_url);
  console.log(
    `[prep] review=${reviewId} videoId=${videoId} duration=${duration}s ` +
      `scenes=${timestamps.length} focus=${focusPoints.length}`,
  );

  const workDir = join(WORK_DIR, reviewId);
  const res = await buildWorkspace({
    review_id: reviewId,
    workDir,
    video: { url: match.video_url, videoId, duration_sec: duration },
    timestamps,
    request: {
      opponent_character: { id: match.opponent_character_id, name: opponentName },
      mode: match.mode,
      result: match.result,
      memo: match.memo,
    },
    focus_points: focusPoints,
    habit_tags: habitTags,
  });
  printSummary(reviewId, res);
}

async function runPrep(args: PrepArgs): Promise<void> {
  const env = await loadEnvFile(MAIN_REPO_ENV_PATH);
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(`SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が ${MAIN_REPO_ENV_PATH} に見つかりません`);
  }
  const cfg: SupabaseConfig = { url: supabaseUrl, serviceRoleKey };

  // 対象 status を決める
  const status = args.retry ? "error" : args.retryStale ? "processing" : "pending";
  const staleBeforeIso = args.retryStale
    ? new Date(Date.now() - STALE_PROCESSING_MIN * 60_000).toISOString()
    : undefined;

  const candidates = await fetchReviewsByStatus(cfg, status, staleBeforeIso);
  console.log(`[prep] mode=${status}${staleBeforeIso ? "(stale)" : ""} 候補 ${candidates.length} 件`);
  if (candidates.length === 0) {
    console.log("[prep] 対象なし。終了。");
    return;
  }

  const targets = args.all ? candidates : candidates.slice(0, 1);
  let failures = 0;

  for (const cand of targets) {
    // 条件付き PATCH で claim（他プロセス/前回claimと競合安全）
    const claimed = await claimReview(cfg, cand.id, status);
    if (!claimed) {
      console.log(`[skip] review=${cand.id} は claim できませんでした（別プロセスが取得済み?）`);
      continue;
    }
    try {
      await processReview(cfg, claimed);
    } catch (e) {
      failures++;
      console.error(
        `[error] review=${claimed.id} の処理に失敗（status=processing のまま残置）: ${(e as Error).message}`,
      );
      console.error(
        `        分析を放棄する場合: npm run fail -- ${claimed.id} --message "…" / 再処理: npm run prep -- --retry-stale`,
      );
    }
  }

  if (failures > 0) process.exit(1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.dryRun) {
    await runDryRun(args);
  } else {
    await runPrep(args);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
