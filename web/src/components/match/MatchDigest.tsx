// トップ（キャラ一覧）用の戦績ダイジェスト。VIPランク計算・全体サマリ・モード別サマリに絞って表示する。
// モード別サマリは全モード（VIP/スマメイト/オフライン）。VIPランク計算はVIP専用概念のため1つだけ置く。
import { useEffect, useState } from "react";
import { matchProvider } from "../../data/match";
import type { MatchResult } from "../../data/match/types";
import { computeStreaks, computeSummary, groupByMode } from "../../lib/matchStats";
import { ModeSummary, StreakBadges, WinRateBar } from "./charts";
import { VipRankCalculator } from "./VipRankCalculator";

export function MatchDigest({ refreshKey }: { refreshKey: number }) {
  const [results, setResults] = useState<MatchResult[] | null>(null);

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
  const summary = computeSummary(all);
  const streaks = computeStreaks(all);

  return (
    <div className="space-y-3">
      {/* VIPランク計算（VIP専用。世界戦闘力→段位） */}
      <VipRankCalculator />

      {/* 全体サマリ（全モード合算） */}
      <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
        <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          全体（{summary.total}試合）
        </p>
        <WinRateBar wins={summary.wins} losses={summary.losses} />
        <div className="mt-3">
          <StreakBadges current={streaks.current} maxWin={streaks.maxWin} maxLose={streaks.maxLose} />
        </div>
      </section>

      {/* モード別サマリ（全モード） */}
      <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
        <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          モード別サマリ
        </p>
        <ModeSummary byMode={byMode} />
      </section>
    </div>
  );
}
