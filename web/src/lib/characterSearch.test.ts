import { describe, expect, it } from "vitest";
import { characterSearchScore, filterCharacters, isSubsequence, normalizeForSearch } from "./characterSearch";

interface TestChar {
  name_ja: string;
  name_en: string;
  slug: string;
  fighter_number: number;
}

const GANONDORF: TestChar = { name_ja: "ガノンドロフ", name_en: "Ganondorf", slug: "ganondorf", fighter_number: 39 };
const ZSS: TestChar = { name_ja: "ゼロスーツサムス", name_en: "Zero Suit Samus", slug: "zss", fighter_number: 40 };
const MARIO: TestChar = { name_ja: "マリオ", name_en: "Mario", slug: "mario", fighter_number: 1 };
const DR_MARIO: TestChar = { name_ja: "ドクターマリオ", name_en: "Dr. Mario", slug: "dr_mario", fighter_number: 22 };
const FOX: TestChar = { name_ja: "フォックス", name_en: "Fox", slug: "fox", fighter_number: 15 };

const ALL = [GANONDORF, ZSS, MARIO, DR_MARIO, FOX];

describe("normalizeForSearch", () => {
  it("カタカナをひらがな化する", () => {
    expect(normalizeForSearch("ガノンドロフ")).toBe("がのんどろふ");
  });
  it("長音ーは変換せずそのまま残す", () => {
    expect(normalizeForSearch("ゼロスーツサムス")).toBe("ぜろすーつさむす");
  });
  it("大文字小文字を無視する", () => {
    expect(normalizeForSearch("ZSS")).toBe("zss");
  });
  it("全角英数を半角に正規化する(NFKC)", () => {
    expect(normalizeForSearch("ＭＡＲＩＯ")).toBe("mario");
  });
  it("空白と「・」を除去する", () => {
    expect(normalizeForSearch("ドクター・マリオ")).toBe("どくたーまりお");
    expect(normalizeForSearch("Dr. Mario")).toBe("dr.mario");
    expect(normalizeForSearch("zero suit samus")).toBe("zerosuitsamus");
  });
});

describe("isSubsequence", () => {
  it("順序を保って全文字が現れれば真", () => {
    expect(isSubsequence("zss", "zerosuitsamus")).toBe(true);
  });
  it("順序が違えば偽", () => {
    expect(isSubsequence("sz", "zerosuitsamus")).toBe(false);
  });
  it("空needleは常に真", () => {
    expect(isSubsequence("", "anything")).toBe(true);
  });
});

describe("characterSearchScore", () => {
  it("「がのん」はガノンドロフに前方一致(0)する", () => {
    expect(characterSearchScore("がのん", GANONDORF)).toBe(0);
  });
  it("「ガノン」（カタカナ）でも同じ結果になる", () => {
    expect(characterSearchScore("ガノン", GANONDORF)).toBe(0);
  });
  it("「ぜろさむ」はゼロスーツサムスにサブシーケンス一致(2)する", () => {
    expect(characterSearchScore("ぜろさむ", ZSS)).toBe(2);
  });
  it("「zss」はZero Suit Samusにマッチする（slugが完全一致するため最良スコアは前方一致0）", () => {
    expect(characterSearchScore("zss", ZSS)).toBe(0);
  });
  it("英語名(Zero Suit Samus)単体に対しては「zss」はサブシーケンス一致になる", () => {
    expect(isSubsequence(normalizeForSearch("zss"), normalizeForSearch(ZSS.name_en))).toBe(true);
  });
  it("不一致はnull", () => {
    expect(characterSearchScore("ぷりん", GANONDORF)).toBeNull();
  });
});

describe("filterCharacters", () => {
  it("「mario」でマリオがドクターマリオより上位に来る（前方一致優先）", () => {
    const result = filterCharacters("mario", ALL);
    const slugs = result.map((c) => c.slug);
    expect(slugs.indexOf("mario")).toBeLessThan(slugs.indexOf("dr_mario"));
  });
  it("空クエリは全件をそのまま返す", () => {
    expect(filterCharacters("", ALL)).toBe(ALL);
    expect(filterCharacters("   ", ALL)).toBe(ALL);
  });
  it("ヒットなしケースは空配列", () => {
    expect(filterCharacters("ぷりん", ALL)).toEqual([]);
  });
  it("同ランク内はfighter_number昇順", () => {
    // fox(15) と ganondorf(39) はどちらも "o" を含む/部分一致するがランクが違うため、
    // 同ランクでの並びは name_ja に "ん" を含み前方一致しない語で検証する。
    const result = filterCharacters("o", [MARIO, FOX, GANONDORF, ZSS, DR_MARIO]);
    // "o" は mario(前方一致ではない・部分一致), fox(部分一致), ganondorf(部分一致) 等に部分一致するはず。
    // 同スコア内は fighter_number 昇順であることだけを検証する。
    const partialMatches = result.filter((c) => characterSearchScore("o", c) === 1);
    for (let i = 1; i < partialMatches.length; i++) {
      expect(partialMatches[i - 1].fighter_number).toBeLessThanOrEqual(partialMatches[i].fighter_number);
    }
  });
});
