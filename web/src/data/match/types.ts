// 勝敗記録（match_results）の型定義。フレームデータ/notesとは責務分離（ADR-0015）。
// character_id は「対戦相手キャラ」を指す（自分は主に自キャラで戦う前提。マッチアップ単位）。
export type MatchMode = "vip" | "smamate" | "offline";
export type MatchOutcome = "win" | "lose";

export interface MatchResult {
  id: string;
  characterId: string;
  mode: MatchMode;
  result: MatchOutcome;
  createdAt: string;
}

export interface MatchQuery {
  characterId?: string;
  mode?: MatchMode;
}

export const MATCH_MODES: MatchMode[] = ["vip", "smamate", "offline"];

export const MATCH_MODE_LABELS: Record<MatchMode, string> = {
  vip: "VIP",
  smamate: "スマメイト",
  offline: "オフライン",
};
