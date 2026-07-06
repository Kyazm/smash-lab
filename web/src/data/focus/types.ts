// 意識ポイント（focus_points）の型定義（ADR-0018 / docs/05 #5,#8）。
// 「今日意識すること」を技術/メンタル同格で管理する。アクティブは1〜3個（UI層で制御、docs/04 #10）。
export type FocusCategory = "technical" | "mental";

export interface FocusPoint {
  id: string;
  body: string;
  category: FocusCategory;
  active: boolean;
  createdAt: string;
}

export const FOCUS_CATEGORY_LABELS: Record<FocusCategory, string> = {
  technical: "技術",
  mental: "メンタル",
};

/** アクティブにできる上限（1スキル集中→実戦転移: docs/04 #10）。 */
export const MAX_ACTIVE_FOCUS = 3;
