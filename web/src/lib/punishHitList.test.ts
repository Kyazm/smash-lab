import { describe, it, expect } from "vitest";
import { hitKey, perfectShieldOnlyHits, mergeForDisplay } from "./punishHitList";
import type { PunishHit, OosCandidate } from "./punish";

function hit(partial: Partial<OosCandidate> & Pick<OosCandidate, "startup" | "extraFrames" | "oosType">, effectiveStartup: number, slackFrames = 0): PunishHit {
  const candidate: OosCandidate = { label: partial.oosType, ...partial };
  return { candidate, effectiveStartup, slackFrames };
}

describe("hitKey", () => {
  it("同じcandidate.id+oosTypeは同じキーになる", () => {
    const a = hit({ id: "x", startup: 1, extraFrames: 0, oosType: "up_b" }, 1);
    const b = hit({ id: "x", startup: 1, extraFrames: 0, oosType: "up_b" }, 1);
    expect(hitKey(a)).toBe(hitKey(b));
  });

  it("同じidでもoosTypeが違えばキーが異なる", () => {
    const a = hit({ id: "x", startup: 1, extraFrames: 0, oosType: "up_b" }, 1);
    const b = hit({ id: "x", startup: 1, extraFrames: 11, oosType: "shield_drop" }, 1);
    expect(hitKey(a)).not.toBe(hitKey(b));
  });
});

describe("perfectShieldOnlyHits（ジャスガ限定行の判定）", () => {
  it("通常ガードで既に確定している行はジャスガ限定に含めない", () => {
    const normalHit = hit({ id: "a", startup: 3, extraFrames: 0, oosType: "up_b" }, 3);
    const hits = [normalHit];
    const perfectHits = [normalHit]; // 通常でもジャスガでも同じ行
    expect(perfectShieldOnlyHits(hits, perfectHits)).toHaveLength(0);
  });

  it("通常では確定せずジャスガでのみ確定するshield_drop行を抽出する", () => {
    const hits: PunishHit[] = [];
    const shieldDropHit = hit(
      { id: "shield-drop:m1", startup: 8, extraFrames: 0, oosType: "shield_drop", label: "ガード解除→横強" },
      8,
      2,
    );
    const result = perfectShieldOnlyHits(hits, [shieldDropHit]);
    expect(result).toHaveLength(1);
    expect(result[0].candidate.label).toBe("ガード解除→横強");
  });

  it("直接OoSが通常/ジャスガ双方で確定していても差分に出てこない（不変のはず）", () => {
    const upB = hit({ id: "upb", startup: 3, extraFrames: 0, oosType: "up_b" }, 3);
    expect(perfectShieldOnlyHits([upB], [upB])).toHaveLength(0);
  });
});

describe("mergeForDisplay", () => {
  const normalHit = hit({ id: "a", startup: 3, extraFrames: 0, oosType: "up_b", label: "上B" }, 3, 5);
  const shieldDropOnly = hit(
    { id: "shield-drop:m1", startup: 8, extraFrames: 0, oosType: "shield_drop", label: "ガード解除→横強" },
    8,
    2,
  );

  it("includePerfectShield=false のときジャスガ限定行を含めない", () => {
    const result = mergeForDisplay([normalHit], [normalHit, shieldDropOnly], false);
    expect(result).toHaveLength(1);
    expect(result[0].perfectShieldOnly).toBe(false);
  });

  it("includePerfectShield=true のときジャスガ限定行を末尾に追加しperfectShieldOnly=trueにする", () => {
    const result = mergeForDisplay([normalHit], [normalHit, shieldDropOnly], true);
    expect(result).toHaveLength(2);
    const flagged = result.find((d) => d.hit.candidate.label === "ガード解除→横強");
    expect(flagged?.perfectShieldOnly).toBe(true);
    const normal = result.find((d) => d.hit.candidate.label === "上B");
    expect(normal?.perfectShieldOnly).toBe(false);
  });

  it("実効発生の昇順でソートされる", () => {
    const fast = hit({ id: "f", startup: 2, extraFrames: 0, oosType: "up_b", label: "上B" }, 2);
    const slow = hit({ id: "s", startup: 9, extraFrames: 0, oosType: "grab", label: "掴み" }, 9);
    const result = mergeForDisplay([slow, fast], [], false);
    expect(result.map((d) => d.hit.effectiveStartup)).toEqual([2, 9]);
  });
});
