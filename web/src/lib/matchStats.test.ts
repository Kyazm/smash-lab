import { describe, expect, it } from "vitest";
import type { MatchMode, MatchOutcome, MatchResult } from "../data/match/types";
import {
  bestWorstMatchups,
  computeStreaks,
  computeSummary,
  filterByRange,
  groupByMode,
  rankByCharacter,
  recentForm,
  winRateSeries,
} from "./matchStats";

// createdAt を連番で採番し昇順を保証するビルダー。
let seq = 0;
function r(result: MatchOutcome, characterId = "c1", mode: MatchMode = "vip"): MatchResult {
  seq += 1;
  return {
    id: `id-${seq}`,
    characterId,
    mode,
    result,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
  };
}
const w = (c?: string, m?: MatchMode) => r("win", c, m);
const l = (c?: string, m?: MatchMode) => r("lose", c, m);

describe("computeSummary", () => {
  it("空配列は total=0, winRate=0（ゼロ除算しない）", () => {
    expect(computeSummary([])).toEqual({ wins: 0, losses: 0, total: 0, winRate: 0 });
  });
  it("全勝は winRate=1", () => {
    expect(computeSummary([w(), w(), w()])).toEqual({ wins: 3, losses: 0, total: 3, winRate: 1 });
  });
  it("全敗は winRate=0", () => {
    expect(computeSummary([l(), l()])).toEqual({ wins: 0, losses: 2, total: 2, winRate: 0 });
  });
  it("混在は wins/total", () => {
    const s = computeSummary([w(), l(), w(), w()]);
    expect(s).toEqual({ wins: 3, losses: 1, total: 4, winRate: 0.75 });
  });
});

describe("computeStreaks", () => {
  it("空配列は全て0", () => {
    expect(computeStreaks([])).toEqual({ current: 0, maxWin: 0, maxLose: 0 });
  });
  it("単一勝ちは current=+1", () => {
    expect(computeStreaks([w()])).toEqual({ current: 1, maxWin: 1, maxLose: 0 });
  });
  it("単一負けは current=-1", () => {
    expect(computeStreaks([l()])).toEqual({ current: -1, maxWin: 0, maxLose: 1 });
  });
  it("連勝中に最新が敗北すると current=-1 にリセット", () => {
    // W W W L → current は末尾の連敗=1 → -1、maxWin=3
    expect(computeStreaks([w(), w(), w(), l()])).toEqual({ current: -1, maxWin: 3, maxLose: 1 });
  });
  it("maxWin / maxLose を配列全体から拾う", () => {
    // W W L L L W W  → maxWin=2, maxLose=3, current=+2
    expect(computeStreaks([w(), w(), l(), l(), l(), w(), w()])).toEqual({
      current: 2,
      maxWin: 2,
      maxLose: 3,
    });
  });
});

describe("winRateSeries", () => {
  it("空配列は []", () => {
    expect(winRateSeries([])).toEqual([]);
  });
  it("n は1始まりで累積勝率を返す", () => {
    // W L W → 1/1, 1/2, 2/3
    expect(winRateSeries([w(), l(), w()])).toEqual([
      { n: 1, winRate: 1 },
      { n: 2, winRate: 0.5 },
      { n: 3, winRate: 2 / 3 },
    ]);
  });
});

describe("groupByMode", () => {
  it("3モード全キーを持ち、該当なしは空配列", () => {
    const g = groupByMode([w("c1", "vip"), l("c1", "offline"), w("c1", "vip")]);
    expect(Object.keys(g).sort()).toEqual(["offline", "smamate", "vip"]);
    expect(g.vip).toHaveLength(2);
    expect(g.offline).toHaveLength(1);
    expect(g.smamate).toEqual([]);
  });
});

describe("rankByCharacter", () => {
  it("勝率降順、同率は試合数降順", () => {
    // c1: 2勝0敗(1.0, 2試合) / c2: 1勝0敗(1.0, 1試合) / c3: 1勝1敗(0.5)
    const ranked = rankByCharacter([
      w("c1"), w("c1"),
      w("c2"),
      w("c3"), l("c3"),
    ]);
    expect(ranked.map((e) => e.characterId)).toEqual(["c1", "c2", "c3"]);
    expect(ranked[0]).toEqual({ characterId: "c1", wins: 2, losses: 0, total: 2, winRate: 1 });
    expect(ranked[2].winRate).toBe(0.5);
  });
});

describe("recentForm", () => {
  it("直近n戦だけを新しい方を末尾にして返す", () => {
    const f = recentForm([w(), l(), w(), w(), l()], 3);
    expect(f.outcomes).toEqual(["win", "win", "lose"]); // 末尾3件
    expect(f).toMatchObject({ wins: 2, total: 3 });
  });
  it("空配列は0", () => {
    expect(recentForm([])).toEqual({ outcomes: [], wins: 0, total: 0, winRate: 0 });
  });
});

describe("bestWorstMatchups", () => {
  it("min戦以上で得意/苦手を返し、重複しない", () => {
    // c1:3-0(1.0), c2:1-0(1.0,1戦=min未満), c3:2-1(0.67), c4:0-3(0), c5:1-2(0.33)
    const ranking = rankByCharacter([
      w("c1"), w("c1"), w("c1"),
      w("c2"),
      w("c3"), w("c3"), l("c3"),
      l("c4"), l("c4"), l("c4"),
      w("c5"), l("c5"), l("c5"),
    ]);
    const { best, worst } = bestWorstMatchups(ranking, { min: 3, count: 2 });
    // 3戦以上: c1(1.0), c3(0.67), c5(0.33), c4(0)。c2は1戦で除外
    expect(best.map((e) => e.characterId)).toEqual(["c1", "c3"]);
    expect(worst.map((e) => e.characterId)).toEqual(["c4", "c5"]); // 勝率低い順
    // best と worst は重複しない
    const overlap = best.filter((b) => worst.some((wm) => wm.characterId === b.characterId));
    expect(overlap).toEqual([]);
  });
});

describe("filterByRange", () => {
  const NOW = new Date("2026-07-06T12:00:00Z");
  const mk = (daysAgo: number, result: MatchOutcome): MatchResult => ({
    id: `id-${daysAgo}-${result}`,
    characterId: "c1",
    mode: "vip",
    result,
    createdAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  });

  it("all はそのまま返す", () => {
    const rs = [mk(3, "win"), mk(1, "lose")];
    expect(filterByRange(rs, { kind: "all" }, NOW)).toEqual(rs);
  });

  it("games は末尾n件（直近）を順序保持で返す", () => {
    const rs = [mk(5, "win"), mk(3, "lose"), mk(1, "win")];
    expect(filterByRange(rs, { kind: "games", n: 2 }, NOW).map((r) => r.id)).toEqual([
      "id-3-lose",
      "id-1-win",
    ]);
    // n が総数超過でも全件
    expect(filterByRange(rs, { kind: "games", n: 99 }, NOW)).toHaveLength(3);
  });

  it("days は窓内のみ（境界ちょうどは含む）", () => {
    const rs = [mk(10, "win"), mk(7, "lose"), mk(2, "win")];
    const out = filterByRange(rs, { kind: "days", days: 7 }, NOW);
    expect(out.map((r) => r.id)).toEqual(["id-7-lose", "id-2-win"]);
  });

  it("空配列は空", () => {
    expect(filterByRange([], { kind: "days", days: 7 }, NOW)).toEqual([]);
  });
});
