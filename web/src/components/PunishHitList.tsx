// 確定反撃の結果一覧（守り/攻め共通の行表示）。shield_drop はデフォルト非表示。
import { useState } from "react";
import { FrameValue } from "./shared/FrameValue";
import type { PunishHit } from "../lib/punish";

interface Props {
  hits: PunishHit[];
  /** 見出し（例: "確定するZSSの反撃" / "反撃してくる相手の行動"） */
  title: string;
}

export function PunishHitList({ hits, title }: Props) {
  const [showShieldDrop, setShowShieldDrop] = useState(false);

  const hasShieldDrop = hits.some((h) => h.candidate.oosType === "shield_drop");
  const visibleHits = showShieldDrop ? hits : hits.filter((h) => h.candidate.oosType !== "shield_drop");
  const hiddenCount = hits.length - visibleHits.length;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-secondary">{title}</h3>
        {hasShieldDrop ? (
          <label className="flex min-h-11 items-center gap-1.5 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={showShieldDrop}
              onChange={(e) => setShowShieldDrop(e.target.checked)}
              className="accent-action"
            />
            ガード解除反撃も表示
          </label>
        ) : null}
      </div>

      {hiddenCount > 0 ? (
        <p className="mt-1 text-xs text-ink-muted">ガード解除反撃 {hiddenCount}件 非表示</p>
      ) : null}

      {visibleHits.length === 0 ? (
        <p className="mt-2 text-sm text-ink-secondary">該当する行動はありません。</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {visibleHits.map((hit, i) => (
            <li
              key={hit.candidate.id ?? i}
              className="rounded border border-border bg-surface-1/50 p-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-medium text-ink-primary">
                  {hit.candidate.label ?? "（無名の行動）"}
                </span>
                <span className="text-xs text-ink-secondary">
                  実効発生 <FrameValue value={hit.effectiveStartup} />F ／ 猶予{" "}
                  <FrameValue value={hit.slackFrames} />F
                </span>
              </div>
              {hit.candidate.rangeNote ? (
                <div className="mt-1 text-xs text-warning">※ {hit.candidate.rangeNote}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
