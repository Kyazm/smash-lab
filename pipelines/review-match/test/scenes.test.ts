import { describe, expect, it } from "vitest";
import {
  assignFramesToScenes,
  computeWindow,
  planScenes,
  type PlannedScene,
} from "../src/lib/scenes.js";

describe("computeWindow", () => {
  it("通常: [t-25, t+5]", () => {
    expect(computeWindow(93, 300)).toEqual({ start_sec: 68, end_sec: 98 });
  });
  it("t<25 は start を 0 にクランプ", () => {
    expect(computeWindow(10, 300)).toEqual({ start_sec: 0, end_sec: 15 });
  });
  it("end は duration にクランプ", () => {
    expect(computeWindow(298, 300)).toEqual({ start_sec: 273, end_sec: 300 });
  });
  it("t>duration はスキップ", () => {
    const w = computeWindow(350, 300);
    expect("skipped" in w).toBe(true);
  });
  it("負の t は不正としてスキップ", () => {
    const w = computeWindow(-5, 300);
    expect("skipped" in w).toBe(true);
  });
  it("duration 不明(0)でも窓を返す", () => {
    expect(computeWindow(93, 0)).toEqual({ start_sec: 68, end_sec: 98 });
  });
});

describe("planScenes", () => {
  it("非重複は別セグメント", () => {
    const plan = planScenes([{ t_sec: 30 }, { t_sec: 100 }], 300);
    expect(plan.segments.length).toBe(2);
    expect(plan.segments[0]).toMatchObject({ start_sec: 5, end_sec: 35, sceneIndices: [0] });
    expect(plan.segments[1]).toMatchObject({ start_sec: 75, end_sec: 105, sceneIndices: [1] });
  });

  it("重複窓は1セグメントにマージし両場面を紐づける", () => {
    const plan = planScenes([{ t_sec: 30 }, { t_sec: 40 }], 300);
    expect(plan.segments.length).toBe(1);
    expect(plan.segments[0]).toMatchObject({ start_sec: 5, end_sec: 45, sceneIndices: [0, 1] });
    // scenes はリクエスト順を保つ
    expect(plan.scenes.map((s) => s.index)).toEqual([0, 1]);
  });

  it("隣接（start == 前 end）もマージする", () => {
    // t=30 → [5,35], t=60 → [35,65]。start(35) <= end(35) でマージ
    const plan = planScenes([{ t_sec: 30 }, { t_sec: 60 }], 300);
    expect(plan.segments.length).toBe(1);
    expect(plan.segments[0]).toMatchObject({ start_sec: 5, end_sec: 65 });
  });

  it("t>duration の場面はスキップされ segments に含まれない", () => {
    const plan = planScenes([{ t_sec: 30 }, { t_sec: 500 }], 300);
    expect(plan.scenes[1].window).toBeNull();
    expect(plan.scenes[1].skipped).toBeTruthy();
    expect(plan.segments.length).toBe(1);
    expect(plan.segments[0].sceneIndices).toEqual([0]);
  });

  it("入力順に依らず start 昇順でマージ判定する", () => {
    const plan = planScenes([{ t_sec: 100 }, { t_sec: 30 }], 300);
    // index は入力順（0=t100, 1=t30）だが segment は start 昇順
    expect(plan.segments[0].start_sec).toBe(5); // t30 由来
    expect(plan.segments[1].start_sec).toBe(75); // t100 由来
  });
});

describe("assignFramesToScenes", () => {
  const scenes: PlannedScene[] = [
    { index: 0, t_sec: 30, window: { start_sec: 5, end_sec: 35 } },
    { index: 1, t_sec: 40, window: { start_sec: 15, end_sec: 45 } },
  ];

  it("重複窓のフレームは両場面へ割り当てる", () => {
    const frames = [
      { path: "a", tSec: 10 }, // scene0 のみ
      { path: "b", tSec: 20 }, // 両方（overlap 15-35）
      { path: "c", tSec: 42 }, // scene1 のみ
    ];
    const map = assignFramesToScenes(scenes, frames);
    expect(map.get(0)!.map((f) => f.path)).toEqual(["a", "b"]);
    expect(map.get(1)!.map((f) => f.path)).toEqual(["b", "c"]);
  });

  it("各場面内で tSec 昇順に並べる", () => {
    const frames = [
      { path: "late", tSec: 30 },
      { path: "early", tSec: 8 },
    ];
    const map = assignFramesToScenes(scenes, frames);
    expect(map.get(0)!.map((f) => f.path)).toEqual(["early", "late"]);
  });

  it("skipped 場面は割当対象外", () => {
    const withSkip: PlannedScene[] = [
      { index: 0, t_sec: 500, window: null, skipped: "over" },
    ];
    const map = assignFramesToScenes(withSkip, [{ path: "a", tSec: 10 }]);
    expect(map.has(0)).toBe(false);
  });
});
