// 意識ポイントのプリセット（ADR-0018）。docs/05・10・11 のエビデンスと操作精度ドリルに基づく静的データ。
// sourceSlug はライブラリ記事のslug（出典リンク用）。技術ドリルは下位スキル分解（docs/05 #2）の粒度で用意する。
import type { FocusCategory } from "../data/focus/types";

export interface FocusPreset {
  body: string;
  category: FocusCategory;
  /** 出典のライブラリ記事slug（/library/:slug）。 */
  sourceSlug: string;
}

export const FOCUS_PRESETS: FocusPreset[] = [
  // 技術ドリル（操作精度: 下位スキル分解・最頻出形の固定反復とインターリービング）
  { body: "最速小ジャンプ空N（10回連続成功）", category: "technical", sourceSlug: "practice-focus" },
  { body: "反転（振り向き）行動を暴発なく出す", category: "technical", sourceSlug: "practice-focus" },
  { body: "ガーキャン行動の使い分け（掴み/上B/空中技）", category: "technical", sourceSlug: "practice-science" },
  { body: "崖離し行動から2択を通す", category: "technical", sourceSlug: "practice-science" },
  { body: "コンボを%帯を変えて練習（混ぜる）", category: "technical", sourceSlug: "practice-focus" },
  // 立ち回り・判断（教示的セルフトークとして短い言葉で）
  { body: "着地を見てから技を振る", category: "technical", sourceSlug: "mental-game" },
  { body: "相手のジャンプ読みを1つ用意", category: "technical", sourceSlug: "mental-game" },
  // メンタル（docs/05 #8: 技術と同格の練習対象）
  { body: "リード時に攻め急がない", category: "mental", sourceSlug: "practice-science" },
  { body: "ストック間ルーティン（一呼吸→デス原因を一言→次の方針1つ）", category: "mental", sourceSlug: "mental-game" },
  { body: "ミスの解釈を変える（配置が悪かっただけ）", category: "mental", sourceSlug: "mental-game" },
  { body: "投げやりバーストを狙わない", category: "mental", sourceSlug: "practice-science" },
];
