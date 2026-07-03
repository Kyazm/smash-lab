// 対象ノート（kind='matchup'）を生成素材としてJSONにエクスポートする。
// Gemini課金が使えない間、Claudeエージェント等が読み込んで提案本文を生成し、
// `npm run run -- --from-file <path>` で投入するための入力素材。
// 出力先: メインリポジトリ側 .context/restructure-src/notes-export.json（gitignore済み）
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { MAIN_REPO_ENV_PATH, NOTES_EXPORT_PATH } from "./config.js";
import { loadEnvFile } from "./lib/load-env.js";
import {
  fetchCharactersById,
  fetchMatchupNotes,
  type SupabaseConfig,
} from "./lib/supabase-client.js";

export interface ExportedNote {
  note_id: string;
  character_name_ja: string | null;
  title: string | null;
  body_md: string;
  updated_at: string;
}

async function main(): Promise<void> {
  const env = await loadEnvFile(MAIN_REPO_ENV_PATH);
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(`SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が ${MAIN_REPO_ENV_PATH} に見つかりません`);
  }
  const cfg: SupabaseConfig = { url: supabaseUrl, serviceRoleKey };

  const [notes, charactersById] = await Promise.all([
    fetchMatchupNotes(cfg),
    fetchCharactersById(cfg),
  ]);

  const exported: ExportedNote[] = notes.map((n) => ({
    note_id: n.id,
    character_name_ja: n.character_id
      ? charactersById.get(n.character_id)?.name_ja ?? null
      : null,
    title: n.title,
    body_md: n.body_md ?? "",
    updated_at: n.updated_at,
  }));

  await mkdir(dirname(NOTES_EXPORT_PATH), { recursive: true });
  await writeFile(NOTES_EXPORT_PATH, JSON.stringify(exported, null, 2), "utf-8");
  console.log(`[export] ${exported.length} 件を書き出しました: ${NOTES_EXPORT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
