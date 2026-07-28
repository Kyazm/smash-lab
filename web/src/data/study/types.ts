// プレイヤー研究（player-study）のDB行に対応する型。
// 正本は docs/14_player-study.md（②situation語彙 / ③崖の語彙 / ④ZSS行動辞書 / ⑤confidence規則）と
// supabase/migrations/0011_player_study.sql。語彙を変える時は docs/14 → ADR-0020 → ここ の順で反映する。
// pipelines/player-study/src/lib/labels-schema.ts と同じ語彙を持つが、パイプラインとWebはビルドが独立なので
// 共有せず二重定義する（review-match の data/review/types.ts と同じ流儀）。

// ---------------------------------------------------------------------------
// situation（9種）: docs/14 ②。docs/13（review-match）の6種とは意図的に別語彙。
// ---------------------------------------------------------------------------
export const STUDY_SITUATIONS = [
  "neutral",
  "advantage",
  "disadvantage",
  "ledge_offense",
  "ledge_defense",
  "landing",
  "landing_trap",
  "edgeguard",
  "recovery",
  "kill_confirm",
] as const;
export type StudySituation = (typeof STUDY_SITUATIONS)[number];

export const STUDY_SITUATION_LABELS: Record<StudySituation, string> = {
  neutral: "ニュートラル",
  advantage: "有利",
  disadvantage: "不利",
  ledge_offense: "崖攻め",
  ledge_defense: "崖上がり",
  landing: "着地",
  landing_trap: "着地狩り",
  edgeguard: "復帰阻止",
  recovery: "復帰",
  kill_confirm: "撃墜確定",
};

/** 場面の1行説明（初出の専門用語に説明を添えるユーザー標準要求）。フィルタチップのtitle等で使う。 */
export const STUDY_SITUATION_HINTS: Record<StudySituation, string> = {
  neutral: "どちらも有利を取っていない対等な読み合いの状態",
  advantage: "自分が攻めている状態（相手を浮かせてお手玉・追撃している等、読み合いの主導権が自分側）。ライン＝位置取りの話ではない",
  disadvantage: "自分が攻められている状態（浮かされて着地や脱出を迫られている等）。こちらもラインの話ではない",
  ledge_offense: "相手が崖を掴んでいて、その上がりを狩りにいく側",
  ledge_defense: "自分が崖を掴んでいて、そこから上がる側",
  landing: "自分が空中から着地する側の場面（狩られる側）",
  landing_trap: "相手の着地を狩りにいく側の場面（2026-07以降のデータで分離。それ以前は「有利」に混在）",
  edgeguard: "場外に出た相手の復帰を阻止しにいく場面",
  recovery: "自分が場外から復帰する場面",
  kill_confirm: "撃墜を確定させた最後の読み合い1件（布石は含めない）",
};

// ---------------------------------------------------------------------------
// outcome / status
// ---------------------------------------------------------------------------
export const STUDY_OUTCOMES = ["won", "lost", "even"] as const;
export type StudyOutcome = (typeof STUDY_OUTCOMES)[number];

export const STUDY_OUTCOME_LABELS: Record<StudyOutcome, string> = {
  won: "勝ち",
  lost: "負け",
  even: "五分",
};

export type StudyVideoStatus =
  | "cataloged"
  | "prepped"
  | "labeling"
  | "done"
  | "error"
  | "skipped";

