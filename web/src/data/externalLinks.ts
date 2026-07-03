// キャラ対ページの外部リンク欄（docs/06 A-3 / ADR-0011）。データの転載はしない、リンク参照のみ。
//   - UFD: 取込元でslug完全一致のため安全に生成できる（https://ultimateframedata.com/{slug}）
//   - pheasantzelda（スマアナ）: slug規則が異なる（chara/{NN}.{name}.html、NNは自サイト内の連番で
//     本アプリの fighter_number とは一致しない）。誤リンクを避けるため、実閲覧で確認済みのキャラのみ
//     マッピングに登録し、未登録キャラはサイトトップへフォールバックする（ADR-0011）。
import type { Character } from "../types";

// 実閲覧で確認済み（.context/research-pheasantzelda.md）: ZSS = chara/34.zero_suit_samus.html
const PHEASANTZELDA_SLUG_MAP: Record<string, string> = {
  zero_suit_samus: "34.zero_suit_samus",
};

const PHEASANTZELDA_BASE = "https://pheasantzelda.github.io/";
const UFD_BASE = "https://ultimateframedata.com/";

export interface ExternalLink {
  label: string;
  url: string;
  /** マッピング未登録でサイトトップにフォールバックした場合 true（UI側で注記を出す） */
  fallback?: boolean;
}

/** UFDのキャラページURL。取込元スラッグと完全一致するため常にキャラページへ直接リンクできる。 */
export function ufdCharacterUrl(character: Pick<Character, "slug">): string {
  return `${UFD_BASE}${character.slug}`;
}

/** pheasantzelda（スマアナ）のキャラページURL。未登録キャラはサイトトップへフォールバック。 */
export function pheasantzeldaCharacterLink(character: Pick<Character, "slug">): ExternalLink {
  const mapped = PHEASANTZELDA_SLUG_MAP[character.slug];
  if (mapped) {
    return { label: "スマアナ（マッチアップ統計）", url: `${PHEASANTZELDA_BASE}chara/${mapped}.html` };
  }
  return {
    label: "スマアナ（トップページ）",
    url: PHEASANTZELDA_BASE,
    fallback: true,
  };
}

/** キャラ対ページに表示する外部リンク一覧を組み立てる。 */
export function buildExternalLinks(character: Pick<Character, "slug">): ExternalLink[] {
  return [
    { label: "UFD（フレームデータ元）", url: ufdCharacterUrl(character) },
    pheasantzeldaCharacterLink(character),
  ];
}
