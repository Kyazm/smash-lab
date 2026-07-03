// モード選択セグメント（VIP/スマメイト/オフライン）（ADR-0015）。選択は matchModeContext で端末に永続。
import { useMatchMode } from "../../lib/matchModeContext";
import { MATCH_MODES, MATCH_MODE_LABELS } from "../../data/match/types";

export function ModeSelector({ className = "" }: { className?: string }) {
  const { mode, setMode } = useMatchMode();
  return (
    <div className={`inline-flex rounded-md border border-border-subtle bg-surface-1 p-0.5 ${className}`}>
      {MATCH_MODES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={`min-h-9 rounded px-3 text-xs font-medium transition-colors ${
            mode === m ? "bg-action text-white" : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          {MATCH_MODE_LABELS[m]}
        </button>
      ))}
    </div>
  );
}
