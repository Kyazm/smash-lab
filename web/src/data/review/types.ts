// AI試合レビューの型定義。docs/13_match-review.md ②JSONスキーマ契約（凍結）に対応する。
// 形（フィールド名・語彙）を変える場合は docs/13 を先に更新してからここに反映する。
import type { MatchMode, MatchOutcome } from "../match/types";

export interface RequestedTimestamp {
  t_sec: number;
  label?: string;
}

export type Situation = "neutral" | "advantage" | "disadvantage" | "ledge" | "edgeguard" | "recovery";
export type MistakeType = "execution" | "decision";
export type ReviewFindingStatus = "pending" | "accepted" | "rejected";

export interface FindingDeath {
  stock: number;
  kill_move: string;
  initiating_action: string;
}

export interface Finding {
  id: string;
  t_sec: number;
  situation: Situation;
  observation: string;
  suggestion: string;
  habit_tag: string | null;
  mistake_type: MistakeType;
  confidence: number;
  review_status: ReviewFindingStatus;
  needsReview?: boolean;
  death?: FindingDeath;
}

export type ReviewStatus = "pending" | "processing" | "done" | "error";

export type FocusVerdict = "achieved" | "partial" | "not_achieved" | "not_observable";

export interface FocusEvaluation {
  focus_point_id: string;
  verdict: FocusVerdict;
  evidence: string;
}

export interface AiReview {
  id: string;
  match_id: string;
  status: ReviewStatus;
  requested_timestamps: RequestedTimestamp[];
  findings: Finding[];
  summary_md: string | null;
  one_mistake: string | null;
  focus_evaluations: FocusEvaluation[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchMeta {
  video_url: string | null;
  opponent_character_id: string | null;
  mode: MatchMode | null;
  result: MatchOutcome | null;
  memo: string | null;
}

export interface ReviewListItem extends AiReview {
  match: MatchMeta;
}

// habit_tags 語彙（15語。docs/13 ②「habit_tag が検証する固定語彙」表と厳密一致。
// 語彙外は submit 側が null 化 + needsReview フラグを付与するので、この表は既知15語のみ持てばよい）。
export const HABIT_TAG_LABELS: Record<string, string> = {
  ledge_getup: "崖上がり",
  jump: "飛び",
  shield: "ガード",
  spacing_move: "置き技",
  edgeguard: "復帰阻止",
  landing: "着地",
  throw_mixup: "投げ択",
  op_management: "OP管理",
  recovery: "復帰",
  neutral: "ニュートラル",
  dash_dance: "ダッシュ管理",
  tech_chase: "受け身狩り",
  combo_escape: "コンボ抜け",
  self_destruct: "暴発・自滅",
  percent_management: "%管理",
};

export const SITUATION_LABELS: Record<Situation, string> = {
  neutral: "ニュートラル",
  advantage: "有利",
  disadvantage: "不利",
  ledge: "崖",
  edgeguard: "復帰阻止",
  recovery: "復帰",
};

export const MISTAKE_TYPE_LABELS: Record<MistakeType, string> = {
  execution: "実行ミス",
  decision: "判断ミス",
};
