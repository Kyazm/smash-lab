// submit: Claude Code が書いた result.json を検証・集約して ai_reviews を done で確定する。
//   npm run submit -- <review_id> [--file <path>]
// 既定 path = <repo>/.context/review-match/<review_id>/result.json
// 検証失敗時は DB を触らず終了。成功時のみ作業ディレクトリを削除する。
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { MAIN_REPO_ENV_PATH, WORK_DIR } from "./config.js";
import { aggregate, type AggregateContext } from "./lib/aggregate.js";
import { loadEnvFile } from "./lib/load-env.js";
import type { Manifest } from "./lib/manifest.js";
import { parseAndValidateResult } from "./lib/schema.js";
import { completeReview, type SupabaseConfig } from "./lib/supabase-client.js";

function parseArgs(argv: string[]): { reviewId: string; file: string | null } {
  let file: string | null = null;
  const fileIdx = argv.indexOf("--file");
  if (fileIdx !== -1) {
    file = argv[fileIdx + 1] ?? null;
    if (!file || file.startsWith("--")) throw new Error("--file にはパスを指定してください");
  }
  // --file とその値を除外した残りの非フラグ先頭を review_id とする
  const excluded = new Set<number>();
  if (fileIdx !== -1) {
    excluded.add(fileIdx);
    excluded.add(fileIdx + 1);
  }
  const positional = argv.filter((a, i) => !a.startsWith("--") && !excluded.has(i));
  const reviewId = positional[0];
  if (!reviewId) throw new Error("使い方: npm run submit -- <review_id> [--file <path>]");

  return { reviewId, file };
}

function contextFromManifest(manifest: Manifest): AggregateContext {
  return {
    sceneWindows: manifest.scenes.map((s) => ({ t_sec: s.t_sec, window: s.window })),
    habitSlugs: new Set(manifest.habit_tags.map((h) => h.slug)),
    focusPointIds: new Set(manifest.focus_points.map((f) => f.id)),
  };
}

async function main(): Promise<void> {
  const { reviewId, file } = parseArgs(process.argv.slice(2));
  const workDir = join(WORK_DIR, reviewId);
  const manifestPath = join(workDir, "MANIFEST.json");
  const resultPath = file ?? join(workDir, "result.json");

  // MANIFEST（集約コンテキスト）読み込み
  let manifest: Manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as Manifest;
  } catch (e) {
    throw new Error(`MANIFEST.json を読めません（${manifestPath}）: ${(e as Error).message}`);
  }

  // result.json 検証
  const resultText = await readFile(resultPath, "utf-8").catch((e) => {
    throw new Error(`result.json を読めません（${resultPath}）: ${(e as Error).message}`);
  });
  const validated = parseAndValidateResult(resultText);
  if (!validated.ok) {
    console.error(`[invalid] result.json の検証に失敗（DBは更新しません）:`);
    for (const err of validated.errors) console.error(`  - ${err}`);
    process.exit(1);
    return;
  }

  // 集約
  const agg = aggregate(validated.value, contextFromManifest(manifest));
  for (const w of agg.warnings) console.warn(`[warn] ${w}`);
  console.log(
    `[submit] review=${reviewId} findings=${agg.findings.length} ` +
      `focus_evaluations=${agg.focus_evaluations.length}`,
  );

  // DB 書込
  const env = await loadEnvFile(MAIN_REPO_ENV_PATH);
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(`SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が ${MAIN_REPO_ENV_PATH} に見つかりません`);
  }
  const cfg: SupabaseConfig = { url: supabaseUrl, serviceRoleKey };

  const row = await completeReview(cfg, reviewId, {
    findings: agg.findings,
    summary_md: agg.summary_md,
    one_mistake: agg.one_mistake,
    focus_evaluations: agg.focus_evaluations,
  });
  console.log(`[submit] ai_reviews 更新: id=${row.id} status=${row.status}`);

  // 成功時のみ作業ディレクトリ削除
  await rm(workDir, { recursive: true, force: true });
  console.log(`[submit] 作業ディレクトリ削除: ${workDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
