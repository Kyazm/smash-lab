// 確定反撃の結果一覧（守り/攻め共通の行表示）。shield_drop はデフォルト表示（トグルで隠せる、G-1）。
// docs/06 A-3: 猶予Fの水平バー可視化 + 「猶予3F以上のみ」トグル（実戦で安定する反撃だけに絞る、FAT準拠）。
// FU-3: 「ジャスガ反撃も含める」トグルを追加。ONのとき、通常ガードでは確定しないが
// ジャストシールド（ガード解除11F省略）でのみ確定する shield_drop 行を追加表示し、ジャスガバッジを付ける。
import { useState } from "react";
import { FrameValue } from "./shared/FrameValue";
import { SlackBar } from "./shared/SlackBar";
import type { PunishHit } from "../lib/punish";
import { hitKey, mergeForDisplay, perfectShieldOnlyHits as computePerfectShieldOnlyHits } from "../lib/punishHitList";

interface Props {
  /** 通常ガードで確定する行 */
  hits: PunishHit[];
  /** ジャストシールド時の確定行（hits との差分がジャスガ限定行として追加表示される） */
  perfectShieldHits?: PunishHit[];
  /** 見出し（例: "確定するZSSの反撃" / "反撃してくる相手の行動"） */
  title: string;
}

const STABLE_SLACK_THRESHOLD = 3;

export function PunishHitList({ hits, perfectShieldHits = [], title }: Props) {
  const [showShieldDrop, setShowShieldDrop] = useState(true);
  const [stableOnly, setStableOnly] = useState(false);
  const [includePerfectShield, setIncludePerfectShield] = useState(false);

  const perfectShieldOnlyHits = computePerfectShieldOnlyHits(hits, perfectShieldHits);
  const merged = mergeForDisplay(hits, perfectShieldHits, includePerfectShield);

  const hasShieldDrop = merged.some((d) => d.hit.candidate.oosType === "shield_drop");
  const shieldDropFiltered = showShieldDrop
    ? merged
    : merged.filter((d) => d.hit.candidate.oosType !== "shield_drop");
  const hiddenByShieldDrop = merged.length - shieldDropFiltered.length;

  const visibleHits = stableOnly
    ? shieldDropFiltered.filter((d) => d.hit.slackFrames >= STABLE_SLACK_THRESHOLD)
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
          {hasShieldDrop || perfectShieldOnlyHits.length > 0 ? (
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
          {perfectShieldOnlyHits.length > 0 ? (
            <label className="flex min-h-11 items-center gap-1.5 text-xs text-ink-secondary">
              <input
                type="checkbox"
                checked={includePerfectShield}
                onChange={(e) => setIncludePerfectShield(e.target.checked)}
                className="accent-action"
              />
              ジャスガ反撃も含める
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
          {visibleHits.map((d, i) => (
            <li
              key={`${hitKey(d.hit)}:${i}`}
              className="rounded border border-border bg-surface-1/50 p-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="flex items-center gap-1.5">
                  <span className="font-medium text-ink-primary">
                    {d.hit.candidate.label ?? "（無名の行動）"}
                  </span>
                  {d.perfectShieldOnly ? (
                    <span className="inline-flex items-center rounded bg-accent-yellow px-1.5 py-0.5 text-xs font-bold text-surface-0">
                      ジャスガ
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 text-xs text-ink-secondary">
                  実効発生 <FrameValue value={d.hit.effectiveStartup} />F ／ 猶予{" "}
                  <FrameValue value={d.hit.slackFrames} />F
                  <SlackBar slackFrames={d.hit.slackFrames} />
                </span>
              </div>
              {d.hit.candidate.rangeNote ? (
                <div className="mt-1 text-xs text-warning">※ {d.hit.candidate.rangeNote}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
