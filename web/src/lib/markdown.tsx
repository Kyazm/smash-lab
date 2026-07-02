// 最小 Markdown レンダラ（依存なし・XSS安全）。
// 対応: 見出し(#..###)、箇条書き(- / *)、番号付き(1.)、太字(**), インラインコード(`)、
//       水平線(---)、段落、改行。生HTMLは一切解釈しない（React要素として組み立てるためエスケープ不要）。
// リッチな記法は割り切って非対応（メモ用途に十分）。将来必要なら remark 等に差し替え可。
import type { ReactNode } from "react";

// インライン: **bold** と `code` のみ対応。< 等はReactが自動エスケープする。
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // **bold** と `code` を分割トークン化
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{tok.slice(2, -2)}</strong>);
    } else {
      nodes.push(
        <code key={`${keyPrefix}-c${i}`} className="rounded bg-slate-800 px-1 py-0.5 text-xs">
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Markdown 文字列を React 要素へ。ブロック単位で解釈する。 */
export function renderMarkdown(md: string): ReactNode {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listItems: { text: string; ordered: boolean }[] = [];
  let paragraph: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const ordered = listItems[0].ordered;
    const items = listItems.map((li, idx) => (
      <li key={`li-${key}-${idx}`}>{renderInline(li.text, `li-${key}-${idx}`)}</li>
    ));
    blocks.push(
      ordered ? (
        <ol key={`ol-${key}`} className="ml-5 list-decimal space-y-1">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${key}`} className="ml-5 list-disc space-y-1">
          {items}
        </ul>
      ),
    );
    key++;
    listItems = [];
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join("\n");
    blocks.push(
      <p key={`p-${key}`} className="whitespace-pre-wrap leading-relaxed">
        {renderInline(text, `p-${key}`)}
      </p>,
    );
    key++;
    paragraph = [];
  };

  for (const raw of lines) {
    const line = raw;
    // 水平線
    if (/^---+\s*$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(<hr key={`hr-${key}`} className="my-3 border-slate-700" />);
      key++;
      continue;
    }
    // 見出し
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushParagraph();
      flushList();
      const level = h[1].length;
      const cls =
        level === 1
          ? "mt-3 text-lg font-bold"
          : level === 2
            ? "mt-3 text-base font-bold"
            : "mt-2 text-sm font-semibold";
      const content = renderInline(h[2], `h-${key}`);
      blocks.push(
        level === 1 ? (
          <h3 key={`h-${key}`} className={cls}>
            {content}
          </h3>
        ) : level === 2 ? (
          <h4 key={`h-${key}`} className={cls}>
            {content}
          </h4>
        ) : (
          <h5 key={`h-${key}`} className={cls}>
            {content}
          </h5>
        ),
      );
      key++;
      continue;
    }
    // 箇条書き
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      flushParagraph();
      if (listItems.length && listItems[0].ordered) flushList();
      listItems.push({ text: ul[1], ordered: false });
      continue;
    }
    // 番号付き
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      flushParagraph();
      if (listItems.length && !listItems[0].ordered) flushList();
      listItems.push({ text: ol[1], ordered: true });
      continue;
    }
    // 空行 = 段落区切り
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    // 通常テキスト
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();

  return <div className="space-y-2 text-sm text-slate-200">{blocks}</div>;
}
