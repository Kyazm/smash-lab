// 練習ループの純関数群（ADR-0018）。セッション時間窓・結果目標検知・ティルト検知・振り返り合成。
import type { MatchResult } from "../data/match/types";

/**
 * 結果目標っぽい入力の検知（プロセス目標への言い換えナッジ用。ブロックはしない）。
 * docs/05 #5: プロセス目標 d=1.36 vs 結果目標 d=0.09。
 */
export function detectResultGoal(goal: string): boolean {
  return /VIP|到達|勝ちたい|勝つ|勝利|レート|戦闘力|段位|連勝|昇格|盛る/i.test(goal);
}

/**
 * セッションの時間窓に入る記録を返す（createdAt ∈ [startedAt, endedAt)。endedAt=nullは進行中=上限なし）。
 * ISO文字列は精度・タイムゾーン表記が供給元で揺れる（".000Z" vs "Z" vs "+00:00"）ため、
 * 辞書順でなく必ずepochで比較する。
 */
export function sessionResults(
  results: MatchResult[],
  session: { startedAt: string; endedAt: string | null },
): MatchResult[] {
  const start = Date.parse(session.startedAt);
  const end = session.endedAt == null ? Infinity : Date.parse(session.endedAt);
  return results.filter((r) => {
    const t = Date.parse(r.createdAt);
    return t >= start && t < end;
  });
}

/**
 * ティルト検知: 直近windowMin分以内の記録だけを見て、現在連敗がstreak以上ならtrue。
 * docs/05 #6: 有効なティルト対策は距離置き（distraction）のみ。
 * now を注入可能にしてテスト容易性を確保（createdAtはサーバ時刻・nowは端末時刻だが45分窓に対し誤差は無害）。
 */
export function detectTilt(
  resultsAsc: MatchResult[],
  now: Date,
  opts: { streak?: number; windowMin?: number } = {},
): boolean {
  const streak = opts.streak ?? 3;
  const windowMin = opts.windowMin ?? 45;
  const cutoff = now.getTime() - windowMin * 60_000;
  const recent = resultsAsc.filter((r) => Date.parse(r.createdAt) >= cutoff);
  if (recent.length < streak) return false;
  let run = 0;
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    if (recent[i].result === "lose") run += 1;
    else break;
  }
  return run >= streak;
}

/** 振り返りの構造化質問をMarkdownに合成する（sessions.retro_md に保存する形）。 */
export function composeRetroMd(answers: {
  /** 意識ポイントをどれだけ実行できたか（自由記述）。 */
  focusExec: string;
  /** 自分を過度に責めていないか（選択+任意メモ）。 */
  selfCheck: string;
  free?: string;
}): string {
  const parts = [
    `## 意識ポイントの実行\n${answers.focusExec.trim() || "（未記入）"}`,
    `## 自分を過度に責めていないか\n${answers.selfCheck.trim() || "（未記入）"}`,
  ];
  if (answers.free?.trim()) parts.push(`## メモ\n${answers.free.trim()}`);
  return parts.join("\n\n");
}
