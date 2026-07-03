// 勝敗ワンタップ記録（ADR-0015）。一覧の各行と戦績タブで共用。
// タップ→addResult→onChanged で親が再取得。直後数秒は「取消」を出し deleteResult で undo（行内完結・グローバルtoast不要）。
import { useEffect, useRef, useState } from "react";
import { matchProvider } from "../../data/match";
import type { MatchMode, MatchOutcome } from "../../data/match/types";

export function WinLoseControl({
  characterId,
  mode,
  wins,
  losses,
  current,
  onChanged,
  showRecord = true,
}: {
  characterId: string;
  mode: MatchMode;
  wins: number;
  losses: number;
  current: number;
  onChanged: () => void;
  showRecord?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const record = async (result: MatchOutcome) => {
    if (busy) return;
    setBusy(true);
    try {
      const rec = await matchProvider.addResult({ characterId, mode, result });
      setLastId(rec.id);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLastId(null), 5000);
      onChanged();
    } catch (e) {
      console.error("[WinLoseControl] addResult 失敗", e);
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!lastId || busy) return;
    setBusy(true);
    try {
      await matchProvider.deleteResult(lastId);
      setLastId(null);
      if (timer.current) window.clearTimeout(timer.current);
      onChanged();
    } catch (e) {
      console.error("[WinLoseControl] deleteResult 失敗", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {showRecord && (wins > 0 || losses > 0) ? (
        <span className="hidden font-frame text-[10px] tabular-nums text-ink-muted sm:inline">
          {wins}-{losses}
          {current !== 0 ? (current > 0 ? ` 🔥${current}` : ` ❄${-current}`) : ""}
        </span>
      ) : null}
      {lastId ? (
        <button
          type="button"
          onClick={undo}
          disabled={busy}
          className="min-h-11 rounded-md border border-border-subtle px-2 text-xs text-ink-muted hover:text-ink-primary disabled:opacity-50"
        >
          取消
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => record("win")}
            disabled={busy}
            aria-label="勝ち"
            className="min-h-11 min-w-11 rounded-md bg-action px-3 text-sm font-bold text-white hover:bg-action-strong disabled:opacity-50"
          >
            勝
          </button>
          <button
            type="button"
            onClick={() => record("lose")}
            disabled={busy}
            aria-label="負け"
            className="min-h-11 min-w-11 rounded-md border border-border bg-surface-2 px-3 text-sm font-medium text-ink-secondary hover:text-ink-primary disabled:opacity-50"
          >
            負
          </button>
        </>
      )}
    </div>
  );
}
