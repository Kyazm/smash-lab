// 戦績グラフ部品（ADR-0015）。チャートライブラリ非導入のため手書きSVG/CSS＋デザイントークン。
// 色: 勝ち=accent-red（このデザインの主アクセント＝ポジ）、負け=中立グレー（surface-2/border/muted）。
// 数値は font-frame tabular-nums で桁を揃える（フレーム表と同じ流儀）。
import { useState } from "react";
import type { MatchMode, MatchResult } from "../../data/match/types";
import { MATCH_MODES, MATCH_MODE_LABELS } from "../../data/match/types";
import { computeSummary, type CharacterRankEntry } from "../../lib/matchStats";
import { CharacterIcon } from "../shared/CharacterIcon";
import type { Character } from "../../types";

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
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

/**
 * 累積勝率の折れ線（SVG）。x=試合番号、y=0..100%。各試合を点で打ち（勝=白/負=赤）、
 * ホバー/タップでその試合の相手・勝敗・時刻・その時点の勝率をツールチップ表示する。
 * results は createdAt 昇順の対戦記録。nameFor を渡すと相手名も出す（1キャラ表示など不要なら省略可）。
 */
export function CumulativeWinRateChart({
  results,
  nameFor,
}: {
  results: MatchResult[];
  nameFor?: (id: string) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (results.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">記録がありません。</p>;
  }
  const W = 300;
  const H = 100;
  const n = results.length;
  const xAt = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const yAt = (rate: number) => H - rate * H;

  // 各試合の累積勝率と点座標＋メタ。
  let wins = 0;
  const pts = results.map((r, i) => {
    if (r.result === "win") wins += 1;
    const winRate = wins / (i + 1);
    return { x: xAt(i), y: yAt(winRate), winRate, result: r.result, characterId: r.characterId, createdAt: r.createdAt };
  });
  const coordStr = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ");
  const linePath = `M ${coordStr}`;
  const areaPath = `M ${pts[0].x.toFixed(1)},${H} L ${coordStr} L ${pts[n - 1].x.toFixed(1)},${H} Z`;
  const last = pts[n - 1];
  const cur = active != null ? pts[active] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-24 w-full"
        role="img"
        aria-label={`累積勝率 ${pct(last.winRate)}`}
        onMouseLeave={() => setActive(null)}
      >
        {/* 50% 基準線 */}
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgb(var(--border-subtle))" strokeWidth="1" strokeDasharray="4 4" />
        <path d={areaPath} fill="rgb(var(--color-action) / 0.12)" />
        <path d={linePath} fill="none" stroke="rgb(var(--color-action))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {/* アクティブ点の縦ガイド */}
        {cur ? (
          <line x1={cur.x} y1="0" x2={cur.x} y2={H} stroke="rgb(var(--color-action) / 0.4)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ) : null}
        {/* 各試合の点。勝=オフホワイト / 負=赤。 */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={active === i ? 3.5 : 2}
            fill={p.result === "lose" ? "rgb(var(--color-action))" : "rgb(var(--text-primary))"}
          />
        ))}
        {/* 当たり判定（透明・広め）。ホバーとタップの両対応。 */}
        {pts.map((p, i) => (
          <circle
            key={`hit-${i}`}
            cx={p.x}
            cy={p.y}
            r={7}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive((v) => (v === i ? null : i))}
          />
        ))}
      </svg>

      {cur ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-[10px] leading-tight shadow-xl"
          style={{ left: `${Math.min(90, Math.max(10, (cur.x / W) * 100))}%` }}
        >
          <div className="font-frame tabular-nums text-ink-muted">
            {active! + 1}試合目 · {hhmm(cur.createdAt)}
          </div>
          <div className="font-medium text-ink-primary">
            <span className={cur.result === "lose" ? "text-action" : "text-ink-secondary"}>
              {cur.result === "lose" ? "負" : "勝"}
            </span>
            {nameFor ? ` ${nameFor(cur.characterId)}` : ""}
          </div>
          <div className="font-frame tabular-nums text-ink-muted">勝率 {pct(cur.winRate)}</div>
        </div>
      ) : null}

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
  nameFor,
}: {
  entries: CharacterRankEntry[];
  charById: Map<string, Character>;
  limit?: number;
  /** 表示名の上書き（ポケトレ/ホムヒカを「ポケモントレーナー」等のグループ名にする）。 */
  nameFor?: (id: string) => string;
}) {
  const shown = limit ? entries.slice(0, limit) : entries;
  if (shown.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">まだ記録がありません。</p>;
  }
  return (
    <ul className="divide-y divide-border-subtle">
      {shown.map((e) => {
        const c = charById.get(e.characterId);
        const name = nameFor ? nameFor(e.characterId) : c?.name_ja ?? "不明";
        return (
          <li key={e.characterId} className="flex items-center gap-3 py-2">
            <span className="flex min-w-0 shrink-0 items-center gap-2" style={{ width: "9rem" }}>
              {c ? <CharacterIcon character={c} size="sm" /> : null}
              <span className="truncate text-sm text-ink-primary">{name}</span>
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
