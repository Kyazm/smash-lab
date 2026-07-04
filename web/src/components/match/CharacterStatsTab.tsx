// キャラ詳細の「戦績」タブ（ADR-0015）。character_id=このキャラ（対戦相手）としての vs 成績。
// 現在のモード（matchModeContext）で連勝・時系列を出し、モード別サマリは3モード横断で見せる。
import { useEffect, useState } from "react";
import { matchProvider } from "../../data/match";
import type { MatchResult } from "../../data/match/types";
import { MATCH_MODE_LABELS } from "../../data/match/types";
import { useMatchMode } from "../../lib/matchModeContext";
import {
  computeStreaks,
  computeSummary,
  groupByMode,
} from "../../lib/matchStats";
import { ModeSelector } from "./ModeSelector";
import { WinLoseControl } from "./WinLoseControl";
import {
  CumulativeWinRateChart,
  ModeSummary,
  StreakBadges,
} from "./charts";

export function CharacterStatsTab({ characterId }: { characterId: string }) {
  const { mode } = useMatchMode();
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    matchProvider
      .listResults({ characterId })
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("[CharacterStatsTab] listResults 失敗", e);
          setResults([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [characterId, refresh]);

  if (results === null) {
    return <p className="text-sm text-ink-muted">読み込み中…</p>;
  }

  const byMode = groupByMode(results);
  const modeResults = byMode[mode]; // provider が createdAt 昇順で返すため順序は保持される
  const summary = computeSummary(modeResults);
  const streaks = computeStreaks(modeResults);
  const onChanged = () => setRefresh((x) => x + 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ModeSelector />
        <WinLoseControl
          characterId={characterId}
          mode={mode}
          wins={summary.wins}
          losses={summary.losses}
          current={streaks.current}
          onChanged={onChanged}
          showRecord={false}
        />
      </div>

      <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
        <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          {MATCH_MODE_LABELS[mode]} の成績
        </p>
        <StreakBadges current={streaks.current} maxWin={streaks.maxWin} maxLose={streaks.maxLose} />
        <div className="mt-4">
          <CumulativeWinRateChart results={modeResults} />
        </div>
      </section>

      <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
        <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          モード別サマリ
        </p>
        <ModeSummary byMode={byMode} />
      </section>
    </div>
  );
}
