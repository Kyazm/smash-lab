// /study のチャート部品（docs/14_player-study.md ⑪統計表示）。
// components/match/charts.tsx と同じ流儀: チャートライブラリは入れず Tailwind の div バー + デザイントークン。
// 色: 勝ち=accent-red(action)（既存カラー規約）、信頼区間はその半透明、中立トラックは surface-2。
// 数値は font-frame tabular-nums で桁を揃える。
import {
  STUDY_SITUATION_HINTS,
  STUDY_SITUATION_LABELS,
  studyActionLabel,
  type StudySituation,
} from "../../data/study/types";
import {
  formatPercent,
  isReferenceOnly,
  type ActionDistribution,
  type SituationStat,
  type WilsonInterval,
} from "../../lib/studyStats";

function ciText(ci: WilsonInterval): string {
  return `${formatPercent(ci.lower)}〜${formatPercent(ci.upper)}`;
}

/** n<10 の参考値バッジ（docs/14 ⑪「n<10の場面は参考値表示にとどめる」）。 */
export function ReferenceBadge() {
  return (
    <span
      title="サンプルが10件未満。傾向の目安にとどめ、断定には使わない"
      className="rounded bg-surface-2 px-1.5 py-0.5 font-frame text-[10px] tracking-wide text-ink-muted"
    >
      参考値
    </span>
  );
}

/**
 * 割合バー + Wilson 95%信頼区間のひげ。
 * 上段の実線が標本の割合、下段の細い帯が信頼区間（真の割合が入りうる範囲）。
 */
function RateBar({ rate, ci }: { rate: number; ci: WilsonInterval }) {
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-action" style={{ width: `${rate * 100}%` }} />
      </div>
      {/* 信頼区間のひげ（lower〜upper の範囲を薄い帯で重ねる） */}
      <div className="relative mt-0.5 h-1 w-full rounded-full bg-surface-2/60">
        <div
          className="absolute inset-y-0 rounded-full bg-action/45"
          style={{ left: `${ci.lower * 100}%`, width: `${Math.max(0, ci.upper - ci.lower) * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 場面別サマリ。行タップでその場面に絞り込む。
 * 表示するのは実データがある場面のみ（分母0かつ除外0の場面は行にしない）。
 */
export function SituationSummaryList({
  summaries,
  selected,
  onSelect,
}: {
  summaries: SituationStat[];
  selected: StudySituation | null;
  onSelect: (s: StudySituation | null) => void;
}) {
  const rows = summaries.filter((s) => s.n > 0 || s.excluded > 0);
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">この条件のデータがありません。</p>;
  }
  return (
    <ul className="divide-y divide-border-subtle">
      {rows.map((s) => {
        const active = selected === s.situation;
        return (
          <li key={s.situation}>
            <button
              type="button"
              onClick={() => onSelect(active ? null : s.situation)}
              title={STUDY_SITUATION_HINTS[s.situation]}
              aria-pressed={active}
              className={`flex min-h-11 w-full flex-col gap-1 px-2 py-2 text-left transition-colors ${
                active ? "bg-surface-2/70" : "hover:bg-surface-2/40"
              } ${s.reference && s.n > 0 ? "opacity-70" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink-primary">
                  {STUDY_SITUATION_LABELS[s.situation]}
                </span>
                {s.reference && s.n > 0 ? <ReferenceBadge /> : null}
                <span className="ml-auto font-frame text-xs tabular-nums text-ink-secondary">
                  {s.n}件
                  {s.excluded > 0 ? <span className="text-ink-muted"> (+除外{s.excluded})</span> : null}
                </span>
              </div>
              {s.n > 0 ? (
                <>
                  <RateBar rate={s.winRate} ci={s.winRateCi} />
                  <div className="font-frame text-[10px] tabular-nums text-ink-muted">
                    勝率 <span className="text-ink-primary">{formatPercent(s.winRate)}</span>（95%CI{" "}
                    {ciText(s.winRateCi)}） · {s.won}勝{s.lost}敗{s.even}五分 · 撃墜 {s.kills}
                  </div>
                </>
              ) : (
                <p className="font-frame text-[10px] text-ink-muted">
                  分母に入る記録なし（判別不能・低確度のみ）
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 行動分布。1行=1つの action で、横バーは「この分母の中でその行動が選ばれた割合（使用率）」。
 * 行タップでその行動の全interactionをギャラリー表示する。
 */
export function ActionDistributionBars({
  distribution,
  selectedAction,
  onSelect,
}: {
  distribution: ActionDistribution;
  selectedAction: string | null;
  onSelect: (action: string | null) => void;
}) {
  if (distribution.total === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink-muted">
        分母に入る記録がありません（判別不能・低確度のみ）。
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {distribution.actions.map((a) => {
        const active = selectedAction === a.action;
        const low = isReferenceOnly(a.n);
        return (
          <li key={a.action}>
            <button
              type="button"
              onClick={() => onSelect(active ? null : a.action)}
              aria-pressed={active}
              className={`flex min-h-11 w-full flex-col gap-1 rounded px-2 py-2 text-left transition-colors ${
                active ? "bg-surface-2/70" : "hover:bg-surface-2/40"
              } ${low ? "opacity-70" : ""}`}
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-ink-primary">
                  {studyActionLabel(a.action)}
                </span>
                <span className="font-frame text-[10px] text-ink-muted">{a.action}</span>
                {low ? <ReferenceBadge /> : null}
                <span className="ml-auto font-frame text-xs tabular-nums text-ink-secondary">
                  {formatPercent(a.share)} <span className="text-ink-muted">/ {a.n}件</span>
                </span>
              </div>
              <RateBar rate={a.share} ci={a.shareCi} />
              <div className="font-frame text-[10px] tabular-nums text-ink-muted">
                使用率95%CI {ciText(a.shareCi)} · 勝率{" "}
                <span className={a.winRate >= 0.5 ? "text-action" : "text-ink-secondary"}>
                  {formatPercent(a.winRate)}
                </span>
                （{a.won}-{a.lost}-{a.even}） · 撃墜 {a.kills}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
