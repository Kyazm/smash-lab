import { describe, it, expect } from "vitest";
import {
  defensivePunish,
  offensiveSafety,
  type OosCandidate,
  type ShieldedMove,
} from "./punish";

// docs/02 の extra_frames 定義: aerial +3 / up_b|up_smash +0 / grab +4 / shield_drop +11
const oos = (
  partial: Partial<OosCandidate> & Pick<OosCandidate, "startup" | "extraFrames" | "oosType">,
): OosCandidate => ({ label: partial.oosType, ...partial });

describe("defensivePunish（守り）", () => {
  it("on_shield >= 0（正値）は反撃不可を返す", () => {
    const move: ShieldedMove = { onShield: 3 };
    const r = defensivePunish(move, [oos({ startup: 3, extraFrames: 0, oosType: "up_smash" })]);
    expect(r.canPunish).toBe(false);
    if (!r.canPunish) {
      expect(r.reason).toBe("safe_on_shield");
      expect(r.disadvantageFrames).toBe(0);
    }
  });

  it("on_shield = 0 ちょうどは反撃不可（境界）", () => {
    const r = defensivePunish({ onShield: 0 }, [oos({ startup: 3, extraFrames: 0, oosType: "up_b" })]);
    expect(r.canPunish).toBe(false);
  });

  it("不利F = -on_shield を返す", () => {
    const r = defensivePunish({ onShield: -12 }, []);
    expect(r.canPunish).toBe(true);
    if (r.canPunish) expect(r.disadvantageFrames).toBe(12);
  });

  it("猶予0F（実効発生 == 不利F）は確定に含む（境界）", () => {
    // 不利F=8, up_smash 発生8 + extra 0 = 実効発生8 → 猶予0F
    const r = defensivePunish({ onShield: -8 }, [
      oos({ startup: 8, extraFrames: 0, oosType: "up_smash", label: "上スマ" }),
    ]);
    expect(r.canPunish).toBe(true);
    if (r.canPunish) {
      expect(r.hits).toHaveLength(1);
      expect(r.hits[0].effectiveStartup).toBe(8);
      expect(r.hits[0].slackFrames).toBe(0);
    }
  });

  it("実効発生 > 不利F は除外（境界の外側）", () => {
    // 不利F=7, 実効発生8 → 除外
    const r = defensivePunish({ onShield: -7 }, [
      oos({ startup: 8, extraFrames: 0, oosType: "up_smash" }),
    ]);
    expect(r.canPunish).toBe(true);
    if (r.canPunish) expect(r.hits).toHaveLength(0);
  });

  it("extra_frames が判定を変える: aerial(+3) は startup 単体では確定でも +3 で除外される", () => {
    // 不利F=8。空N 発生6 → startup単体なら確定だが +3=9 で実効発生9 > 8 → 除外
    const r = defensivePunish({ onShield: -8 }, [
      oos({ startup: 6, extraFrames: 3, oosType: "aerial", label: "空N" }),
    ]);
    expect(r.canPunish).toBe(true);
    if (r.canPunish) expect(r.hits).toHaveLength(0); // extra_frames を確かに加算している証拠
  });

  it("aerial(+3) は不利Fが十分なら確定し、実効発生に +3 が乗る", () => {
    const r = defensivePunish({ onShield: -10 }, [
      oos({ startup: 6, extraFrames: 3, oosType: "aerial", label: "空N" }),
    ]);
    expect(r.canPunish).toBe(true);
    if (r.canPunish) {
      expect(r.hits).toHaveLength(1);
      expect(r.hits[0].effectiveStartup).toBe(9); // 6 + 3
      expect(r.hits[0].slackFrames).toBe(1); // 10 - 9
    }
  });

  it("shield_drop(+11) は大きな追加Fで確定しにくい（UIデフォルト非表示対象）", () => {
    // 不利F=12。掴み発生6 だが shield_drop +11 = 実効発生17 > 12 → 除外
    const r = defensivePunish({ onShield: -12 }, [
      oos({ startup: 6, extraFrames: 11, oosType: "shield_drop", label: "ダッシュ掴み" }),
    ]);
    expect(r.canPunish).toBe(true);
    if (r.canPunish) expect(r.hits).toHaveLength(0);
  });

  it("複数候補を実効発生の昇順で返す", () => {
    const r = defensivePunish({ onShield: -16 }, [
      oos({ startup: 12, extraFrames: 0, oosType: "up_smash", label: "上スマ" }), // 12
      oos({ startup: 3, extraFrames: 0, oosType: "up_b", label: "上B" }), // 3
      oos({ startup: 6, extraFrames: 4, oosType: "grab", label: "掴み" }), // 10
      oos({ startup: 6, extraFrames: 3, oosType: "aerial", label: "空N" }), // 9
    ]);
    expect(r.canPunish).toBe(true);
    if (r.canPunish) {
      expect(r.hits.map((h) => h.effectiveStartup)).toEqual([3, 9, 10, 12]);
      expect(r.hits.map((h) => h.candidate.label)).toEqual(["上B", "空N", "掴み", "上スマ"]);
      // 猶予F = 不利F - 実効発生
      expect(r.hits.map((h) => h.slackFrames)).toEqual([13, 7, 6, 4]);
    }
  });

  it("range_note と oosType は候補に保持される", () => {
    const r = defensivePunish({ onShield: -10 }, [
      oos({ startup: 3, extraFrames: 0, oosType: "up_b", label: "上B", rangeNote: "密着限定" }),
    ]);
    expect(r.canPunish).toBe(true);
    if (r.canPunish) {
      expect(r.hits[0].candidate.rangeNote).toBe("密着限定");
      expect(r.hits[0].candidate.oosType).toBe("up_b");
    }
  });

  describe("isPerfectShield（ジャストシールド, FU-3）", () => {
    it("shield_drop候補は実効発生が11F短縮され、通常なら確定しないものが確定する", () => {
      // 不利F=10。ガード解除→横強: startup8+extra11=19（通常は除外）。
      // ジャスガ時は 19-11=8 <= 10 → 確定
      const candidate = oos({
        startup: 8,
        extraFrames: 11,
        oosType: "shield_drop",
        label: "ガード解除→横強",
      });
      const normal = defensivePunish({ onShield: -10 }, [candidate]);
      const perfect = defensivePunish({ onShield: -10 }, [candidate], true);

      expect(normal.canPunish).toBe(true);
      if (normal.canPunish) expect(normal.hits).toHaveLength(0);

      expect(perfect.canPunish).toBe(true);
      if (perfect.canPunish) {
        expect(perfect.hits).toHaveLength(1);
        expect(perfect.hits[0].effectiveStartup).toBe(8);
        expect(perfect.hits[0].slackFrames).toBe(2);
      }
    });

    it("直接OoS（aerial/up_b/up_smash/grab）はisPerfectShieldでも実効発生が不変", () => {
      const candidates = [
        oos({ startup: 6, extraFrames: 3, oosType: "aerial", label: "空N" }),
        oos({ startup: 3, extraFrames: 0, oosType: "up_b", label: "上B" }),
        oos({ startup: 3, extraFrames: 0, oosType: "up_smash", label: "上スマ" }),
        oos({ startup: 6, extraFrames: 4, oosType: "grab", label: "掴み" }),
      ];
      const normal = defensivePunish({ onShield: -16 }, candidates);
      const perfect = defensivePunish({ onShield: -16 }, candidates, true);

      expect(normal.canPunish).toBe(true);
      expect(perfect.canPunish).toBe(true);
      if (normal.canPunish && perfect.canPunish) {
        const normalMap = new Map(normal.hits.map((h) => [h.candidate.label, h.effectiveStartup]));
        const perfectMap = new Map(perfect.hits.map((h) => [h.candidate.label, h.effectiveStartup]));
        expect(perfectMap).toEqual(normalMap);
      }
    });

    it("デフォルト（省略時）はisPerfectShield=falseと同じ挙動", () => {
      const candidate = oos({ startup: 8, extraFrames: 11, oosType: "shield_drop", label: "x" });
      const withoutArg = defensivePunish({ onShield: -10 }, [candidate]);
      const withFalse = defensivePunish({ onShield: -10 }, [candidate], false);
      expect(withoutArg).toEqual(withFalse);
    });

    it("offensiveSafetyでも同様にshield_dropのみ11F短縮される", () => {
      const candidate = oos({
        startup: 8,
        extraFrames: 11,
        oosType: "shield_drop",
        label: "ガード解除→横強",
      });
      const normal = offensiveSafety({ onShield: -10 }, [candidate]);
      const perfect = offensiveSafety({ onShield: -10 }, [candidate], true);

      expect(normal.safe).toBe(true); // 通常は確定しない=安全
      expect(perfect.safe).toBe(false); // ジャスガでは確定する
      if (!perfect.safe) {
        expect(perfect.punishedBy).toHaveLength(1);
        expect(perfect.punishedBy[0].effectiveStartup).toBe(8);
      }
    });
  });
});

