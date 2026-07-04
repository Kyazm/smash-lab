// トップ（キャラ一覧）用の戦績ダイジェスト。モードは記録先と共通（matchModeContext）で連動する。
// 表示: 選択モードのサマリ＋モード別サマリ（全モード俯瞰）＋VIPランク計算（VIP選択時のみ）。
import { useEffect, useState } from "react";
import { matchProvider } from "../../data/match";
import type { MatchResult } from "../../data/match/types";
import { MATCH_MODE_LABELS } from "../../data/match/types";
import { useMatchMode } from "../../lib/matchModeContext";
import { computeStreaks, computeSummary, groupByMode } from "../../lib/matchStats";
import { ModeSummary, StreakBadges, WinRateBar } from "./charts";
import { VipRankCalculator } from "./VipRankCalculator";

export function MatchDigest({ refreshKey }: { refreshKey: number }) {
  const { mode } = useMatchMode();
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
  const modeResults = byMode[mode];
  const summary = computeSummary(modeResults);
  const streaks = computeStreaks(modeResults);

  return (
    <div className="space-y-3">
      {/* VIPランク計算（VIP選択時のみ。世界戦闘力→段位） */}
      {mode === "vip" ? <VipRankCalculator /> : null}

      {/* 選択モード（記録先と連動）のサマリ */}
      <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
        <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          {MATCH_MODE_LABELS[mode]}（{summary.total}試合）
        </p>
        <WinRateBar wins={summary.wins} losses={summary.losses} />
        <div className="mt-3">
          <StreakBadges current={streaks.current} maxWin={streaks.maxWin} maxLose={streaks.maxLose} />
        </div>
      </section>

      {/* モード別サマリ（全モードの俯瞰） */}
      <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
        <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          モード別サマリ
        </p>
        <ModeSummary byMode={byMode} />
      </section>
    </div>
  );
}
