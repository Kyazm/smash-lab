// 全体戦績ダッシュボード（"/stats"、ADR-0015）。全キャラ合算のモード別サマリ・キャラ別ランキング・連勝・時系列。
// モードフィルタ（全体/各モード）で切替。アカウント分離はプロバイダ層が担保（owner=Supabase / guest=ローカル）。
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { matchProvider } from "../data/match";
import type { MatchMode, MatchResult } from "../data/match/types";
import { MATCH_MODES, MATCH_MODE_LABELS } from "../data/match/types";
import { dataProvider } from "../data";
import {
  bestWorstMatchups,
  computeStreaks,
  computeSummary,
  filterByRange,
  groupByMode,
  rankByCharacter,
  type MatchRange,
} from "../lib/matchStats";
import { makeGroupResolver } from "../lib/characterGroups";
import { MatchTimeline } from "../components/match/MatchTimeline";
import { VipRankCalculator } from "../components/match/VipRankCalculator";
import { BrandMark } from "../components/BrandMark";
import {
  CharacterRanking,
  CumulativeWinRateChart,
  ModeSummary,
  RangePicker,
  RecentForm,
  StreakBadges,
  TopMatchups,
  WinRateBar,
} from "../components/match/charts";
import type { Character } from "../types";

type Filter = "all" | MatchMode;

export function StatsPage() {
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [charById, setCharById] = useState<Map<string, Character>>(new Map());
  const [filter, setFilter] = useState<Filter>("all");
  const [range, setRange] = useState<MatchRange>({ kind: "all" });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    matchProvider
      .listResults()
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("[StatsPage] listResults 失敗", e);
          setResults([]);
        }
      });
    dataProvider
      .listCharacters()
      .then((list) => {
        if (!cancelled) setCharById(new Map(list.map((c) => [c.id, c])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // 対戦履歴からの誤記録削除（undoを逃した記録の訂正）。
  const onDeleteResult = async (id: string) => {
    if (!window.confirm("この対戦記録を削除しますか？")) return;
    try {
      await matchProvider.deleteResult(id);
      setRefresh((x) => x + 1);
    } catch (e) {
      console.error("[StatsPage] deleteResult 失敗", e);
    }
  };

  // ポケトレ/ホムヒカは1キャラ扱い。対戦相手idを代表に正規化してから集計・ランキングする。
  const resolver = useMemo(() => makeGroupResolver([...charById.values()]), [charById]);
  const all = useMemo(
    () => (results ?? []).map((r) => ({ ...r, characterId: resolver.normalizeId(r.characterId) })),
    [results, resolver],
  );
  const byMode = useMemo(() => groupByMode(all), [all]);
  const filtered = filter === "all" ? all : byMode[filter];
  // 勝率カードだけ範囲絞り込み（全体/直近N戦/N日間）を適用する。ランキング・履歴はモードフィルタのまま。
  const rangeResults = useMemo(() => filterByRange(filtered, range), [filtered, range]);
  const summary = computeSummary(rangeResults);
  const streaks = computeStreaks(rangeResults);
  const ranking = useMemo(() => rankByCharacter(filtered), [filtered]);
  const { best, worst } = useMemo(() => bestWorstMatchups(ranking), [ranking]);

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className="text-xs text-ink-muted hover:text-ink-primary">
          ← キャラ一覧
        </Link>
        <BrandMark size="sm" />
      </div>
      <h1 className="mt-2 text-lg font-semibold text-ink-secondary">戦績</h1>

      {/* モードフィルタ（全体 + 3モード） */}
      <div className="mt-3 inline-flex rounded-md border border-border-subtle bg-surface-1 p-0.5">
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

      {/* VIPランク計算（VIP関連なので全体/VIP選択時のみ）。戦績0でも使えるよう条件分岐の外に置く。 */}
      {filter === "all" || filter === "vip" ? (
        <div className="mt-4 max-w-2xl">
          <VipRankCalculator />
        </div>
      ) : null}

      {results === null ? (
        <p className="mt-4 text-sm text-ink-muted">読み込み中…</p>
      ) : all.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">
          まだ戦績がありません。キャラ一覧の各キャラ横の「勝／負」ボタンから記録できます。
        </p>
      ) : (
        // デスクトップは2カラム（余白活用）。サマリ+グラフと履歴は横幅がある方が見やすいので全幅。
        // カードは適切幅で2カラムに並べ、余白を埋める。履歴のみ横幅がある方が見やすいので全幅。
        <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                {filter === "all" ? "全体" : MATCH_MODE_LABELS[filter]}（{summary.total}試合）
              </p>
              <RangePicker value={range} onChange={setRange} />
            </div>
            <div className="mb-4">
              <WinRateBar wins={summary.wins} losses={summary.losses} />
            </div>
            <StreakBadges current={streaks.current} maxWin={streaks.maxWin} maxLose={streaks.maxLose} />
            <div className="mt-4">
              <CumulativeWinRateChart results={rangeResults} nameFor={resolver.displayNameForId} />
            </div>
          </section>

          <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
            <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              直近フォーム
            </p>
            <RecentForm results={filtered} />
          </section>

          <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
            <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              得意・苦手キャラ（3戦以上）
            </p>
            <TopMatchups best={best} worst={worst} charById={charById} nameFor={resolver.displayNameForId} />
          </section>

          {filter === "all" ? (
            <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
              <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                モード別サマリ
              </p>
              <ModeSummary byMode={byMode} />
            </section>
          ) : null}

          <section className="rounded-xl border border-border-subtle bg-surface-1 p-4 md:col-span-2">
            <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              キャラ別ランキング
            </p>
            <CharacterRanking entries={ranking} charById={charById} nameFor={resolver.displayNameForId} />
          </section>

          <section className="rounded-xl border border-border-subtle bg-surface-1 p-4 md:col-span-2">
            <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              対戦履歴（新しい順）
            </p>
            <MatchTimeline
              results={filtered}
              charById={charById}
              nameFor={resolver.displayNameForId}
              onDelete={onDeleteResult}
            />
          </section>
        </div>
      )}
    </div>
  );
}
