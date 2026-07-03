// 公開ライブラリ記事の定義。docs/*.md をビルド時に ?raw で取り込み（ネットワーク取得なし・オフラインOK）、
// 記事メタ（タイトル・説明）は各mdの先頭h1と直後の本文行から導出する（deriveArticleMeta・純関数・テスト対象）。
// これらは設計内向けの制作メモ/リサーチノートをそのまま公開するもの（個人ツールのため）。ArticlePage 冒頭に注記を添える。
import practiceScienceRaw from "../../../docs/05_practice-science.md?raw";
import researchFindingsRaw from "../../../docs/04_research-findings.md?raw";

export interface Article {
  slug: string;
  /** 導出済みタイトル（h1）。 */
  title: string;
  /** 導出済み説明（h1直後の最初の非空行）。 */
  description: string;
  /** 記事本文（Markdown 文字列）。 */
  body: string;
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
}

// 記事の並び順と slug は明示定義。タイトル・説明は本文h1から導出する。
const sources: ArticleSource[] = [
  { slug: "practice-science", raw: practiceScienceRaw },
  { slug: "research-findings", raw: researchFindingsRaw },
];

export const articles: Article[] = sources.map(({ slug, raw }) => {
  const { title, description } = deriveArticleMeta(raw);
  return { slug, title, description, body: raw };
});

export function getArticle(slug: string | undefined): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
