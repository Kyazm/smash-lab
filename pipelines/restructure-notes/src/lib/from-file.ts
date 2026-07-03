// --from-file モード: 外部生成（Claudeエージェント等）の提案JSONを読み込み、
// Gemini呼び出しの代わりにその本文を使う。検証器と投入ロジックは通常モードと共通。
// リトライはしない（ファイル内容は固定のため）。欠落があれば needs_review マークのみ付けて投入する。
import { verifyTokensPreserved } from "./verify-tokens.js";

export interface FileProposal {
  note_id: string;
  proposed_body_md: string;
  change_summary?: string | null;
}

/** JSON文字列をパースし、形式を検証して FileProposal[] を返す。 */
export function parseProposalsFile(jsonText: string): FileProposal[] {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`--from-file のJSONパースに失敗: ${(e as Error).message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("--from-file のJSONは配列である必要があります");
  }
  return data.map((row, i) => {
    if (typeof row !== "object" || row === null) {
      throw new Error(`--from-file [${i}]: オブジェクトではありません`);
    }
    const r = row as Record<string, unknown>;
    if (typeof r.note_id !== "string" || r.note_id.length === 0) {
      throw new Error(`--from-file [${i}]: note_id が不正です`);
    }
    if (typeof r.proposed_body_md !== "string" || r.proposed_body_md.trim().length === 0) {
      throw new Error(`--from-file [${i}]: proposed_body_md が不正です（note_id=${r.note_id}）`);
    }
    if (
      r.change_summary !== undefined &&
      r.change_summary !== null &&
      typeof r.change_summary !== "string"
    ) {
      throw new Error(`--from-file [${i}]: change_summary が不正です（note_id=${r.note_id}）`);
    }
    return {
      note_id: r.note_id,
      proposed_body_md: r.proposed_body_md,
      change_summary: (r.change_summary as string | null | undefined) ?? null,
    };
  });
}

export interface FileProposalResult {
  proposedBodyMd: string;
  changeSummary: string | null;
  needsReview: boolean;
  missingTokens: string[];
}

/**
 * ファイル由来の提案本文に検証器を通し、投入用の結果を作る（純関数）。
 * 欠落があれば change_summary に needs_review:<欠落一覧> を先頭付与する（元のsummaryは後ろに残す）。
 */
export function evaluateFileProposal(
  original: { title: string | null; bodyMd: string },
  proposal: FileProposal,
): FileProposalResult {
  const originalText = `${original.title ?? ""}\n${original.bodyMd}`;
  const verification = verifyTokensPreserved(originalText, proposal.proposed_body_md);

  if (verification.ok) {
    return {
      proposedBodyMd: proposal.proposed_body_md,
      changeSummary: proposal.change_summary ?? null,
      needsReview: false,
      missingTokens: [],
    };
  }

  const needsReviewTag = `needs_review:${verification.missing.join(",")}`;
  const changeSummary = proposal.change_summary
    ? `${needsReviewTag}\n${proposal.change_summary}`
    : needsReviewTag;

  return {
    proposedBodyMd: proposal.proposed_body_md,
    changeSummary,
    needsReview: true,
    missingTokens: verification.missing,
  };
}
