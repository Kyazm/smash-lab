// トップ（キャラ一覧）用の戦績ダイジェスト。VIPランク計算・全体/モードサマリ・モード別サマリに絞って表示。
// モードフィルタ（全体/VIP/スマメイト/オフライン）で切替。VIPランク計算は全体/VIP時のみ（/statsと同じ挙動）。
import { useEffect, useState } from "react";
import { matchProvider } from "../../data/match";
import type { MatchMode, MatchResult } from "../../data/match/types";
import { MATCH_MODES, MATCH_MODE_LABELS } from "../../data/match/types";
import { computeStreaks, computeSummary, groupByMode } from "../../lib/matchStats";
import { ModeSummary, StreakBadges, WinRateBar } from "./charts";
import { VipRankCalculator } from "./VipRankCalculator";

type Filter = "all" | MatchMode;

export function MatchDigest({ refreshKey }: { refreshKey: number }) {
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    matchProvider
      .listResults()
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("[MatchDigest] listResults 失敗", e);
          setResults([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const all = results ?? [];
  const byMode = groupByMode(all);
  const filtered = filter === "all" ? all : byMode[filter];
  const summary = computeSummary(filtered);
  const streaks = computeStreaks(filtered);

  return (
    <div className="space-y-3">
      {/* モードフィルタ（全体 + 3モード）。選んだモードのサマリに切替。 */}
      <div className="inline-flex rounded-md border border-border-subtle bg-surface-1 p-0.5">
        {(["all", ...MATCH_MODES] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`min-h-9 rounded px-3 text-xs font-medium transition-colors ${
              filter === f ? "bg-action text-white" : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            {f === "all" ? "全体" : MATCH_MODE_LABELS[f]}
          </button>
        ))}
      </div>

      {/* VIPランク計算（VIP専用。全体/VIP選択時のみ） */}
      {filter === "all" || filter === "vip" ? <VipRankCalculator /> : null}

      {/* 選んだモードのサマリ */}
      <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
        <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          {filter === "all" ? "全体" : MATCH_MODE_LABELS[filter]}（{summary.total}試合）
        </p>
        <WinRateBar wins={summary.wins} losses={summary.losses} />
        <div className="mt-3">
          <StreakBadges current={streaks.current} maxWin={streaks.maxWin} maxLose={streaks.maxLose} />
        </div>
      </section>

      {/* モード別サマリ（全体選択時のみ。モード選択中は上のサマリと重複するため出さない） */}
      {filter === "all" ? (
        <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
          <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            モード別サマリ
          </p>
          <ModeSummary byMode={byMode} />
        </section>
      ) : null}
    </div>
  );
}
