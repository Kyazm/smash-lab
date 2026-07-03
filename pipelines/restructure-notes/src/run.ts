// restructure-notes: kind='matchup' の全ノートをGeminiで整頓し note_proposals へ投入する。
// docs/06_ui-redesign.md「キャラ対メモのAI整頓」/ ADR-0010。
//
// --dry-run: 3件だけ生成し .context/restructure-notes-dry-run/ にファイル出力する（DBには入れない）。
// 本番実行: 全 matchup ノートを対象に、既存 pending 提案があるノートはスキップ（冪等）。
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DRY_RUN_DIR,
  DRY_RUN_SAMPLE_SIZE,
  GEMINI_MODEL,
  MAIN_REPO_ENV_PATH,
} from "./config.js";
import { loadEnvFile } from "./lib/load-env.js";
import { generateRestructuredBody } from "./lib/gemini-client.js";
import { restructureNote } from "./lib/restructure-note.js";
import {
  fetchCharactersById,
  fetchMatchupNotes,
  fetchPendingProposalNoteIds,
  insertNoteProposal,
  type SupabaseConfig,
} from "./lib/supabase-client.js";

interface Stats {
  total: number;
  skippedExistingPending: number;
  succeededNoRetry: number;
  succeededWithRetry: number;
  needsReview: number;
  inserted: number;
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes("--dry-run");

  const env = await loadEnvFile(MAIN_REPO_ENV_PATH);
  const geminiApiKey = env.GEMINI_API_KEY;
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!geminiApiKey) throw new Error(`GEMINI_API_KEY が ${MAIN_REPO_ENV_PATH} に見つかりません`);
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(`SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が ${MAIN_REPO_ENV_PATH} に見つかりません`);
  }

  const cfg: SupabaseConfig = { url: supabaseUrl, serviceRoleKey };

  console.log(`[run] mode=${isDryRun ? "dry-run" : "production"} model=${GEMINI_MODEL}`);

  const [notes, charactersById, pendingNoteIds] = await Promise.all([
    fetchMatchupNotes(cfg),
    fetchCharactersById(cfg),
    fetchPendingProposalNoteIds(cfg),
  ]);

  console.log(`[run] 対象ノート ${notes.length} 件（kind=matchup）`);

  const targets = isDryRun ? notes.slice(0, DRY_RUN_SAMPLE_SIZE) : notes;

  const stats: Stats = {
    total: notes.length,
    skippedExistingPending: 0,
    succeededNoRetry: 0,
    succeededWithRetry: 0,
    needsReview: 0,
    inserted: 0,
  };

  if (isDryRun) {
    await mkdir(DRY_RUN_DIR, { recursive: true });
  }

  for (const note of targets) {
    if (!isDryRun && pendingNoteIds.has(note.id)) {
      stats.skippedExistingPending++;
      console.log(`[skip] note=${note.id} title="${note.title ?? ""}" (既存pending提案あり)`);
      continue;
    }

    const characterName = note.character_id
      ? charactersById.get(note.character_id)?.name_ja ?? null
      : null;

    const generate = (prompt: string) =>
      generateRestructuredBody({ apiKey: geminiApiKey, prompt });

    const result = await restructureNote(
      { characterName, title: note.title, bodyMd: note.body_md ?? "" },
      generate,
    );

    if (result.needsReview) {
      stats.needsReview++;
      console.log(
        `[needs_review] note=${note.id} title="${note.title ?? ""}" missing=${result.missingTokens.join(",")}`,
      );
    } else if (result.attempts > 1) {
      stats.succeededWithRetry++;
    } else {
      stats.succeededNoRetry++;
    }

    if (isDryRun) {
      const outPath = join(DRY_RUN_DIR, `${note.id}.md`);
      const content = [
        `# note_id: ${note.id}`,
        `# character: ${characterName ?? "(unknown)"}`,
        `# title: ${note.title ?? ""}`,
        `# attempts: ${result.attempts}`,
        `# needs_review: ${result.needsReview}`,
        result.missingTokens.length > 0 ? `# missing_tokens: ${result.missingTokens.join(", ")}` : "",
        "",
        "## 原文冒頭（先頭300字）",
        (note.body_md ?? "").slice(0, 300),
        "",
        "## 提案冒頭（先頭300字）",
        result.proposedBodyMd.slice(0, 300),
        "",
        "## 原文全文",
        note.body_md ?? "",
        "",
        "## 提案全文",
        result.proposedBodyMd,
        "",
      ].join("\n");
      await writeFile(outPath, content, "utf-8");
      console.log(`[dry-run] wrote ${outPath}`);
      continue;
    }

    await insertNoteProposal(cfg, {
      note_id: note.id,
      proposed_body_md: result.proposedBodyMd,
      change_summary: result.changeSummary,
      engine: GEMINI_MODEL,
      base_updated_at: note.updated_at,
    });
    stats.inserted++;
    console.log(`[inserted] note=${note.id} title="${note.title ?? ""}"`);
  }

  console.log("[run] 統計:", JSON.stringify(stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
