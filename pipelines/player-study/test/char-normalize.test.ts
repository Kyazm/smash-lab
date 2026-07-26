import { describe, expect, it } from "vitest";
import {
  isKnownChar,
  normKey,
  normalizeChar,
  splitAndNormalizeChars,
} from "../src/lib/char-normalize.js";

describe("normalizeChar 別名正規化", () => {
  it("ZSS / Zero Suit Samus → ゼロスーツサムス", () => {
    expect(normalizeChar("ZSS")).toBe("ゼロスーツサムス");
    expect(normalizeChar("Zero Suit Samus")).toBe("ゼロスーツサムス");
    expect(normalizeChar("zero suit samus")).toBe("ゼロスーツサムス");
  });

  it("表記揺れ（R.O.B / ROB、K. Rool / King K. Rool、Mr. Game and Watch）", () => {
    expect(normalizeChar("R.O.B")).toBe("ロボット");
    expect(normalizeChar("ROB")).toBe("ロボット");
    expect(normalizeChar("K. Rool")).toBe("キングクルール");
    expect(normalizeChar("King K. Rool")).toBe("キングクルール");
    expect(normalizeChar("Mr. Game and Watch")).toBe("Mr.ゲーム&ウォッチ");
    expect(normalizeChar("GnW")).toBe("Mr.ゲーム&ウォッチ");
  });

  it("正準日本語名はそのまま引ける", () => {
    expect(normalizeChar("ゼロスーツサムス")).toBe("ゼロスーツサムス");
    expect(normalizeChar("むらびと")).toBe("むらびと");
  });

  it("未知の表記はトリム済み原文を返す（ドロップしない）", () => {
    expect(normalizeChar("  UnknownFighter  ")).toBe("UnknownFighter");
    expect(normalizeChar("")).toBe("");
  });

  it("isKnownChar", () => {
    expect(isKnownChar("ZSS")).toBe(true);
    expect(isKnownChar("Nonexistent")).toBe(false);
  });

  it("normKey は記号除去・&→and・小文字化", () => {
    expect(normKey("R.O.B")).toBe("rob");
    expect(normKey("Mr. Game & Watch")).toBe("mrgameandwatch");
  });
});

describe("splitAndNormalizeChars 複数キャラ", () => {
  it("(K. Rool, Kazuya) を配列へ分割・正規化", () => {
    expect(splitAndNormalizeChars("K. Rool, Kazuya")).toEqual(["キングクルール", "カズヤ"]);
  });

  it("スラッシュ区切りも分割（未知の組）", () => {
    expect(splitAndNormalizeChars("Fox / Falco")).toEqual(["フォックス", "ファルコ"]);
  });

  it("既知の単一キャラ（内部に区切りを含む Pyra/Mythra）は分割しない", () => {
    expect(splitAndNormalizeChars("Pyra/Mythra")).toEqual(["ホムラ/ヒカリ"]);
  });

  it("単一キャラは1要素配列", () => {
    expect(splitAndNormalizeChars("Shulk")).toEqual(["シュルク"]);
  });

  it("空文字は空配列", () => {
    expect(splitAndNormalizeChars("  ")).toEqual([]);
  });
});
