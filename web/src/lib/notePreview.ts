// NoteCard デフォルト折りたたみ用の純粋関数（docs/06 A-3）。
//   - 冒頭2行のプレビュー抽出
//   - 展開時の日付/セクション見出しTOCチップ用に Markdown 見出し(#〜###)を抽出
export interface HeadingItem {
  level: 1 | 2 | 3;
  text: string;
  /** renderMarkdown 側の見出しは id を振っていないため、本文中の出現順インデックスで対応付ける */
  index: number;
}

/** body_md の先頭から空行を除いた最初の2行を返す（タイトル+メタで十分な情報量がある前提の短い要約）。 */
export function extractPreviewLines(bodyMd: string, maxLines = 2): string[] {
  const lines = bodyMd
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    // 見出し記号やリスト記号は装飾を剥がしてプレーンテキスト化
    .map((l) => l.replace(/^#{1,6}\s+/, "").replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""))
    .filter((l) => l !== "");
  return lines.slice(0, maxLines);
}

/** Markdown中の見出し(#〜###)を出現順に抽出する。 */
export function extractHeadings(bodyMd: string): HeadingItem[] {
  const lines = bodyMd.replace(/\r\n/g, "\n").split("\n");
  const headings: HeadingItem[] = [];
  let index = 0;
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.*)$/);
    if (m) {
      headings.push({ level: m[1].length as 1 | 2 | 3, text: m[2].trim(), index });
      index++;
    }
  }
  return headings;
}

/** 長文判定の閾値（この行数を超えたら展開時にTOCチップを出す）。 */
export const LONG_NOTE_LINE_THRESHOLD = 12;

export function isLongNote(bodyMd: string): boolean {
  return bodyMd.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "").length > LONG_NOTE_LINE_THRESHOLD;
}
