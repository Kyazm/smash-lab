// フレームバー可視化用の純粋関数（docs/06 A-2: 1F=1ブロック、発生グレー/持続赤/残り硬直青）。
// UFD由来の active 文字列は表記揺れが激しい（"3-4", "5-6/14", "¯\_(ツ)_/¯ (...)" 等）。
// 最初のクリーンな "N" または "N-M" 区間のみを解釈し、それ以外は解析不能として扱う
// （フレームバーを描かず、生テキストのみ表示にフォールバックする）。
import type { Move } from "../types";

export interface FrameBarSegment {
  kind: "startup" | "active" | "recovery";
  frames: number;
}

export interface FrameBarResult {
  totalFrames: number;
  segments: FrameBarSegment[];
}

/** active 文字列の先頭区間から [開始F, 終了F] を抽出する。解析できなければ null。 */
export function parseActiveRange(active: string | null): [number, number] | null {
  if (!active) return null;
  const m = active.match(/^(\d+)(?:-(\d+))?/);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return [start, end];
}

/**
 * 技のフレーム構成をバー用セグメントに変換する。
 *   startup: 1 〜 (activeStart-1)
 *   active : activeStart 〜 activeEnd
 *   recovery: (activeEnd+1) 〜 faf
 * startup/faf が欠損、または active が解析不能な場合は null（呼び出し側はテキストのみ表示にフォールバック）。
 */
export function buildFrameBar(move: Pick<Move, "startup" | "active" | "faf">): FrameBarResult | null {
  if (move.startup == null || move.faf == null) return null;
  const range = parseActiveRange(move.active);
  if (!range) return null;
  const [activeStart, activeEnd] = range;
  if (activeStart < 1 || move.faf < activeEnd) return null;

  const segments: FrameBarSegment[] = [];
  const startupFrames = activeStart - 1;
  if (startupFrames > 0) segments.push({ kind: "startup", frames: startupFrames });
  segments.push({ kind: "active", frames: activeEnd - activeStart + 1 });
  const recoveryFrames = move.faf - activeEnd;
  if (recoveryFrames > 0) segments.push({ kind: "recovery", frames: recoveryFrames });

  return { totalFrames: move.faf, segments };
}
