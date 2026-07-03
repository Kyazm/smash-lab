import { describe, expect, it } from "vitest";
import { extractTokens, verifyTokensPreserved } from "../src/lib/verify-tokens.js";

describe("extractTokens", () => {
  it("数値トークン（%・F・フレーム）を抽出する", () => {
    const tokens = extractTokens("上スマは30%からコンボ。ガード硬直差-6F、発生12フレーム。");
    expect(tokens.numeric).toContain("30%");
    expect(tokens.numeric).toContain("6F");
    expect(tokens.numeric).toContain("12フレーム");
  });

  it("技名らしきカタカナトークンを抽出する", () => {
    const tokens = extractTokens("ネスのPKファイアは差し込みが強い。上スマッシュも警戒。");
    expect(tokens.moveLike.some((t) => t.includes("ネス"))).toBe(true);
    expect(tokens.moveLike.some((t) => t.includes("ファイア"))).toBe(true);
  });

  it("スマブラ用語パターン（上B/空前等）を抽出する", () => {
    const tokens = extractTokens("復帰は上Bのみ。崖端は空前で潰せる。横Bも警戒。");
    expect(tokens.moveLike).toContain("上B");
    expect(tokens.moveLike).toContain("空前");
    expect(tokens.moveLike).toContain("横B");
  });
});

describe("verifyTokensPreserved", () => {
  it("すべてのトークンが保持されていれば ok=true", () => {
    const original = "上スマは30%から。発生12Fで早い。";
    const proposed = "## ニュートラル\n- 上スマは30%から連携可能 (2023-06)\n- 発生12Fと早い技";
    const result = verifyTokensPreserved(original, proposed);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("数値トークンが欠落していれば ok=false で missing に含まれる", () => {
    const original = "上スマは30%から連携可能。発生12Fで早い。";
    const proposed = "## ニュートラル\n- 上スマは連携可能\n- 発生が早い技";
    const result = verifyTokensPreserved(original, proposed);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(["30%", "12F"]));
  });

  it("技名トークンが欠落していれば ok=false", () => {
    const original = "ネスのPKファイアは差し込みが強い。";
    const proposed = "## ニュートラル\n- 差し込みが強い技がある";
    const result = verifyTokensPreserved(original, proposed);
    expect(result.ok).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("重複トークンは missing に重複して入らない", () => {
    const original = "30%から30%まで伸びる連携。";
    const proposed = "何も保持しない提案";
    const result = verifyTokensPreserved(original, proposed);
    expect(result.missing.filter((t) => t === "30%").length).toBe(1);
  });

  it("空文字同士は ok=true", () => {
    const result = verifyTokensPreserved("", "");
    expect(result.ok).toBe(true);
  });
});
