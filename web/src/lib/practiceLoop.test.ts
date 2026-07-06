import { describe, expect, it } from "vitest";
import type { MatchMode, MatchOutcome, MatchResult } from "../data/match/types";
import { composeRetroMd, detectResultGoal, detectTilt, sessionResults } from "./practiceLoop";

function at(minAgo: number, result: MatchOutcome, now = new Date("2026-07-06T12:00:00Z")): MatchResult {
  return {
    id: `id-${minAgo}-${result}-${Math.random()}`,
    characterId: "c1",
    mode: "vip" as MatchMode,
    result,
    createdAt: new Date(now.getTime() - minAgo * 60_000).toISOString(),
  };
}
const NOW = new Date("2026-07-06T12:00:00Z");

describe("detectResultGoal", () => {
  it("結果目標語を検知する", () => {
    expect(detectResultGoal("VIPに到達する")).toBe(true);
    expect(detectResultGoal("今日こそ勝つ")).toBe(true);
    expect(detectResultGoal("戦闘力を盛る")).toBe(true);
  });
  it("プロセス目標は検知しない", () => {
    expect(detectResultGoal("崖狩りで2択を通す")).toBe(false);
    expect(detectResultGoal("着地を見てから技を振る")).toBe(false);
  });
});

describe("sessionResults", () => {
  const s = { startedAt: "2026-07-06T11:00:00Z", endedAt: "2026-07-06T11:30:00Z" };
  it("時間窓 [started, ended) の記録だけ返す", () => {
    const inWin = at(45, "win", NOW); // 11:15
    const before = at(70, "win", NOW); // 10:50
    const atEnd = { ...at(30, "lose", NOW), createdAt: "2026-07-06T11:30:00.000Z" }; // ended同時刻は除外
    expect(sessionResults([before, inWin, atEnd], s)).toEqual([inWin]);
  });
  it("進行中（endedAt=null）は上限なし", () => {
    const r = at(1, "win", NOW);
    expect(sessionResults([r], { startedAt: "2026-07-06T11:00:00Z", endedAt: null })).toEqual([r]);
  });
});

describe("detectTilt", () => {
  it("45分以内に3連敗でtrue", () => {
    const results = [at(30, "win", NOW), at(20, "lose", NOW), at(10, "lose", NOW), at(5, "lose", NOW)];
    expect(detectTilt(results, NOW)).toBe(true);
  });
  it("連敗が窓の外なら無視（古い3連敗ではtrueにならない）", () => {
    const results = [at(120, "lose", NOW), at(110, "lose", NOW), at(100, "lose", NOW)];
    expect(detectTilt(results, NOW)).toBe(false);
  });
  it("直近が勝ちならリセット", () => {
    const results = [at(20, "lose", NOW), at(15, "lose", NOW), at(10, "lose", NOW), at(5, "win", NOW)];
    expect(detectTilt(results, NOW)).toBe(false);
  });
  it("2連敗ではfalse・空でfalse", () => {
    expect(detectTilt([at(10, "lose", NOW), at(5, "lose", NOW)], NOW)).toBe(false);
    expect(detectTilt([], NOW)).toBe(false);
  });
});

describe("composeRetroMd", () => {
  it("2問+任意メモをMarkdown合成", () => {
    const md = composeRetroMd({ focusExec: "崖2択は5回中3回", selfCheck: "責めていない", free: "空前が当たる" });
    expect(md).toContain("## 意識ポイントの実行\n崖2択は5回中3回");
    expect(md).toContain("## 自分を過度に責めていないか\n責めていない");
    expect(md).toContain("## メモ\n空前が当たる");
  });
  it("空回答は（未記入）でプレースホルダ", () => {
    const md = composeRetroMd({ focusExec: "", selfCheck: " " });
    expect(md).toContain("（未記入）");
    expect(md).not.toContain("## メモ");
  });
});
