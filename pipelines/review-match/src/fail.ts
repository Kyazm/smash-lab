// fail: レビューを error に戻す（processing 座礁の解消 / 分析放棄）。作業ディレクトリは残す。
//   npm run fail -- <review_id> --message "…"
import { MAIN_REPO_ENV_PATH, WORK_DIR } from "./config.js";
import { loadEnvFile } from "./lib/load-env.js";
import { failReview, type SupabaseConfig } from "./lib/supabase-client.js";
import { join } from "node:path";

function parseArgs(argv: string[]): { reviewId: string; message: string } {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const reviewId = positional[0];
  if (!reviewId) throw new Error('使い方: npm run fail -- <review_id> --message "…"');

  const idx = argv.indexOf("--message");
  const message = idx !== -1 ? argv[idx + 1] : undefined;
  if (!message || message.startsWith("--")) {
    throw new Error("--message に理由を指定してください");
  }
  return { reviewId, message };
}

async function main(): Promise<void> {
  const { reviewId, message } = parseArgs(process.argv.slice(2));

  const env = await loadEnvFile(MAIN_REPO_ENV_PATH);
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(`SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が ${MAIN_REPO_ENV_PATH} に見つかりません`);
  }
  const cfg: SupabaseConfig = { url: supabaseUrl, serviceRoleKey };

  const row = await failReview(cfg, reviewId, message);
  console.log(`[fail] ai_reviews 更新: id=${row.id} status=${row.status} message="${message}"`);
  console.log(`[fail] 作業ディレクトリは残置: ${join(WORK_DIR, reviewId)}`);
  console.log(`[fail] 再処理する場合: npm run prep -- --retry`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
