// 確反タブの猶予Fを小さな水平バーで可視化（docs/06 A-3）。advスケールと同じ配色規則を流用し、
// 猶予が大きい（安定して反撃しやすい）ほど adv-safe寄りの色にする。
import { advLevel, ADV_LEVEL_BG_CLASS } from "../../lib/advScale";

interface Props {
  slackFrames: number;
  /** バーの満タン基準F（これ以上は100%表示）。確反の猶予は経験的に0〜15F程度に収まるため15を既定にする。 */
  max?: number;
}

export function SlackBar({ slackFrames, max = 15 }: Props) {
  const clamped = Math.max(0, Math.min(slackFrames, max));
  const pct = (clamped / max) * 100;
  // 猶予Fは「大きいほど安定」なので、advスケールの符号を反転した基準で色分けする
  // （猶予0-4=caution相当、5-9=minor相当、10+=safe相当という体感に合わせる）。
  const level = advLevel(slackFrames >= 10 ? 0 : slackFrames >= 5 ? -3 : -6);
  const barClass = ADV_LEVEL_BG_CLASS[level].split(" ")[0]; // bg-adv-*/15 部分のみ流用

  return (
    <div className="flex items-center gap-1.5" title={`猶予 ${slackFrames}F`}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${barClass.replace("/15", "")}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
