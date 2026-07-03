// 戦績モード（VIP/スマメイト/オフライン）選択の Context 化（ADR-0015）。
// 一覧の勝敗ボタン・戦績タブ・/stats で共有する「現在のモード」。端末に永続する（自キャラ選択と同様の軽量UI状態）。
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MatchMode } from "../data/match/types";
import { MATCH_MODES } from "../data/match/types";

const STORAGE_KEY = "smash-lab.match-mode.v1";
const DEFAULT_MODE: MatchMode = "vip";

function readInitial(): MatchMode {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_MODE;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw && (MATCH_MODES as string[]).includes(raw) ? (raw as MatchMode) : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

interface MatchModeContextValue {
  mode: MatchMode;
  setMode: (mode: MatchMode) => void;
}

const MatchModeContext = createContext<MatchModeContextValue | null>(null);

export function MatchModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<MatchMode>(readInitial);

  useEffect(() => {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // 永続失敗は致命的でない（UI状態のため）。
    }
  }, [mode]);

  return (
    <MatchModeContext.Provider value={{ mode, setMode: setModeState }}>
      {children}
    </MatchModeContext.Provider>
  );
}

export function useMatchMode(): MatchModeContextValue {
  const ctx = useContext(MatchModeContext);
  if (!ctx) throw new Error("useMatchMode must be used within MatchModeProvider");
  return ctx;
}
