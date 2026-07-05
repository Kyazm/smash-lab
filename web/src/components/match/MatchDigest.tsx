// トップ（キャラ一覧）用の戦績ダイジェスト。モードは記録先と共通（matchModeContext）で連動する。
// 表示: 選択モードのサマリ（左）＋累積勝率グラフ（右）＋モード別サマリ（下・全幅）＋VIPランク計算（VIP時）。
import { useEffect, useMemo, useState } from "react";
import { matchProvider } from "../../data/match";
import { dataProvider } from "../../data";
import type { MatchResult } from "../../data/match/types";
import { MATCH_MODE_LABELS } from "../../data/match/types";
import { useMatchMode } from "../../lib/matchModeContext";
import { makeGroupResolver } from "../../lib/characterGroups";
import { computeStreaks, computeSummary, groupByMode } from "../../lib/matchStats";
import { CumulativeWinRateChart, ModeSummary, StreakBadges, WinRateBar } from "./charts";
import { VipRankCalculator } from "./VipRankCalculator";
import type { Character } from "../../types";

export function MatchDigest({ refreshKey }: { refreshKey: number }) {
  const { mode } = useMatchMode();
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [charById, setCharById] = useState<Map<string, Character>>(new Map());

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

  useEffect(() => {
    let cancelled = false;
    dataProvider
      .listCharacters()
      .then((list) => {
        if (!cancelled) setCharById(new Map(list.map((c) => [c.id, c])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const resolver = useMemo(() => makeGroupResolver([...charById.values()]), [charById]);
  const all = results ?? [];
  const byMode = groupByMode(all);
  const modeResults = byMode[mode];
  const summary = computeSummary(modeResults);
  const streaks = computeStreaks(modeResults);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* VIPランク計算（VIP選択時のみ。世界戦闘力→段位） */}
      {mode === "vip" ? (
        <div className="md:col-span-2">
          <VipRankCalculator />
        </div>
      ) : null}

      {/* 選択モード（記録先と連動）のサマリ（左） */}
      <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
        <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          {MATCH_MODE_LABELS[mode]}（{summary.total}試合）
        </p>
        <WinRateBar wins={summary.wins} losses={summary.losses} />
        <div className="mt-3">
          <StreakBadges current={streaks.current} maxWin={streaks.maxWin} maxLose={streaks.maxLose} />
        </div>
      </section>

      {/* 勝率の推移グラフ（右） */}
      <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
        <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          勝率の推移
        </p>
        <CumulativeWinRateChart results={modeResults} nameFor={resolver.displayNameForId} />
      </section>

      {/* モード別サマリ（全モードの俯瞰・全幅） */}
      <section className="rounded-xl border border-border-subtle bg-surface-1 p-4 md:col-span-2">
        <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          モード別サマリ
        </p>
        <ModeSummary byMode={byMode} />
      </section>
    </div>
  );
}
