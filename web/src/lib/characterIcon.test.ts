import { describe, it, expect } from "vitest";
import { iconUrl } from "./characterIcon";
import charactersData from "../../../data/imported/characters.json";
import type { Character } from "../types";

const characters = charactersData as Character[];

describe("iconUrl", () => {
  it("主ソース(marcrd)に直接キーがある slug は stock-icons のURLを返す", () => {
    expect(iconUrl({ slug: "mario" })).toBe(
      "https://cdn.jsdelivr.net/gh/marcrd/smash-ultimate-assets@0.1.1/stock-icons/png/mario.png",
    );
    // 自キャラ ZSS も主ソース
    expect(iconUrl({ slug: "zero_suit_samus" })).toBe(
      "https://cdn.jsdelivr.net/gh/marcrd/smash-ultimate-assets@0.1.1/stock-icons/png/zero_suit_samus.png",
    );
  });

  it("Mii 3種は共通アイコン(mii_fighter)にエイリアスする", () => {
    const expected =
      "https://cdn.jsdelivr.net/gh/marcrd/smash-ultimate-assets@0.1.1/stock-icons/png/mii_fighter.png";
    expect(iconUrl({ slug: "mii_brawler" })).toBe(expected);
    expect(iconUrl({ slug: "mii_swordfighter" })).toBe(expected);
    expect(iconUrl({ slug: "mii_gunner" })).toBe(expected);
  });

  it("ポケモントレーナー分離キャラは副ソース(rubendal)にフォールバックする", () => {
    expect(iconUrl({ slug: "pt_charizard" })).toBe(
      "https://cdn.jsdelivr.net/gh/rubendal/ssbu@master/src/assets/img/characters/charizard.png",
    );
  });

  it("DLC(副ソース)はスペースを含むキーをURLエンコードする", () => {
    expect(iconUrl({ slug: "banjo_and_kazooie" })).toBe(
      "https://cdn.jsdelivr.net/gh/rubendal/ssbu@master/src/assets/img/characters/banjo%20kazooie.png",
    );
    expect(iconUrl({ slug: "minmin" })).toBe(
      "https://cdn.jsdelivr.net/gh/rubendal/ssbu@master/src/assets/img/characters/min%20min.png",
    );
    expect(iconUrl({ slug: "sora" })).toBe(
      "https://cdn.jsdelivr.net/gh/rubendal/ssbu@master/src/assets/img/characters/sora.png",
    );
  });

  it("未知の slug / 空 slug は null を返す（呼び出し側で頭文字チップ）", () => {
    expect(iconUrl({ slug: "unknown_fighter_999" })).toBeNull();
    expect(iconUrl({ slug: "" })).toBeNull();
  });

  it("characters.json 全89体が非nullのURLを持つ（全体カバレッジ）", () => {
    expect(characters).toHaveLength(89);
    const missing = characters.filter((c) => iconUrl(c) === null).map((c) => c.slug);
    expect(missing).toEqual([]);
  });

  it("返すURLは https の jsdelivr かつ .png で終わる", () => {
    for (const c of characters) {
      const url = iconUrl(c);
      expect(url).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/.+\.png$/);
    }
  });
});
