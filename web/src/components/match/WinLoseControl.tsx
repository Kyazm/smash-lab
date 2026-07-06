// 勝敗ワンタップ記録（ADR-0015）。一覧の各行と戦績タブで共用。
// タップ→addResult→onChanged で親が再取得。直後数秒は「取消」を出し deleteResult で undo（行内完結・グローバルtoast不要）。
// ADR-0018: 負け記録直後は「メモ→」リンク（キャラ対メモ）を併置し、負けを学習に繋げる。負け時はundo窓を長めにする。
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { matchProvider } from "../../data/match";
import type { MatchMode, MatchOutcome } from "../../data/match/types";

const UNDO_MS_WIN = 5000;
const UNDO_MS_LOSE = 9000; // 負け→メモの導線を踏む余裕を持たせる

export function WinLoseControl({
  characterId,
  mode,
  wins,
  losses,
  current,
  onChanged,
  showRecord = true,
  noteHref,
}: {
  characterId: string;
  mode: MatchMode;
  wins: number;
  losses: number;
  current: number;
  onChanged: () => void;
  showRecord?: boolean;
  /** 負け記録直後に出すキャラ対メモへのリンク先（例: /c/mario?tab=notes）。省略時はリンク非表示。 */
  noteHref?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ id: string; result: MatchOutcome } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  // mode / 対戦相手が変わったら未確定のundo（取消）を破棄する。
  // 例: VIPで勝ちを記録→取消表示中にスマメイトへ切替、のとき取消を残すと別モードの記録を誤って消してしまう。
  useEffect(() => {
    setLast(null);
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, [mode, characterId]);

  const record = async (result: MatchOutcome) => {
    if (busy) return;
    setBusy(true);
    try {
      const rec = await matchProvider.addResult({ characterId, mode, result });
      setLast({ id: rec.id, result });
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLast(null), result === "lose" ? UNDO_MS_LOSE : UNDO_MS_WIN);
      onChanged();
    } catch (e) {
      console.error("[WinLoseControl] addResult 失敗", e);
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!last || busy) return;
    setBusy(true);
    try {
      await matchProvider.deleteResult(last.id);
      setLast(null);
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
      {last ? (
        <>
          {last.result === "lose" && noteHref ? (
            <Link
              to={noteHref}
              className="min-h-11 rounded-md border border-warning/40 bg-warning/10 px-2 py-2.5 text-xs font-medium text-warning hover:bg-warning/20"
            >
              メモ→
            </Link>
          ) : null}
          <button
            type="button"
            onClick={undo}
            disabled={busy}
            className="min-h-11 rounded-md border border-border-subtle px-2 text-xs text-ink-muted hover:text-ink-primary disabled:opacity-50"
          >
            取消
          </button>
        </>
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
