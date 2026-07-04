import { describe, expect, it } from "vitest";
import {
  CHARACTER_GROUPS,
  groupForSlug,
  isRepresentativeSlug,
  makeGroupResolver,
} from "./characterGroups";

const CHARS = [
  { id: "id-squirtle", slug: "pt_squirtle", name_ja: "ゼニガメ" },
  { id: "id-ivysaur", slug: "pt_ivysaur", name_ja: "フシギソウ" },
  { id: "id-charizard", slug: "pt_charizard", name_ja: "リザードン" },
  { id: "id-pyra", slug: "pyra", name_ja: "ホムラ" },
  { id: "id-mythra", slug: "mythra", name_ja: "ヒカリ" },
  { id: "id-mario", slug: "mario", name_ja: "マリオ" },
];

describe("groupForSlug", () => {
  it("ポケトレ各ファイターは同一グループ", () => {
    expect(groupForSlug("pt_ivysaur")?.key).toBe("pokemon_trainer");
    expect(groupForSlug("pt_charizard")?.key).toBe("pokemon_trainer");
  });
  it("ホムラ/ヒカリは aegis グループ", () => {
    expect(groupForSlug("mythra")?.displayName).toBe("ホムラ/ヒカリ");
  });
  it("非グループキャラは undefined", () => {
    expect(groupForSlug("mario")).toBeUndefined();
    expect(groupForSlug(undefined)).toBeUndefined();
  });
});

describe("isRepresentativeSlug", () => {
  it("代表のみ true", () => {
    expect(isRepresentativeSlug("pt_squirtle")).toBe(true);
    expect(isRepresentativeSlug("pt_ivysaur")).toBe(false);
    expect(isRepresentativeSlug("pyra")).toBe(true);
    expect(isRepresentativeSlug("mythra")).toBe(false);
    expect(isRepresentativeSlug("mario")).toBe(false);
  });
});

describe("makeGroupResolver", () => {
  const r = makeGroupResolver(CHARS);
  it("メンバーidは代表idへ正規化", () => {
    expect(r.normalizeId("id-ivysaur")).toBe("id-squirtle");
    expect(r.normalizeId("id-charizard")).toBe("id-squirtle");
    expect(r.normalizeId("id-mythra")).toBe("id-pyra");
  });
  it("非グループidはそのまま", () => {
    expect(r.normalizeId("id-mario")).toBe("id-mario");
  });
  it("表示名はグループ名/キャラ名", () => {
    expect(r.displayNameForId("id-charizard")).toBe("ポケモントレーナー");
    expect(r.displayNameForId("id-mario")).toBe("マリオ");
  });
});

describe("CHARACTER_GROUPS 整合", () => {
  it("代表は必ずメンバーに含まれる", () => {
    for (const g of CHARACTER_GROUPS) {
      expect(g.members.some((m) => m.slug === g.representativeSlug)).toBe(true);
    }
  });
});
