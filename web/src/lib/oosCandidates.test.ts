import { describe, it, expect } from "vitest";
import { buildOosCandidates, buildShieldDropCandidates, toShieldedMove } from "./oosCandidates";
import type { Move, OosOption } from "../types";

// テスト用Moveビルダー。category/startup/slugだけ都度上書きすれば足りるので最小フィールドのみ必須にする。
function move(partial: Partial<Move> & Pick<Move, "id" | "category" | "startup" | "slug">): Move {
  return {
    character_id: "char-1",
    name_en: null,
    name_ja: null,
    active: null,
    faf: null,
    on_shield: null,
    damage: null,
    notes: null,
    hitbox_img_url: null,
    ...partial,
  };
}

describe("buildShieldDropCandidates（FU-3: shield_dropをmovesから生成）", () => {
  it("tilt/smash/dash の技を candidates として生成する（extraFrames=11, oosType=shield_drop）", () => {
    const moves = [
      move({ id: "m-tilt", category: "tilt", startup: 8, slug: "forward-tilt", name_ja: "横強" }),
      move({ id: "m-dash", category: "dash", startup: 6, slug: "dash-attack", name_ja: "ダッシュ攻撃" }),
      move({ id: "m-fsmash", category: "smash", startup: 15, slug: "forward-smash", name_ja: "横スマ" }),
    ];
    const candidates = buildShieldDropCandidates(moves);
    expect(candidates).toHaveLength(3);
    for (const c of candidates) {
      expect(c.extraFrames).toBe(11);
      expect(c.oosType).toBe("shield_drop");
    }
    expect(candidates.find((c) => c.startup === 8)?.label).toBe("ガード解除→横強");
  });

  it("slug==='up-smash' は除外する（上スマは直接OoSで既に出せるため重複させない）", () => {
    const moves = [
      move({ id: "m-usmash", category: "smash", startup: 17, slug: "up-smash", name_ja: "上スマ" }),
      move({ id: "m-dsmash", category: "smash", startup: 14, slug: "down-smash", name_ja: "下スマ" }),
    ];
    const candidates = buildShieldDropCandidates(moves);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].label).toBe("ガード解除→下スマ");
  });

  it("jab はそのキャラで最小startupの1つだけを候補にする（他の弱派生は無視）", () => {
    const moves = [
      move({ id: "m-jab1", category: "jab", startup: 2, slug: "jab-1", name_ja: "弱1" }),
      move({ id: "m-jab2", category: "jab", startup: 5, slug: "jab-2", name_ja: "弱2" }),
      move({ id: "m-rapid", category: "jab", startup: 3, slug: "rapid-jab", name_ja: "百裂攻撃" }),
    ];
    const candidates = buildShieldDropCandidates(moves);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].label).toBe("ガード解除→弱1");
    expect(candidates[0].startup).toBe(2);
  });

  it("jab/tilt/smash/dash 以外のカテゴリ（aerial/special/grab等）は候補にしない", () => {
    const moves = [
      move({ id: "m-nair", category: "aerial", startup: 6, slug: "neutral-air", name_ja: "空N" }),
      move({ id: "m-grab", category: "grab", startup: 8, slug: "grab", name_ja: "つかみ" }),
      move({ id: "m-special", category: "special", startup: 10, slug: "up-b", name_ja: "上B" }),
    ];
    expect(buildShieldDropCandidates(moves)).toHaveLength(0);
  });

  it("startupがnullの技は候補から除外する", () => {
    const moves = [move({ id: "m-dodge", category: "tilt", startup: null as unknown as number, slug: "x" })];
    expect(buildShieldDropCandidates(moves)).toHaveLength(0);
  });
});

describe("buildOosCandidates（shield_drop系oos_optionは無視し、moves生成のshield_dropに置き換える）", () => {
  it("oos_options内のshield_dropタイプは無視される（旧: 単一のダッシュ攻撃「ガード解除」行）", () => {
    const moves = [
      move({ id: "m-dash", category: "dash", startup: 6, slug: "dash-attack", name_ja: "ダッシュ攻撃" }),
      move({ id: "m-tilt", category: "tilt", startup: 8, slug: "forward-tilt", name_ja: "横強" }),
    ];
    const oosOptions: OosOption[] = [
      {
        id: "oos-1",
        move_id: "m-dash",
        oos_type: "shield_drop",
        extra_frames: 11,
        label: "ガード解除",
        range_note: null,
      },
    ];
    const candidates = buildOosCandidates(moves, oosOptions);
    // 旧仕様の汎用「ガード解除」ラベルは含まれない
    expect(candidates.some((c) => c.label === "ガード解除")).toBe(false);
    // 代わりにmovesから生成された具体技ラベルが並ぶ
    const labels = candidates.map((c) => c.label).sort();
    expect(labels).toEqual(["ガード解除→ダッシュ攻撃", "ガード解除→横強"]);
  });

  it("直接OoS（aerial/up_b/up_smash/grab）のoos_optionsはそのまま残る", () => {
    const moves = [move({ id: "m-upb", category: "special", startup: 3, slug: "up-b", name_ja: "上B" })];
    const oosOptions: OosOption[] = [
      { id: "oos-1", move_id: "m-upb", oos_type: "up_b", extra_frames: 0, label: "上B", range_note: "密着限定" },
    ];
    const candidates = buildOosCandidates(moves, oosOptions);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].oosType).toBe("up_b");
    expect(candidates[0].rangeNote).toBe("密着限定");
  });
});

describe("toShieldedMove", () => {
  it("on_shieldがnullなら0にフォールバックする", () => {
    const m = move({ id: "m-1", category: "tilt", startup: 8, slug: "x", on_shield: null });
    expect(toShieldedMove(m).onShield).toBe(0);
  });
});
