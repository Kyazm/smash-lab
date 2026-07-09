// 公開ライブラリ記事の定義。docs/*.md をビルド時に ?raw で取り込み（ネットワーク取得なし・オフラインOK）、
// 記事メタ（タイトル・説明）は各mdの先頭h1と直後の本文行から導出する（deriveArticleMeta・純関数・テスト対象）。
// これらは設計内向けの制作メモ/リサーチノートをそのまま公開するもの（個人ツールのため）。ArticlePage 冒頭に注記を添える。
import practiceScienceRaw from "../../../docs/05_practice-science.md?raw";
import researchFindingsRaw from "../../../docs/04_research-findings.md?raw";
import mentalGameRaw from "../../../docs/10_mental-game.md?raw";
import practiceFocusRaw from "../../../docs/11_practice-focus.md?raw";
import matchReviewHowtoRaw from "../../../docs/articles/match-review-howto.md?raw";
import stateTransitionsRaw from "../../../docs/articles/state-transitions.md?raw";
import survivingAndPercentRaw from "../../../docs/articles/surviving-and-percent.md?raw";

export interface Article {
  slug: string;
  /** 導出済みタイトル（h1）。 */
  title: string;
  /** 導出済み説明（h1直後の最初の非空行）。 */
  description: string;
  /** 記事本文（Markdown 文字列）。 */
  body: string;
  /** guide=読者向け実践ガイド（docs/articles/） / note=設計根拠を兼ねる制作メモ（docs/NN_*.md）。noteのみ本文冒頭に注記を出す。 */
  kind: "guide" | "note";
}

/** Markdown 文字列から記事メタ（h1タイトル + 直後の説明行）を導出する純関数。 */
export function deriveArticleMeta(md: string): { title: string; description: string } {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  let title = "";
  let titleIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.+?)\s*$/);
    if (m) {
      title = m[1].trim();
      titleIdx = i;
      break;
    }
  }
  let description = "";
  // h1が見つからない場合は説明も導出しない（本文をタイトル無し記事の説明に流用しない）。
  if (titleIdx === -1) return { title, description };
  for (let i = titleIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "") continue;
    // 見出し行は説明に採用しない（本文の導入文を優先）。
    if (/^#{1,6}\s+/.test(t)) break;
    description = t;
    break;
  }
  return { title, description };
}

interface ArticleSource {
  slug: string;
  raw: string;
  kind: Article["kind"];
}

// 記事の並び順と slug は明示定義。タイトル・説明は本文h1から導出する。
// 並びは読む順を意図: 試合の振り返り方(実践入口) → 状態遷移(立ち回りの見方) → 撃墜拒否と%管理(実践) →
//   練習科学(基礎) → 練習と集中(深掘り) → メンタル → 開発リサーチノート。
const sources: ArticleSource[] = [
  { slug: "match-review-howto", raw: matchReviewHowtoRaw, kind: "guide" },
  { slug: "state-transitions", raw: stateTransitionsRaw, kind: "guide" },
  { slug: "surviving-and-percent", raw: survivingAndPercentRaw, kind: "guide" },
  { slug: "practice-science", raw: practiceScienceRaw, kind: "note" },
  { slug: "practice-focus", raw: practiceFocusRaw, kind: "note" },
  { slug: "mental-game", raw: mentalGameRaw, kind: "note" },
  { slug: "research-findings", raw: researchFindingsRaw, kind: "note" },
];

export const articles: Article[] = sources.map(({ slug, raw, kind }) => {
  const { title, description } = deriveArticleMeta(raw);
  return { slug, title, description, body: raw, kind };
});

export function getArticle(slug: string | undefined): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
