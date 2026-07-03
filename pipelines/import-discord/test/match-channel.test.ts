import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isStarred,
  stripDecorations,
  matchCharacterSlug,
  matchMoveSlug,
  type CharacterLite,
  type MoveLite,
} from "../src/lib/match-channel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const characters: CharacterLite[] = JSON.parse(
  readFileSync(join(REPO_ROOT, "data", "imported", "characters.json"), "utf8"),
);
const allMoves = JSON.parse(
  readFileSync(join(REPO_ROOT, "data", "imported", "moves.json"), "utf8"),
);
const zss = characters.find((c) => (c as { slug: string }).slug === "zero_suit_samus") as unknown as { id: string };
const zssMoves: MoveLite[] = allMoves
  .filter((m: { character_id: string }) => m.character_id === zss.id)
  .map((m: { slug: string; name_ja: string | null; category: string }) => ({
    slug: m.slug,
    name_ja: m.name_ja,
    category: m.category,
  }));

describe("isStarred", () => {
  it("⭐ を検出", () => {
    expect(isStarred("7_フォックス対策⭐")).toBe(true);
    expect(isStarred("謎キャラ対策⭐")).toBe(true);
  });
  it("星なしは false", () => {
    expect(isStarred("50_ゲッコウガ対策")).toBe(false);
  });
});

describe("stripDecorations", () => {
  it("先頭番号プレフィックスと星を除去", () => {
    expect(stripDecorations("7_フォックス対策⭐")).toBe("フォックス対策");
    expect(stripDecorations("50_ゲッコウガ対策")).toBe("ゲッコウガ対策");
    expect(stripDecorations("29ゼロスーツサムスミラー")).toBe("ゼロスーツサムスミラー");
    expect(stripDecorations("4_サムス対策")).toBe("サムス対策");
  });
});

describe("matchCharacterSlug", () => {
  it("『7_フォックス対策⭐』→ fox", () => {
    expect(matchCharacterSlug("7_フォックス対策⭐", characters)).toBe("fox");
  });
  it("『50_ゲッコウガ対策』→ greninja", () => {
    expect(matchCharacterSlug("50_ゲッコウガ対策", characters)).toBe("greninja");
  });
  it("『4_サムス対策』は samus に一致（ダークサムスへ誤爆しない）", () => {
    expect(matchCharacterSlug("4_サムス対策", characters)).toBe("samus");
  });
  it("キャラ名を含む複合名（ゼロスーツサムスミラー）を最長一致で解決", () => {
    expect(matchCharacterSlug("29ゼロスーツサムスミラー", characters)).toBe("zero_suit_samus");
  });
  it("未知キャラ名は null", () => {
    expect(matchCharacterSlug("謎キャラ対策⭐", characters)).toBeNull();
  });
});

describe("matchMoveSlug", () => {
  it("『横b』→ side-b-plasma-whip", () => {
    expect(matchMoveSlug("横b", zssMoves)).toBe("side-b-plasma-whip");
  });
  it("『da』→ dash-attack", () => {
    expect(matchMoveSlug("da", zssMoves)).toBe("dash-attack");
  });
  it("『空後』→ back-air", () => {
    expect(matchMoveSlug("空後", zssMoves)).toBe("back-air");
  });
  it("『弱』→ jab-1", () => {
    expect(matchMoveSlug("弱", zssMoves)).toBe("jab-1");
  });
  it("『nb』→ neutral-b-paralyzer", () => {
    expect(matchMoveSlug("nb", zssMoves)).toBe("neutral-b-paralyzer");
  });
  it("name_ja 完全一致（横強）", () => {
    expect(matchMoveSlug("横強", zssMoves)).toBe("forward-tilt");
  });
  it("未知の技名は null（コンボ雑談 等）", () => {
    expect(matchMoveSlug("コンボ雑談", zssMoves)).toBeNull();
  });
});
