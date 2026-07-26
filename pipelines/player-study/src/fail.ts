// fail: 動画を error に落とす（座礁の解消 / 分析放棄）。作業ディレクトリは残す（--retry 相当は再 prep）。
//   npm run fail -- <video_id> --message "…"
import { join } from "node:path";
import { MAIN_REPO_ENV_PATH, WORK_ROOT } from "./config.js";
import { loadEnvFile } from "./lib/load-env.js";
import { failVideo, type SupabaseConfig } from "./lib/supabase-client.js";

function parseArgs(argv: string[]): { videoId: string; message: string } {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const videoId = positional[0];
  if (!videoId) throw new Error('使い方: fail -- <video_id> --message "…"');
  const idx = argv.indexOf("--message");
  const message = idx !== -1 ? argv[idx + 1] : undefined;
  if (!message || message.startsWith("--")) throw new Error("--message に理由を指定してください");
  return { videoId, message };
}

async function main(): Promise<void> {
  const { videoId, message } = parseArgs(process.argv.slice(2));

  const env = await loadEnvFile(MAIN_REPO_ENV_PATH);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(`SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が ${MAIN_REPO_ENV_PATH} に見つかりません`);
  }
  const cfg: SupabaseConfig = { url: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY };

  const row = await failVideo(cfg, videoId, message);
  console.log(`[fail] study_videos 更新: video_id=${row.video_id} status=${row.status} message="${message}"`);
  console.log(`[fail] 作業ディレクトリは残置: ${join(WORK_ROOT, videoId)}`);
  console.log(`[fail] 再処理する場合: npm run prep -- ${videoId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
