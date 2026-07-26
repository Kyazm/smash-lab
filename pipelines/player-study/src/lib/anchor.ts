// ストック変化アンカー検出（純関数）。1fps 各フレームの下部HUD帯を 32x8 に縮小したサムネイル列
// （video.ts で ffmpeg crop+scale して生成）を受け取り、隣接秒の差分率がしきい値超の秒を返す。
// %の大変動やストック減で反応する。過検出は許容（Claude セッションが検証する設計 / ADR-0020）。
import { ANCHOR_DIFF_THRESHOLD, ANCHOR_PIXEL_TOL } from "../config.js";
import { pixelChangeRatio } from "./frames.js";

export interface AnchorOptions {
  threshold?: number; // 差分率のしきい値（超で候補）
  tol?: number; // 変化と判定するチャネル差
  fps?: number; // サムネイル列の fps（既定1 → index=秒）
}

/**
 * 隣接サムネイル間の差分率が threshold を超える秒（=変化が観測された側の秒）を返す（純関数）。
 * thumbs[i] は t = i / fps 秒のフレーム。返り値は昇順・重複なしの秒（整数寄り、fps=1なら整数秒）。
 */
export function detectStockAnchors(thumbs: Uint8Array[], opts: AnchorOptions = {}): number[] {
  const threshold = opts.threshold ?? ANCHOR_DIFF_THRESHOLD;
  const tol = opts.tol ?? ANCHOR_PIXEL_TOL;
  const fps = opts.fps ?? 1;
  const anchors: number[] = [];
  for (let i = 1; i < thumbs.length; i++) {
    const ratio = pixelChangeRatio(thumbs[i - 1], thumbs[i], tol);
    if (ratio > threshold) {
      anchors.push(Math.round((i / fps) * 100) / 100);
    }
  }
  return anchors;
}

/**
 * 近接アンカーを1つにまとめる（純関数）。撃墜1回で複数秒連続反応することがあるため、
 * minGapSec 以内に連続する候補は先頭のみ残す。
 */
export function coalesceAnchors(anchors: number[], minGapSec: number): number[] {
  const sorted = [...anchors].sort((a, b) => a - b);
  const out: number[] = [];
  for (const a of sorted) {
    if (out.length === 0 || a - out[out.length - 1] > minGapSec) out.push(a);
  }
  return out;
}
