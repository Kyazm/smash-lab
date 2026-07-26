// submit: Claude Code セッションが書いた labels.json を検証し、代表フレームを Storage へ上げて
// study_interactions へ INSERT、status→done、workdir を丸ごと削除する（ストレージ逐次掃除 / ADR-0020）。
//   npm run submit -- <video_id> [--file <path>]
// 既定 path = <workdir>/labels.json。検証失敗時は DB/Storage を触らず終了。成功時のみ削除。
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { MAIN_REPO_ENV_PATH, WORK_ROOT } from "./config.js";
import { normalizeChar } from "./lib/char-normalize.js";
import { computeCleanupPath } from "./lib/cleanup.js";
import { parseAndValidateLabels, type LabelsJson } from "./lib/labels-schema.js";
import { loadEnvFile } from "./lib/load-env.js";
import {
  fetchStudyVideo,
  insertInteractions,
  markDone,
  uploadFrame,
  type StudyInteractionInsert,
  type SupabaseConfig,
} from "./lib/supabase-client.js";

function parseArgs(argv: string[]): { videoId: string; file: string | null } {
  let file: string | null = null;
  const fileIdx = argv.indexOf("--file");
  if (fileIdx !== -1) {
    file = argv[fileIdx + 1] ?? null;
    if (!file || file.startsWith("--")) throw new Error("--file にはパスを指定してください");
  }
  const excluded = new Set<number>();
  if (fileIdx !== -1) {
    excluded.add(fileIdx);
    excluded.add(fileIdx + 1);
  }
  const positional = argv.filter((a, i) => !a.startsWith("--") && !excluded.has(i));
  const videoId = positional[0];
  if (!videoId) throw new Error("使い方: submit -- <video_id> [--file <path>]");
  return { videoId, file };
}

/** ゲーム単位の opp_char を index で引ける Map にする。 */
function gameOppChars(labels: LabelsJson): Map<number, string> {
  const m = new Map<number, string>();
  for (const g of labels.games) m.set(g.game_index, g.opp_char);
  return m;
}

async function main(): Promise<void> {
  const { videoId, file } = parseArgs(process.argv.slice(2));
  const workdir = join(WORK_ROOT, videoId);
  const labelsPath = file ?? join(workdir, "labels.json");

  // 検証（DBに触れる前にゲート）
  const text = await readFile(labelsPath, "utf-8").catch((e) => {
    throw new Error(`labels.json を読めません（${labelsPath}）: ${(e as Error).message}`);
  });
  const validated = parseAndValidateLabels(text);
  if (!validated.ok) {
    console.error(`[invalid] labels.json の検証に失敗（DB/Storageは更新しません）:`);
    for (const err of validated.errors) console.error(`  - ${err}`);
    process.exit(1);
    return;
  }
  const labels = validated.value;
  if (labels.video_id && labels.video_id !== videoId) {
    throw new Error(`labels.video_id(${labels.video_id}) が引数(${videoId}) と一致しません`);
  }
  console.log(
    `[submit] ${videoId} games=${labels.games.length} interactions=${labels.interactions.length}`,
  );

  // DB 設定
  const env = await loadEnvFile(MAIN_REPO_ENV_PATH);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が ${MAIN_REPO_ENV_PATH} に見つかりません`);
  }
  const cfg: SupabaseConfig = { url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY };

  const videoRow = await fetchStudyVideo(cfg, videoId);
  if (!videoRow) throw new Error(`study_videos に video_id=${videoId} がありません（先に collect/prep）`);

  const oppByGame = gameOppChars(labels);

  // 各 interaction: フレームを Storage へ上げ、INSERT 行を組み立てる
  const inserts: StudyInteractionInsert[] = [];
  for (let i = 0; i < labels.interactions.length; i++) {
    const it = labels.interactions[i];
    const n = i + 1;
    const framePath = join(workdir, it.frame);
    const bytes = await readFile(framePath).catch((e) => {
      throw new Error(`フレームを読めません（${framePath}）: ${(e as Error).message}`);
    });
    const objectPath = await uploadFrame(cfg, videoId, n, bytes);
    const rawOpp = it.opp_char ?? oppByGame.get(it.game_index) ?? "";
    inserts.push({
      video_ref: videoRow.id,
      game_index: it.game_index,
      t_sec: it.t_sec,
      opp_char: normalizeChar(rawOpp),
      situation: it.situation,
      sub_situation: it.sub_situation ?? null,
      action: it.action,
      action_detail: it.action_detail ?? null,
      outcome: it.outcome,
      kill: it.kill ?? false,
      confidence: it.confidence,
      frame_path: objectPath,
      note: it.note ?? null,
    });
  }
  console.log(`[submit] フレーム ${inserts.length} 枚を note-media/study/${videoId}/ へアップ完了`);

  await insertInteractions(cfg, inserts);
  console.log(`[submit] study_interactions へ ${inserts.length} 件 INSERT`);

  const done = await markDone(cfg, videoId);
  console.log(`[submit] study_videos(${videoId}) status→${done.status}`);

  // 成功時のみ workdir を丸ごと削除（動画・scan・bursts・MANIFEST 全部）
  const target = computeCleanupPath(WORK_ROOT, videoId);
  await rm(target, { recursive: true, force: true });
  console.log(`[submit] workdir 削除（ストレージ掃除）: ${target}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
