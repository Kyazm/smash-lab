// applyFindingStatus（純関数）のみをテストする。Supabase呼び出し部分はモック不要な形に分離済み。
import { describe, it, expect } from "vitest";
import { applyFindingStatus } from "./reviewApi";
import type { Finding } from "./types";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
    t_sec: 90,
    situation: "neutral",
    observation: "obs",
    suggestion: "sug",
    habit_tag: "spacing_move",
    mistake_type: "decision",
    confidence: 0.8,
    review_status: "pending",
    ...overrides,
  };
}

describe("applyFindingStatus", () => {
  it("対象findingのreview_statusを書き換える", () => {
    const findings = [makeFinding({ id: "f1" }), makeFinding({ id: "f2" })];
    const next = applyFindingStatus(findings, "f1", "accepted");
    expect(next.find((f) => f.id === "f1")?.review_status).toBe("accepted");
  });

  it("他のfindingには影響しない", () => {
    const findings = [makeFinding({ id: "f1" }), makeFinding({ id: "f2" })];
    const next = applyFindingStatus(findings, "f1", "accepted");
    expect(next.find((f) => f.id === "f2")?.review_status).toBe("pending");
  });

  it("元の配列・要素は変更しない（イミュータブル）", () => {
    const findings = [makeFinding({ id: "f1" })];
    const next = applyFindingStatus(findings, "f1", "rejected");
    expect(findings[0].review_status).toBe("pending");
    expect(next).not.toBe(findings);
  });

  it("id不在ならthrow", () => {
    const findings = [makeFinding({ id: "f1" })];
    expect(() => applyFindingStatus(findings, "unknown", "accepted")).toThrow(/finding not found/);
  });
});