// ---------------------------------------------------------------------------
// 行動辞書（docs/14 ③④）。粗カテゴリ8種 + 視認容易な個別技slug + 崖行動slug + unknown。
// 未知のslugが来ても落とさず slug をそのまま表示する（studyActionLabel）。
// ---------------------------------------------------------------------------
export const STUDY_ACTION_LABELS: Record<string, string> = {
  // 粗カテゴリ（docs/14 ④「粗カテゴリ（必須）」）
  aerial: "空中技",
  ground_attack: "地上技",
  smash: "スマッシュ",
  grab: "掴み",
  special: "必殺技",
  shield_action: "ガード行動",
  movement: "移動",
  ledge_option: "崖行動",
  // 視認容易な個別技slug（docs/14 ④の表）
  zair: "空N（鞭）",
  down_smash: "下スマッシュ",
  up_smash: "上スマッシュ",
  boost_kick: "上B（ブーストキック）",
  flip_jump: "下B（フリップジャンプ）",
  plasma_whip: "横B（プラズマウィップ）",
  paralyzer: "NB（パラライザー）",
  // 崖行動slug（docs/14 ③の正準6分類 + 攻め側2種）
  normal_getup: "通常上がり",
  jump_getup: "ジャンプ上がり",
  roll_getup: "回避上がり",
  attack_getup: "攻撃上がり",
  ledge_drop: "崖離し行動",
  ledge_stall: "崖待機（無敵管理）",
  ledge_trump: "崖奪い",
  wait_center: "中央で待機",
  // 判別不能（docs/14 ⑤で統計の分母から除外）
  unknown: "判別不能",
};

/** 行動slugの日本語ラベル。辞書外のslugは原文をそのまま返す（ラベル追加漏れでデータを落とさない）。 */
export function studyActionLabel(action: string): string {
  return STUDY_ACTION_LABELS[action] ?? action;
}

/** situation文字列が既知の9種かを判定（DBのcheck制約と同じ語彙。未知値は集計対象外に落とす）。 */
export function isStudySituation(value: string): value is StudySituation {
  return (STUDY_SITUATIONS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// DB行（0011_player_study.sql）
// ---------------------------------------------------------------------------

/** study_videos。UIで使う列のみ（source/opp_chars_hint/error_message等は未使用のため取得しない）。 */
export interface StudyVideo {
  /** uuid（study_interactions.video_ref の参照先）。 */
  id: string;
  /** YouTube の video ID（埋込プレイヤー・外部リンクに使う）。 */
  video_id: string;
  title: string | null;
  tournament: string | null;
  round: string | null;
  /** 研究対象プレイヤー名（初期は Marss のみ。将来増える）。 */
  studied_player: string;
  studied_char: string;
  opp_player: string | null;
  /** date列（YYYY-MM-DD）。 */
  played_on: string | null;
  status: StudyVideoStatus;
  needs_review: boolean;
}

/** study_interactions。1判定=1行（docs/14 ①）。 */
export interface StudyInteraction {
  id: string;
  video_ref: string;
  game_index: number;
  /** 動画内の秒数（numeric）。YouTube seekTo に渡す。 */
  t_sec: number;
  /** ゲーム単位で目視確定した相手キャラ（正準日本語名）。 */
  opp_char: string | null;
  situation: StudySituation;
  /** 相手側の択・状況の補足（崖なら相手が選んだ上がり択等）。 */
  sub_situation: string | null;
  /** 行動辞書slug（docs/14 ③④）。 */
  action: string;
  action_detail: string | null;
  outcome: StudyOutcome;
  kill: boolean;
  /** 0〜1の主観確度。<0.6 は統計の分母から除外（docs/14 ⑤）。null は未記録扱いで除外側に倒す。 */
  confidence: number | null;
  /** note-media バケット内の代表フレームのobject path（例 study/<video_id>/1.jpg）。 */
  frame_path: string | null;
  /** ライン（位置取り）の有利/五分/不利。0012以降の任意記録で、旧データは null。 */
  line: "adv" | "even" | "disadv" | null;
  note: string | null;
  created_at: string;
}

export const STUDY_LINE_LABELS: Record<"adv" | "even" | "disadv", string> = {
  adv: "ライン有利",
  even: "ライン五分",
  disadv: "ライン不利",
};

/** interaction に動画メタをクライアントJOINした形（統計・ギャラリー表示の基本単位）。 */
export interface StudyInteractionWithVideo extends StudyInteraction {
  video: StudyVideo;
}

/** /study ページが扱うデータ一式。 */
export interface StudyDataset {
  /** status='done' の動画のみ（ラベリング完了セット）。 */
  videos: StudyVideo[];
  /** done動画に紐づく interaction 全件。 */
  interactions: StudyInteractionWithVideo[];
}
