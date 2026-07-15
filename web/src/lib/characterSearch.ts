// キャラ一覧（"/"）のリアルタイム検索用ロジック（純関数・UI非依存）。
// ひらがな/カタカナ・大文字小文字を無視した部分一致・サブシーケンス一致で
// 「がのん」→ガノンドロフ、「zss」→Zero Suit Samus のような曖昧入力を拾う。

const KATAKANA_START = 0x30a1; // ァ
const KATAKANA_END = 0x30f6; // ヶ（ー(0x30fc)はこの範囲外＝変換されずそのまま）
const KATAKANA_TO_HIRAGANA_OFFSET = 0x60;

/** NFKC正規化→小文字化→カタカナをひらがな化→空白/「・」除去、で検索用に正規化する。 */
export function normalizeForSearch(s: string): string {
  const nfkc = s.normalize("NFKC").toLowerCase();
  let out = "";
  for (const ch of nfkc) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= KATAKANA_START && code <= KATAKANA_END) {
      out += String.fromCodePoint(code - KATAKANA_TO_HIRAGANA_OFFSET);
    } else {
      out += ch;
    }
  }
  return out.replace(/[\s・]/g, "");
}

/** needle の各文字が haystack 中に順序を保って（連続でなくてよい）すべて現れるか。 */
export function isSubsequence(needle: string, haystack: string): boolean {
  if (needle.length === 0) return true;
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) {
      i += 1;
      if (i >= needle.length) return true;
    }
  }
  return false;
}

interface SearchableCharacter {
  name_ja: string;
  name_en: string;
  slug: string;
}

/**
 * クエリと1キャラのマッチ度。前方一致=0 / 部分一致=1 / サブシーケンス一致=2 / 不一致=null。
 * name_ja / name_en / slug のうち最良（最小）のスコアを返す。
 */
export function characterSearchScore(query: string, c: SearchableCharacter): number | null {
  const q = normalizeForSearch(query);
  if (!q) return null;
  const fields = [c.name_ja, c.name_en, c.slug].map(normalizeForSearch);
  let best: number | null = null;
  for (const f of fields) {
    let score: number | null = null;
    if (f.startsWith(q)) score = 0;
    else if (f.includes(q)) score = 1;
    else if (isSubsequence(q, f)) score = 2;
    if (score !== null && (best === null || score < best)) best = score;
  }
  return best;
}

/**
 * クエリで絞り込み、スコア昇順（前方一致→部分一致→サブシーケンス一致）→ fighter_number 昇順で並べる。
 * 空クエリは list をそのまま返す（従来表示を維持）。
 */
export function filterCharacters<
  T extends { name_ja: string; name_en: string; slug: string; fighter_number: number | null },
>(query: string, list: T[]): T[] {
  const q = query.trim();
  if (!q) return list;
  const scored: Array<{ item: T; score: number }> = [];
  for (const item of list) {
    const score = characterSearchScore(q, item);
    if (score !== null) scored.push({ item, score });
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return (a.item.fighter_number ?? 9999) - (b.item.fighter_number ?? 9999);
  });
  return scored.map((s) => s.item);
}
