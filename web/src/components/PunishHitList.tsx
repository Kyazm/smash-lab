// 確定反撃の結果一覧（守り/攻め共通の行表示）。shield_drop はデフォルト非表示。
import { useState } from "react";
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
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {hasShieldDrop ? (
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={showShieldDrop}
              onChange={(e) => setShowShieldDrop(e.target.checked)}
              className="accent-emerald-500"
            />
            ガード解除反撃も表示
          </label>
        ) : null}
      </div>

      {hiddenCount > 0 ? (
        <p className="mt-1 text-xs text-slate-500">ガード解除反撃 {hiddenCount}件 非表示</p>
      ) : null}

      {visibleHits.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">該当する行動はありません。</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {visibleHits.map((hit, i) => (
            <li
              key={hit.candidate.id ?? i}
              className="rounded border border-slate-700 bg-slate-900/50 p-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-medium text-slate-100">
                  {hit.candidate.label ?? "（無名の行動）"}
                </span>
                <span className="text-xs text-slate-400">
                  実効発生 {hit.effectiveStartup}F ／ 猶予 {hit.slackFrames}F
                </span>
              </div>
              {hit.candidate.rangeNote ? (
                <div className="mt-1 text-xs text-amber-400">※ {hit.candidate.rangeNote}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
