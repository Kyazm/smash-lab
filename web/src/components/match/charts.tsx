// 戦績グラフ部品（ADR-0015）。チャートライブラリ非導入のため手書きSVG/CSS＋デザイントークン。
// 色: 勝ち=accent-red（このデザインの主アクセント＝ポジ）、負け=中立グレー（surface-2/border/muted）。
// 数値は font-frame tabular-nums で桁を揃える（フレーム表と同じ流儀）。
import type { MatchMode, MatchResult } from "../../data/match/types";
import { MATCH_MODES, MATCH_MODE_LABELS } from "../../data/match/types";
import { computeSummary, type CharacterRankEntry, type WinRatePoint } from "../../lib/matchStats";
import { CharacterIcon } from "../shared/CharacterIcon";
import type { Character } from "../../types";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** 勝率の横バー。wins=赤、losses=中立トラック。右に W-L と勝率%。 */
export function WinRateBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  const rate = total === 0 ? 0 : wins / total;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-action" style={{ width: `${rate * 100}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right font-frame text-xs tabular-nums text-ink-secondary">
        <span className="text-ink-primary">{pct(rate)}</span>
        <span className="text-ink-muted"> · {wins}-{losses}</span>
      </span>
    </div>
  );
}

/** 現在の連勝/連敗を大きく、最長を小さく。current 符号: +連勝 / −連敗。 */
export function StreakBadges({
  current,
  maxWin,
  maxLose,
}: {
  current: number;
  maxWin: number;
  maxLose: number;
}) {
  const isWin = current > 0;
  const isLose = current < 0;
  const n = Math.abs(current);
  return (
    <div className="flex items-end gap-4">
      <div>
        <p className="font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">現在</p>
        <p
          className={`font-display text-3xl leading-none tabular-nums ${
            isWin ? "text-action" : isLose ? "text-ink-secondary" : "text-ink-muted"
          }`}
        >
          {isWin ? `🔥${n}` : isLose ? `❄${n}` : "—"}
          <span className="ml-1 font-sans text-xs text-ink-muted">
            {isWin ? "連勝" : isLose ? "連敗" : ""}
          </span>
        </p>
      </div>
      <div className="flex gap-3 pb-1 font-frame text-xs tabular-nums text-ink-muted">
        <span>最長連勝 <span className="text-action">{maxWin}</span></span>
        <span>最長連敗 <span className="text-ink-secondary">{maxLose}</span></span>
      </div>
    </div>
  );
}

/** 累積勝率の折れ線（SVG）。x=試合番号、y=0..100%。50%薄グリッド・終点ドット・薄いエリア塗り。 */
export function CumulativeWinRateChart({ series }: { series: WinRatePoint[] }) {
  if (series.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">記録がありません。</p>;
  }
  const W = 300;
  const H = 100;
  const n = series.length;
  // 1点のみだと線が引けないので横一直線にする。
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (rate: number) => H - rate * H;
  const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.winRate).toFixed(1)}`);
  const linePath = `M ${pts.join(" L ")}`;
  const areaPath = `M ${x(0).toFixed(1)},${H} L ${pts.join(" L ")} L ${x(n - 1).toFixed(1)},${H} Z`;
  const last = series[n - 1];
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-24 w-full"
        role="img"
        aria-label={`累積勝率 ${pct(last.winRate)}`}
      >
        {/* 50% 基準線 */}
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgb(var(--border-subtle))" strokeWidth="1" strokeDasharray="4 4" />
        <path d={areaPath} fill="rgb(var(--color-action) / 0.12)" />
        <path d={linePath} fill="none" stroke="rgb(var(--color-action))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <circle cx={x(n - 1)} cy={y(last.winRate)} r="3" fill="rgb(var(--color-action))" />
      </svg>
      <div className="mt-1 flex justify-between font-frame text-[10px] tabular-nums text-ink-muted">
        <span>1試合目</span>
        <span>直近 {pct(last.winRate)}（{n}試合）</span>
      </div>
    </div>
  );
}

/** モード別サマリ（3行）。該当なしのモードも0-0で表示。 */
export function ModeSummary({ byMode }: { byMode: Record<MatchMode, MatchResult[]> }) {
  return (
    <div className="space-y-2">
      {MATCH_MODES.map((m) => {
        const s = computeSummary(byMode[m]);
        return (
          <div key={m} className="flex items-center gap-3">
            <span className="w-20 shrink-0 font-frame text-xs uppercase tracking-[0.18em] text-ink-secondary">
              {MATCH_MODE_LABELS[m]}
            </span>
            <div className="flex-1">
              <WinRateBar wins={s.wins} losses={s.losses} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 対戦相手キャラ別ランキング（勝率降順）。得意/苦手が一目で分かる。 */
export function CharacterRanking({
  entries,
  charById,
  limit,
}: {
  entries: CharacterRankEntry[];
  charById: Map<string, Character>;
  limit?: number;
}) {
  const shown = limit ? entries.slice(0, limit) : entries;
  if (shown.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">まだ記録がありません。</p>;
  }
  return (
    <ul className="divide-y divide-border-subtle">
      {shown.map((e) => {
        const c = charById.get(e.characterId);
        return (
          <li key={e.characterId} className="flex items-center gap-3 py-2">
            <span className="flex min-w-0 shrink-0 items-center gap-2" style={{ width: "9rem" }}>
              {c ? <CharacterIcon character={c} size="sm" /> : null}
              <span className="truncate text-sm text-ink-primary">{c?.name_ja ?? "不明"}</span>
            </span>
            <div className="flex-1">
              <WinRateBar wins={e.wins} losses={e.losses} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
