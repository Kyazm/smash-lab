// 1ノート分の整頓オーケストレーション（生成→検証→リトライ→needs_review付与）。
// Gemini呼び出しを関数注入にすることで、テストでは実APIを叩かずロジックのみ検証できるようにする。
import { buildRestructurePrompt, buildRetryPrompt } from "./build-prompt.js";
import { verifyTokensPreserved } from "./verify-tokens.js";

export interface RestructureInput {
  characterName: string | null;
  title: string | null;
  bodyMd: string;
}

export type GenerateFn = (prompt: string) => Promise<string>;

export interface RestructureResult {
  proposedBodyMd: string;
  changeSummary: string | null;
  attempts: number; // 1 = リトライなし, 2 = 1回リトライ
  needsReview: boolean;
  missingTokens: string[];
}

const MAX_ATTEMPTS = 2;

export async function restructureNote(
  input: RestructureInput,
  generate: GenerateFn,
): Promise<RestructureResult> {
  const originalText = `${input.title ?? ""}\n${input.bodyMd}`;

  let lastProposed = "";
  let lastMissing: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 1
        ? buildRestructurePrompt(input)
        : buildRetryPrompt(input, lastMissing);

    const proposed = await generate(prompt);
    const verification = verifyTokensPreserved(originalText, proposed);

    lastProposed = proposed;
    lastMissing = verification.missing;

    if (verification.ok) {
      return {
        proposedBodyMd: proposed,
        changeSummary: null,
        attempts: attempt,
        needsReview: false,
        missingTokens: [],
      };
    }
  }

  // MAX_ATTEMPTS 回試しても欠落が残った場合: needs_review を記録して投入は行う（人間判断に委ねる）。
  return {
    proposedBodyMd: lastProposed,
    changeSummary: `needs_review:${lastMissing.join(",")}`,
    attempts: MAX_ATTEMPTS,
    needsReview: true,
    missingTokens: lastMissing,
  };
}