describe("offensiveSafety（攻め）", () => {
  it("on_shield = 0 は安全（境界）", () => {
    const r = offensiveSafety({ onShield: 0 }, [oos({ startup: 3, extraFrames: 0, oosType: "up_b" })]);
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.reason).toBe("safe_on_shield");
      expect(r.punishedBy).toHaveLength(0);
    }
  });

  it("on_shield 正値は安全", () => {
    const r = offensiveSafety({ onShield: 2 }, [oos({ startup: 3, extraFrames: 0, oosType: "up_smash" })]);
    expect(r.safe).toBe(true);
  });

  it("不利Fはあるが相手OoSで確定しなければ安全(no_punish)、不利Fは保持", () => {
    // 不利F=3。相手最速OoS 上B発生5 > 3 → 反撃なし
    const r = offensiveSafety({ onShield: -3 }, [
      oos({ startup: 5, extraFrames: 0, oosType: "up_b", label: "上B" }),
    ]);
    expect(r.safe).toBe(true);
    if (r.safe) {
      expect(r.reason).toBe("no_punish");
      expect(r.disadvantageFrames).toBe(3);
    }
  });

  it("相手OoSで反撃確定するものを列挙して safe=false", () => {
    // 不利F=10。相手 上B発生3、上スマ発生12 → 上Bのみ確定
    const r = offensiveSafety({ onShield: -10 }, [
      oos({ startup: 3, extraFrames: 0, oosType: "up_b", label: "上B" }),
      oos({ startup: 12, extraFrames: 0, oosType: "up_smash", label: "上スマ" }),
    ]);
    expect(r.safe).toBe(false);
    if (!r.safe) {
      expect(r.disadvantageFrames).toBe(10);
      expect(r.punishedBy).toHaveLength(1);
      expect(r.punishedBy[0].candidate.label).toBe("上B");
      expect(r.punishedBy[0].effectiveStartup).toBe(3);
      expect(r.punishedBy[0].slackFrames).toBe(7);
    }
  });

  it("猶予0F（実効発生 == 不利F）で反撃確定（境界・攻め）", () => {
    const r = offensiveSafety({ onShield: -3 }, [
      oos({ startup: 3, extraFrames: 0, oosType: "up_b", label: "上B" }),
    ]);
    expect(r.safe).toBe(false);
    if (!r.safe) {
      expect(r.punishedBy).toHaveLength(1);
      expect(r.punishedBy[0].slackFrames).toBe(0);
    }
  });

  it("攻めでも実効発生の昇順で返す", () => {
    const r = offensiveSafety({ onShield: -15 }, [
      oos({ startup: 9, extraFrames: 3, oosType: "aerial", label: "空N" }), // 12
      oos({ startup: 3, extraFrames: 0, oosType: "up_b", label: "上B" }), // 3
    ]);
    expect(r.safe).toBe(false);
    if (!r.safe) {
      expect(r.punishedBy.map((h) => h.effectiveStartup)).toEqual([3, 12]);
    }
  });
});
