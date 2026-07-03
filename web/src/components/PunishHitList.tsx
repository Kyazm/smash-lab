// 確定反撃の結果一覧（守り/攻め共通の行表示）。shield_drop はデフォルト表示（トグルで隠せる、G-1）。
// docs/06 A-3: 猶予Fの水平バー可視化 + 「猶予3F以上のみ」トグル（実戦で安定する反撃だけに絞る、FAT準拠）。
import { useState } from "react";
import { FrameValue } from "./shared/FrameValue";
import { SlackBar } from "./shared/SlackBar";
import type { PunishHit } from "../lib/punish";

interface Props {
  hits: PunishHit[];
  /** 見出し（例: "確定するZSSの反撃" / "反撃してくる相手の行動"） */
  title: string;
}

const STABLE_SLACK_THRESHOLD = 3;

export function PunishHitList({ hits, title }: Props) {
  const [showShieldDrop, setShowShieldDrop] = useState(true);
  const [stableOnly, setStableOnly] = useState(false);

  const hasShieldDrop = hits.some((h) => h.candidate.oosType === "shield_drop");
  const shieldDropFiltered = showShieldDrop ? hits : hits.filter((h) => h.candidate.oosType !== "shield_drop");
  const hiddenByShieldDrop = hits.length - shieldDropFiltered.length;

  const visibleHits = stableOnly
    ? shieldDropFiltered.filter((h) => h.slackFrames >= STABLE_SLACK_THRESHOLD)
    : shieldDropFiltered;
  const hiddenByStable = shieldDropFiltered.length - visibleHits.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-secondary">{title}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 items-center gap-1.5 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={stableOnly}
              onChange={(e) => setStableOnly(e.target.checked)}
              className="accent-action"
            />
            猶予3F以上のみ
          </label>
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
      </div>

      {hiddenByShieldDrop > 0 ? (
        <p className="mt-1 text-xs text-ink-muted">ガード解除反撃 {hiddenByShieldDrop}件 非表示</p>
      ) : null}
      {hiddenByStable > 0 ? (
        <p className="mt-1 text-xs text-ink-muted">猶予3F未満 {hiddenByStable}件 非表示</p>
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
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="font-medium text-ink-primary">
                  {hit.candidate.label ?? "（無名の行動）"}
                </span>
                <span className="flex items-center gap-2 text-xs text-ink-secondary">
                  実効発生 <FrameValue value={hit.effectiveStartup} />F ／ 猶予{" "}
                  <FrameValue value={hit.slackFrames} />F
                  <SlackBar slackFrames={hit.slackFrames} />
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
