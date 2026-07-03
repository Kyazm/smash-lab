// 硬直差(on_shield/猶予F等)の4段階スケール判定（純粋関数）。docs/06 デザイントークン。
//   safe   (>=0)      : 有利〜五分
//   minor  (-1〜-4)    : 軽微な不利
//   caution(-5〜-9)    : 要注意（反撃圏に近い）
//   punish (<=-10)     : 確定反撃を受けやすい深い不利
export type AdvLevel = "safe" | "minor" | "caution" | "punish";

export function advLevel(frames: number): AdvLevel {
  if (frames >= 0) return "safe";
  if (frames >= -4) return "minor";
  if (frames >= -9) return "caution";
  return "punish";
}

export const ADV_LEVEL_LABEL: Record<AdvLevel, string> = {
  safe: "有利/五分",
  minor: "軽微な不利",
  caution: "要注意",
  punish: "確定反撃圏",
};

/** Tailwind の text-adv-* トークンクラス名。色のみに依存しないよう符号は別途併記すること。 */
export const ADV_LEVEL_TEXT_CLASS: Record<AdvLevel, string> = {
  safe: "text-adv-safe",
  minor: "text-adv-minor",
  caution: "text-adv-caution",
  punish: "text-adv-punish",
};

export const ADV_LEVEL_BG_CLASS: Record<AdvLevel, string> = {
  safe: "bg-adv-safe/15 text-adv-safe",
  minor: "bg-adv-minor/15 text-adv-minor",
  caution: "bg-adv-caution/15 text-adv-caution",
  punish: "bg-adv-punish/15 text-adv-punish",
};

/** 符号付きフレーム表記（+2F / -13F）。色だけに依存しない表記のため常にこれを使う（WCAG 1.4.1）。 */
export function formatFrames(frames: number): string {
  return frames > 0 ? `+${frames}F` : `${frames}F`;
}
