import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderMarkdown } from "./markdown";

function html(md: string): string {
  return renderToStaticMarkup(<>{renderMarkdown(md)}</>);
}

describe("renderMarkdown tables (GFM)", () => {
  it("ヘッダ行+区切り行+本文行を<table>に変換する", () => {
    const md = ["| A | B |", "|---|---|", "| 1 | 2 |", "| 3 | 4 |"].join("\n");
    const out = html(md);
    expect(out).toContain("<table");
    expect(out).toContain("<th");
    expect(out).toContain("<td");
    expect(out).toContain("A");
    expect(out).toContain("B");
    expect(out).toContain("1");
    expect(out).toContain("4");
  });

  it("表内セルの太字インラインを描画する", () => {
    const md = ["| 見出し |", "|---|", "| **強調** |"].join("\n");
    const out = html(md);
    expect(out).toContain("<strong>強調</strong>");
  });

  it("区切り行が無ければ表にしない（パイプ行は段落扱い）", () => {
    const md = "| A | B |\n本文";
    const out = html(md);
    expect(out).not.toContain("<table");
  });

  it("水平線(---)は表と誤認せずhrになる", () => {
    const out = html("段落\n\n---\n\n次の段落");
    expect(out).toContain("<hr");
    expect(out).not.toContain("<table");
  });
});
