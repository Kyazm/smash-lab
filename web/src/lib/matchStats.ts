// 勝敗記録の集計（ADR-0015）。全て純関数で、追記専用ログ（MatchResult[]）から導出する。
// 時系列・連勝の計算は「createdAt 昇順に並んだ配列」を前提とする（provider が昇順で返す）。
import type { MatchMode, MatchResult } from "../data/match/types";
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
