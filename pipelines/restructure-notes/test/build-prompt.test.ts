import { describe, expect, it } from "vitest";
import { buildRestructurePrompt, buildRetryPrompt } from "../src/lib/build-prompt.js";

describe("buildRestructurePrompt", () => {
  it("キャラ名・タイトル・本文を埋め込む", () => {
    const prompt = buildRestructurePrompt({
      characterName: "フォックス",
      title: "対フォックスメモ",
      bodyMd: "上スマは30%から連携可能。",
    });
    expect(prompt).toContain("フォックス");
    expect(prompt).toContain("対フォックスメモ");
    expect(prompt).toContain("上スマは30%から連携可能。");
  });

  it("キャラ名/タイトルが null の場合はプレースホルダになる", () => {
    const prompt = buildRestructurePrompt({ characterName: null, title: null, bodyMd: "本文" });
    expect(prompt).toContain("（不明）");
    expect(prompt).toContain("（無題）");
  });

  it("ADR-0010のルール（事実変更禁止・TL;DR構成・出典注記・⚠マーク）を含む", () => {
    const prompt = buildRestructurePrompt({ characterName: "ネス", title: "t", bodyMd: "b" });
    expect(prompt).toContain("事実の追加・削除・意味変更を禁止");
    expect(prompt).toContain("TL;DR");
    expect(prompt).toContain("ニュートラル");
    expect(prompt).toContain("不利状況");
    expect(prompt).toContain("復帰阻止");
    expect(prompt).toContain("撃墜・警戒");
    expect(prompt).toContain("その他");
    expect(prompt).toContain("(YYYY-MM)");
    expect(prompt).toContain("⚠");
    expect(prompt).toContain("attachment://");
  });
});

describe("buildRetryPrompt", () => {
  it("欠落トークンを追記する", () => {
    const prompt = buildRetryPrompt(
      { characterName: "フォックス", title: "t", bodyMd: "本文" },
      ["30%", "12F"],
    );
    expect(prompt).toContain("30%, 12F");
    expect(prompt).toContain("前回の出力で欠落");
  });
});
