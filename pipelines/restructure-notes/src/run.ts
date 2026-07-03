// restructure-notes: kind='matchup' の全ノートを整頓し note_proposals へ投入する。
// docs/06_ui-redesign.md「キャラ対メモのAI整頓」/ ADR-0010。
//
// モード:
//   （既定）      : Gemini APIで生成して投入。既存 pending 提案があるノートはスキップ（冪等）。
//   --dry-run     : 3件だけGeminiで生成し .context/restructure-notes-dry-run/ にファイル出力（DB投入なし）。
//   --from-file <path>: JSON配列 [{note_id, proposed_body_md, change_summary?}] を読み込み、
//     Gemini呼び出しの代わりにその本文を使う（engine='claude-manual'）。
//     検証器（数値・技名トークン保持チェック→欠落は needs_review マーク。リトライなし）と
//     投入ロジック（base_updated_at=投入時点の notes.updated_at、pending重複スキップ）は共通。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DRY_RUN_DIR,
  DRY_RUN_SAMPLE_SIZE,
  FROM_FILE_ENGINE,
  GEMINI_MODEL,
  MAIN_REPO_ENV_PATH,
} from "./config.js";
import { loadEnvFile } from "./lib/load-env.js";
import { generateRestructuredBody } from "./lib/gemini-client.js";
import { restructureNote } from "./lib/restructure-note.js";
import { evaluateFileProposal, parseProposalsFile } from "./lib/from-file.js";
import {
  fetchCharactersById,
  fetchMatchupNotes,
  fetchPendingProposalNoteIds,
  insertNoteProposal,
  type NoteRow,
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

function parseArgs(argv: string[]): { isDryRun: boolean; fromFile: string | null } {
  const isDryRun = argv.includes("--dry-run");
  const idx = argv.indexOf("--from-file");
  let fromFile: string | null = null;
  if (idx !== -1) {
    fromFile = argv[idx + 1] ?? null;
    if (!fromFile || fromFile.startsWith("--")) {
      throw new Error("--from-file にはファイルパスを指定してください");
    }
  }
  if (isDryRun && fromFile) {
    throw new Error("--dry-run と --from-file は同時に指定できません");
  }
  return { isDryRun, fromFile };
}

async function runFromFile(
  cfg: SupabaseConfig,
  notes: NoteRow[],
  pendingNoteIds: Set<string>,
  fromFilePath: string,
  stats: Stats,
): Promise<void> {
  const proposals = parseProposalsFile(await readFile(fromFilePath, "utf-8"));
  console.log(`[from-file] ${proposals.length} 件の提案を ${fromFilePath} から読み込みました`);

  const notesById = new Map(notes.map((n) => [n.id, n]));

  for (const proposal of proposals) {
    const note = notesById.get(proposal.note_id);
    if (!note) {
      console.log(`[warn] note=${proposal.note_id} は kind=matchup のノートに存在しません。スキップ`);
      continue;
    }
    if (pendingNoteIds.has(note.id)) {
      stats.skippedExistingPending++;
      console.log(`[skip] note=${note.id} title="${note.title ?? ""}" (既存pending提案あり)`);
      continue;
    }

    const result = evaluateFileProposal(
      { title: note.title, bodyMd: note.body_md ?? "" },
      proposal,
    );

    if (result.needsReview) {
      stats.needsReview++;
      console.log(
        `[needs_review] note=${note.id} title="${note.title ?? ""}" missing=${result.missingTokens.join(",")}`,
      );
    } else {
      stats.succeededNoRetry++;
    }

    await insertNoteProposal(cfg, {
      note_id: note.id,
      proposed_body_md: result.proposedBodyMd,
      change_summary: result.changeSummary,
      engine: FROM_FILE_ENGINE,
      base_updated_at: note.updated_at,
    });
    stats.inserted++;
    console.log(`[inserted] note=${note.id} title="${note.title ?? ""}"`);
  }
}

async function main(): Promise<void> {
  const { isDryRun, fromFile } = parseArgs(process.argv);

  const env = await loadEnvFile(MAIN_REPO_ENV_PATH);
  const geminiApiKey = env.GEMINI_API_KEY;
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!fromFile && !geminiApiKey) {
    throw new Error(`GEMINI_API_KEY が ${MAIN_REPO_ENV_PATH} に見つかりません`);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(`SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が ${MAIN_REPO_ENV_PATH} に見つかりません`);
  }

  const cfg: SupabaseConfig = { url: supabaseUrl, serviceRoleKey };

  const mode = fromFile ? "from-file" : isDryRun ? "dry-run" : "production";
  console.log(`[run] mode=${mode} engine=${fromFile ? FROM_FILE_ENGINE : GEMINI_MODEL}`);

  const [notes, charactersById, pendingNoteIds] = await Promise.all([
    fetchMatchupNotes(cfg),
    fetchCharactersById(cfg),
    fetchPendingProposalNoteIds(cfg),
  ]);

  console.log(`[run] 対象ノート ${notes.length} 件（kind=matchup）`);

  const stats: Stats = {
    total: notes.length,
    skippedExistingPending: 0,
    succeededNoRetry: 0,
    succeededWithRetry: 0,
    needsReview: 0,
    inserted: 0,
  };

  if (fromFile) {
    await runFromFile(cfg, notes, pendingNoteIds, fromFile, stats);
    console.log("[run] 統計:", JSON.stringify(stats, null, 2));
    return;
  }

  const targets = isDryRun ? notes.slice(0, DRY_RUN_SAMPLE_SIZE) : notes;

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
      generateRestructuredBody({ apiKey: geminiApiKey!, prompt });

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
