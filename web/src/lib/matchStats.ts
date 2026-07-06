// 勝敗記録の集計（ADR-0015）。全て純関数で、追記専用ログ（MatchResult[]）から導出する。
// 時系列・連勝の計算は「createdAt 昇順に並んだ配列」を前提とする（provider が昇順で返す）。
import type { MatchMode, MatchOutcome, MatchResult } from "../data/match/types";
import { MATCH_MODES } from "../data/match/types";

export interface MatchSummary {
  wins: number;
  losses: number;
  total: number;
  /** 勝率 0..1。total=0 のときは 0。 */
  winRate: number;
}

export interface StreakStats {
  /** 末尾から連続する勝ちなら +n、負けなら −n、空なら 0。 */
  current: number;
  /** 最長連勝（正の数、無ければ 0）。 */
  maxWin: number;
  /** 最長連敗（正の数、無ければ 0）。 */
  maxLose: number;
}

export interface WinRatePoint {
  /** 試合番号（1始まり）。 */
  n: number;
  /** その時点までの累積勝率 0..1。 */
  winRate: number;
}

export interface CharacterRankEntry {
  characterId: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

export function computeSummary(results: MatchResult[]): MatchSummary {
  let wins = 0;
  for (const r of results) if (r.result === "win") wins += 1;
  const total = results.length;
  const losses = total - wins;
  return { wins, losses, total, winRate: total === 0 ? 0 : wins / total };
}

/** createdAt 昇順の配列を渡す。current の符号で連勝(+)/連敗(-)を表す。 */
export function computeStreaks(resultsAsc: MatchResult[]): StreakStats {
  let maxWin = 0;
  let maxLose = 0;
  let runWin = 0;
  let runLose = 0;
  for (const r of resultsAsc) {
    if (r.result === "win") {
      runWin += 1;
      runLose = 0;
      if (runWin > maxWin) maxWin = runWin;
    } else {
      runLose += 1;
      runWin = 0;
      if (runLose > maxLose) maxLose = runLose;
    }
  }
  // 末尾から連続する同一結果の長さ = 現在の連勝/連敗。
  let current = 0;
  if (resultsAsc.length > 0) {
    const last = resultsAsc[resultsAsc.length - 1].result;
    let run = 0;
    for (let i = resultsAsc.length - 1; i >= 0; i -= 1) {
      if (resultsAsc[i].result === last) run += 1;
      else break;
    }
    current = last === "win" ? run : -run;
  }
  return { current, maxWin, maxLose };
}

/** 累積勝率の時系列（1始まり）。空配列は []。 */
export function winRateSeries(resultsAsc: MatchResult[]): WinRatePoint[] {
  const points: WinRatePoint[] = [];
  let wins = 0;
  resultsAsc.forEach((r, i) => {
    if (r.result === "win") wins += 1;
    const n = i + 1;
    points.push({ n, winRate: wins / n });
  });
  return points;
}

/** モード別に分割する。3モード全キーを必ず持つ（該当なしは空配列）。 */
export function groupByMode(results: MatchResult[]): Record<MatchMode, MatchResult[]> {
  const out = {} as Record<MatchMode, MatchResult[]>;
  for (const m of MATCH_MODES) out[m] = [];
  for (const r of results) out[r.mode].push(r);
  return out;
}

/** 対戦相手キャラ別の成績。勝率降順、同率は試合数降順。 */
export function rankByCharacter(results: MatchResult[]): CharacterRankEntry[] {
  const byChar = new Map<string, MatchResult[]>();
  for (const r of results) {
    const list = byChar.get(r.characterId);
    if (list) list.push(r);
    else byChar.set(r.characterId, [r]);
  }
  const entries: CharacterRankEntry[] = [];
  for (const [characterId, list] of byChar) {
    const s = computeSummary(list);
    entries.push({ characterId, wins: s.wins, losses: s.losses, total: s.total, winRate: s.winRate });
  }
  return entries.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.total - a.total;
  });
}

/** 勝率カードの範囲絞り込み（全体 / 直近n戦 / 直近hours時間 / 直近days日）。 */
export type MatchRange =
  | { kind: "all" }
  | { kind: "games"; n: number }
  | { kind: "hours"; hours: number }
  | { kind: "days"; days: number };

export const MATCH_RANGE_PRESETS: { range: MatchRange; label: string }[] = [
  { range: { kind: "all" }, label: "全体" },
  { range: { kind: "games", n: 10 }, label: "直近10戦" },
  { range: { kind: "games", n: 20 }, label: "直近20戦" },
  { range: { kind: "games", n: 50 }, label: "直近50戦" },
  { range: { kind: "hours", hours: 1 }, label: "1時間" },
  { range: { kind: "days", days: 1 }, label: "1日" },
  { range: { kind: "days", days: 7 }, label: "7日間" },
  { range: { kind: "days", days: 30 }, label: "30日間" },
];

export function matchRangeKey(r: MatchRange): string {
  if (r.kind === "all") return "all";
  if (r.kind === "games") return `g${r.n}`;
  if (r.kind === "hours") return `h${r.hours}`;
  return `d${r.days}`;
}

/** createdAt昇順の配列を範囲で絞る（順序は保持）。時間系はepoch比較（ISO表記揺れ対策）。 */
export function filterByRange(resultsAsc: MatchResult[], range: MatchRange, now: Date = new Date()): MatchResult[] {
  if (range.kind === "all") return resultsAsc;
  if (range.kind === "games") return resultsAsc.slice(Math.max(0, resultsAsc.length - range.n));
  const windowMs = range.kind === "hours" ? range.hours * 3_600_000 : range.days * 86_400_000;
  const cutoff = now.getTime() - windowMs;
  return resultsAsc.filter((r) => Date.parse(r.createdAt) >= cutoff);
}

export interface RecentFormStats {
  /** 古い→新しい（末尾が最新）の勝敗列。 */
  outcomes: MatchOutcome[];
  wins: number;
  total: number;
  winRate: number;
}

/** 直近 n 戦（createdAt 昇順配列の末尾）のフォーム。 */
export function recentForm(resultsAsc: MatchResult[], n = 20): RecentFormStats {
  const recent = resultsAsc.slice(Math.max(0, resultsAsc.length - n));
  const wins = recent.filter((r) => r.result === "win").length;
  const total = recent.length;
  return { outcomes: recent.map((r) => r.result), wins, total, winRate: total === 0 ? 0 : wins / total };
}

/**
 * 得意・苦手の相手キャラ。rankByCharacter の結果（勝率降順）から、min戦以上を対象に
 * 上位（得意）と下位（苦手）を返す。best/worst は重複しない。
 */
export function bestWorstMatchups(
  ranking: CharacterRankEntry[],
  opts: { min?: number; count?: number } = {},
): { best: CharacterRankEntry[]; worst: CharacterRankEntry[] } {
  const min = opts.min ?? 3;
  const count = opts.count ?? 3;
  const qualified = ranking.filter((e) => e.total >= min); // 既に勝率降順
  const best = qualified.slice(0, count);
  const bestSet = new Set(best.map((e) => e.characterId));
  const worst = qualified
    .filter((e) => !bestSet.has(e.characterId))
    .slice(-count)
    .reverse(); // 勝率が低い順
  return { best, worst };
}
