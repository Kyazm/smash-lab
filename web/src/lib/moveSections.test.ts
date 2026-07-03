import { describe, expect, it } from "vitest";
import { groupMovesBySection, sectionForCategory, MOVE_SECTIONS } from "./moveSections";
import type { Move } from "../types";

function move(overrides: Partial<Move> & Pick<Move, "id" | "category">): Move {
  return {
    character_id: "c1",
    slug: overrides.id,
    name_en: null,
    name_ja: overrides.id,
    startup: 1,
    active: "1",
    faf: 10,
    on_shield: -5,
    damage: 1,
    notes: null,
    hitbox_img_url: null,
    ...overrides,
  };
}

describe("sectionForCategory", () => {
  it("maps ground-ish categories to ground", () => {
    expect(sectionForCategory("jab")).toBe("ground");
    expect(sectionForCategory("dash")).toBe("ground");
    expect(sectionForCategory("tilt")).toBe("ground");
    expect(sectionForCategory("smash")).toBe("ground");
  });
  it("maps aerial/special/dodge 1:1", () => {
    expect(sectionForCategory("aerial")).toBe("aerial");
    expect(sectionForCategory("special")).toBe("special");
    expect(sectionForCategory("dodge")).toBe("dodge");
  });
  it("maps grab+throw to grab section", () => {
    expect(sectionForCategory("grab")).toBe("grab");
    expect(sectionForCategory("throw")).toBe("grab");
  });
});

describe("groupMovesBySection", () => {
  it("groups moves in MOVE_SECTIONS order and omits empty sections", () => {
    const moves = [
      move({ id: "jab1", category: "jab" }),
      move({ id: "fair", category: "aerial" }),
      move({ id: "grab1", category: "grab" }),
    ];
    const grouped = groupMovesBySection(moves);
    expect(grouped.map((g) => g.section.key)).toEqual(["ground", "aerial", "grab"]);
    expect(grouped[0].moves).toHaveLength(1);
  });

  it("returns empty array for no moves", () => {
    expect(groupMovesBySection([])).toEqual([]);
  });

  it("covers all defined sections", () => {
    expect(MOVE_SECTIONS.map((s) => s.key)).toEqual([
      "ground",
      "aerial",
      "special",
      "grab",
      "dodge",
    ]);
  });
});
