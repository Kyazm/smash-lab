import { describe, it, expect } from "vitest";
import { deriveArticleMeta, articles, getArticle } from "./articles";

describe("deriveArticleMeta", () => {
  it("先頭h1をタイトルに、直後の最初の非空行を説明に導出する", () => {
    const md = "# タイトルです\n\n最初の説明行。\n次の行。";
    expect(deriveArticleMeta(md)).toEqual({
      title: "タイトルです",
      description: "最初の説明行。",
    });
  });

  it("h1前に空行や本文があってもh1を拾う", () => {
    const md = "\n\n# 本当のタイトル\n説明。";
    expect(deriveArticleMeta(md).title).toBe("本当のタイトル");
  });

  it("h1直後が別の見出しなら説明は空", () => {
    const md = "# タイトル\n## セクション\n本文";
    expect(deriveArticleMeta(md)).toEqual({ title: "タイトル", description: "" });
  });

  it("h2(##)はタイトルに採用しない（h1のみ）", () => {
    const md = "## これはh2\n# これがh1\n説明";
    expect(deriveArticleMeta(md).title).toBe("これがh1");
  });

  it("CRLF改行を正規化して導出する", () => {
    const md = "# タイトル\r\n\r\n説明行\r\n";
    expect(deriveArticleMeta(md)).toEqual({ title: "タイトル", description: "説明行" });
  });

  it("h1が無ければタイトル・説明とも空", () => {
    expect(deriveArticleMeta("本文だけ\nもう一行")).toEqual({ title: "", description: "" });
  });

  it("空文字/undefinedでも例外を投げない", () => {
    expect(deriveArticleMeta("")).toEqual({ title: "", description: "" });
    expect(deriveArticleMeta(undefined as unknown as string)).toEqual({ title: "", description: "" });
  });
});

describe("articles（docs取り込み）", () => {
  it("4記事を読む順（基礎→深掘り→メンタル→開発ノート）で公開する", () => {
    expect(articles.map((a) => a.slug)).toEqual([
      "practice-science",
      "practice-focus",
      "mental-game",
      "research-findings",
    ]);
  });

  it("新規2記事もh1タイトルが導出される", () => {
    expect(getArticle("mental-game")?.title).toContain("メンタル");
    expect(getArticle("practice-focus")?.title).toContain("練習と集中");
  });

  it("各記事はh1由来のタイトルと非空の本文を持つ", () => {
    for (const a of articles) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.body.length).toBeGreaterThan(0);
    }
  });

  it("練習科学記事はh1タイトルが導出される", () => {
    const a = getArticle("practice-science");
    expect(a?.title).toContain("練習科学");
  });

  it("getArticle は未知slugでundefinedを返す", () => {
    expect(getArticle("nope")).toBeUndefined();
    expect(getArticle(undefined)).toBeUndefined();
  });
});
