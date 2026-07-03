// 硬直差(advスケール)バッジ。frames/punish両タブで共有（docs/06 A-1 共有コンポーネント先出し）。
// 色のみに依存しないよう符号付き数値を常に表示する（WCAG 1.4.1）。
import { ADV_LEVEL_BG_CLASS, advLevel, formatFrames } from "../../lib/advScale";

interface Props {
  /** ガード硬直差・猶予Fなど「大きいほど有利」なフレーム値 */
  frames: number;
  className?: string;
}

export function AdvBadge({ frames, className = "" }: Props) {
  const level = advLevel(frames);
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-frame font-semibold ${ADV_LEVEL_BG_CLASS[level]} ${className}`}
    >
      {formatFrames(frames)}
    </span>
  );
}
