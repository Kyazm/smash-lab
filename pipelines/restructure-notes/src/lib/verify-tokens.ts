// 整頓提案の検証器（純関数）。
// 原文にある「数値トークン（%・F・数字）」と「技名らしきトークン」が、提案本文にも
// 保持されているかをチェックする。事実の欠落を機械的に検知するための最終防衛線（ADR-0010）。

// 数値トークン: 30%, 12F, 40f, 120（単独の数字列）など。
// 例: "12F", "30%", "2段目", "1F" も拾えるよう先頭に数字を要求する。
const NUMERIC_TOKEN_RE = /\d+(?:\.\d+)?\s*(?:%|[Ff](?![a-zA-Z])|フレーム)?/g;

// 技名らしきトークン: カタカナ2文字以上の連続、または「◯◯攻撃」「上/下/横+B/A/スマッシュ」等の
// スマブラ用語の典型パターン。完全な技名辞書は持たないため、緩めのヒューリスティックにする。
const MOVE_LIKE_TOKEN_RE =
  /[ァ-ヶー]{2,}|(?:上|下|横|前後|後)(?:強|スマッシュ|空中|B|A)|(?:弱|ジャブ|つかみ|投げ|ダッシュ攻撃|空N|空前|空後|空上|空下|NB|横B|上B|下B)/g;

export interface TokenSet {
  numeric: string[];
  moveLike: string[];
}

function normalize(token: string): string {
  return token.replace(/\s+/g, "").toLowerCase();
}

export function extractTokens(text: string): TokenSet {
  const numeric = Array.from(text.matchAll(NUMERIC_TOKEN_RE), (m) => m[0].trim()).filter(
    (t) => t.length > 0,
  );
  const moveLike = Array.from(text.matchAll(MOVE_LIKE_TOKEN_RE), (m) => m[0].trim()).filter(
    (t) => t.length > 0,
  );
  return { numeric, moveLike };
}

export interface VerifyResult {
  ok: boolean;
  missing: string[];
}

/**
 * 原文のトークンが提案本文に保持されているか検証する。
 * 出典注記化で日付の数字（YYYY-MM）は許容差分として扱わないため、
 * 呼び出し側で日付らしき4桁の年は原文抽出時に無視してよいが、
 * ここでは単純な包含チェックに留める（誤検知は許容、リトライで吸収する設計）。
 */
export function verifyTokensPreserved(originalText: string, proposedText: string): VerifyResult {
  const original = extractTokens(originalText);
  const proposedNormalized = new Set(
    [...extractTokens(proposedText).numeric, ...extractTokens(proposedText).moveLike].map(
      normalize,
    ),
  );

  const allOriginal = [...original.numeric, ...original.moveLike];
  const missing: string[] = [];
  const seen = new Set<string>();

  for (const token of allOriginal) {
    const key = normalize(token);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!proposedNormalized.has(key)) {
      missing.push(token);
    }
  }

  return { ok: missing.length === 0, missing };
}
