// キャラ詳細の戦績ブロック（ADR-0015）。character_id=このキャラ（対戦相手）としての vs 成績。
// 旧「戦績」タブを廃止し、キャラ名下に常設表示する（モード選択+勝/負は常時、詳細は折りたたみ可・既定展開）。
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

export function CharacterStatsTab({
  characterId,
  noteHref,
}: {
  characterId: string;
  /** 負け記録直後の「メモ→」導線（キャラ対メモタブ）。 */
  noteHref?: string;
}) {
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2">
        <ModeSelector />
        <WinLoseControl
          characterId={characterId}
          mode={mode}
          wins={summary.wins}
          losses={summary.losses}
          current={streaks.current}
          onChanged={onChanged}
          showRecord={false}
          noteHref={noteHref}
        />
      </div>

      {/* 詳細（連勝・推移・モード別）は折りたたみ可・既定展開（トップの戦績サマリと同じ流儀）。 */}
      <details open className="rounded-xl border border-border-subtle bg-surface-0">
        <summary className="min-h-11 cursor-pointer list-none px-4 py-2.5 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-secondary [&::-webkit-details-marker]:hidden">
          ▾ 戦績（{MATCH_MODE_LABELS[mode]} {summary.wins}-{summary.losses}）
        </summary>
        <div className="space-y-3 px-3 pb-3">
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
      </details>
    </div>
  );
}
