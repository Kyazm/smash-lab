import { describe, expect, it } from "vitest";
import { extractHeadings, extractPreviewLines, isLongNote } from "./notePreview";

describe("extractPreviewLines", () => {
  it("returns the first 2 non-empty lines, stripped of markdown decoration", () => {
    const body = "## 置き技\n横強・空前で相手の飛び込みを**置く**。\n\n- ダッシュから急に止まって様子見";
    expect(extractPreviewLines(body)).toEqual([
      "置き技",
      "横強・空前で相手の飛び込みを**置く**。",
    ]);
  });

  it("skips leading blank lines", () => {
    const body = "\n\n本文1行目\n本文2行目\n本文3行目";
    expect(extractPreviewLines(body)).toEqual(["本文1行目", "本文2行目"]);
  });

  it("returns fewer lines when body is short", () => {
    expect(extractPreviewLines("一行だけ")).toEqual(["一行だけ"]);
  });

  it("handles empty body", () => {
    expect(extractPreviewLines("")).toEqual([]);
  });
});

describe("extractHeadings", () => {
  it("extracts h1-h3 headings in order with level and index", () => {
    const body = "# 大見出し\n本文\n## 中見出し\n### 小見出し\n本文2";
    expect(extractHeadings(body)).toEqual([
      { level: 1, text: "大見出し", index: 0 },
      { level: 2, text: "中見出し", index: 1 },
      { level: 3, text: "小見出し", index: 2 },
    ]);
  });

  it("returns empty array when there are no headings", () => {
    expect(extractHeadings("ただの本文\n複数行")).toEqual([]);
  });
});

describe("isLongNote", () => {
  it("returns false for short notes", () => {
    expect(isLongNote("1行\n2行\n3行")).toBe(false);
  });

  it("returns true when exceeding the threshold", () => {
    const body = Array.from({ length: 13 }, (_, i) => `行${i}`).join("\n");
    expect(isLongNote(body)).toBe(true);
  });

  it("ignores blank lines when counting", () => {
    const body = Array.from({ length: 13 }, (_, i) => `行${i}\n\n`).join("\n");
    expect(isLongNote(body)).toBe(true);
  });
});
