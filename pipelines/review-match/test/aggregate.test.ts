import { describe, expect, it } from "vitest";
import { aggregate, type AggregateContext } from "../src/lib/aggregate.js";
import type { ResultJson } from "../src/lib/schema.js";

function ctx(): AggregateContext {
  return {
    sceneWindows: [{ t_sec: 93, window: { start_sec: 68, end_sec: 98 } }],
    habitSlugs: new Set(["neutral", "recovery"]),
    focusPointIds: new Set(["fp-1"]),
  };
}

function result(): ResultJson {
  return {
    scenes: [
      {
        t_sec: 93,
        scene_summary: "s",
        findings: [
          {
            t_sec: 50, // 窓 [68,98] より前 → 68 にclamp
            situation: "disadvantage",
            observation: "o1",
            suggestion: "s1",
            habit_tag: "recovery",
            mistake_type: "decision",
            confidence: 0.7,
          },
          {
            t_sec: 200, // 窓より後 → 98 にclamp
            situation: "recovery",
            observation: "o2",
            suggestion: "s2",
            habit_tag: "made_up_tag", // 語彙外 → null 化 + needsReview
            mistake_type: "execution",
            confidence: 0.4,
          },
        ],
      },
    ],
    summary_md: "sum",
    one_mistake: "one",
    focus_evaluations: [
      { focus_point_id: "fp-1", verdict: "achieved", evidence: "e1" }, // 残す
      { focus_point_id: "fp-unknown", verdict: "partial", evidence: "e2" }, // 落とす
    ],
  };
}

describe("aggregate", () => {
  it("findings を flatten して f1,f2… で採番する", () => {
    const out = aggregate(result(), ctx());
    expect(out.findings.map((f) => f.id)).toEqual(["f1", "f2"]);
  });

  it("t_sec を場面窓にクランプする", () => {
    const out = aggregate(result(), ctx());
    expect(out.findings[0].t_sec).toBe(68);
    expect(out.findings[1].t_sec).toBe(98);
  });

  it("review_status='pending' を付与する", () => {
    const out = aggregate(result(), ctx());
    expect(out.findings.every((f) => f.review_status === "pending")).toBe(true);
  });

  it("語彙内 habit_tag は保持、語彙外は null 化 + needsReview", () => {
    const out = aggregate(result(), ctx());
    expect(out.findings[0].habit_tag).toBe("recovery");
    expect(out.findings[0].needsReview).toBeUndefined();
    expect(out.findings[1].habit_tag).toBeNull();
    expect(out.findings[1].needsReview).toBe(true);
    expect(out.warnings.some((w) => w.includes("made_up_tag"))).toBe(true);
  });

  it("MANIFEST 外の focus_point_id を落として警告する", () => {
    const out = aggregate(result(), ctx());
    expect(out.focus_evaluations.map((e) => e.focus_point_id)).toEqual(["fp-1"]);
    expect(out.warnings.some((w) => w.includes("fp-unknown"))).toBe(true);
  });

  it("summary_md / one_mistake をそのまま通す", () => {
    const out = aggregate(result(), ctx());
    expect(out.summary_md).toBe("sum");
    expect(out.one_mistake).toBe("one");
  });

  it("death をそのまま保持する", () => {
    const r = result();
    r.scenes[0].findings[0].death = { stock: 2, kill_move: "上B", initiating_action: "崖離し" };
    const out = aggregate(r, ctx());
    expect(out.findings[0].death).toEqual({ stock: 2, kill_move: "上B", initiating_action: "崖離し" });
  });

  it("対応窓が無い場面は clamp せず警告する", () => {
    const r = result();
    r.scenes[0].t_sec = 999; // ctx に窓が無い
    const out = aggregate(r, ctx());
    expect(out.findings[0].t_sec).toBe(50); // 未clamp
    expect(out.warnings.some((w) => w.includes("999"))).toBe(true);
  });
});
