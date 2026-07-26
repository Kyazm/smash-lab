// フレーム間引きの純関数（review-match/src/lib/frames.ts を流用・scan 用に緩め既定）。
// 実ピクセル差分（16x16 RGB のダウンスケール）で近傍重複を落とす。IO（ffmpeg）は video.ts 側。
import { DEDUP_PIXEL_DIFF, DEDUP_WINDOW, SCAN_DEDUP_RATIO } from "../config.js";

/** 2枚の同サイズ RGB サムネイル間で「変化した画素の割合」を返す（0..1）。純関数。 */
export function pixelChangeRatio(
  a: Uint8Array,
  b: Uint8Array,
  tol: number = DEDUP_PIXEL_DIFF,
): number {
  const pixels = Math.min(a.length, b.length) / 3;
  if (pixels === 0) return 0;
  let changed = 0;
  for (let i = 0; i < pixels; i++) {
    const o = i * 3;
    const dr = Math.abs(a[o] - b[o]);
    const dg = Math.abs(a[o + 1] - b[o + 1]);
    const db = Math.abs(a[o + 2] - b[o + 2]);
    if (Math.max(dr, dg, db) > tol) changed++;
  }
  return changed / pixels;
}

/**
 * 直近 window 枚の採用フレームと比較し、変化画素率が ratio 超のフレームだけ採用する（純関数）。
 * A-B-A 交互（間に別カットが挟まった既視ショット）も弾く。
 * @param thumbs 各フレームの 16x16 RGB サムネイル（768byte）。時刻昇順であること。
 * @returns 採用するフレームの index（thumbs への添字、昇順）。
 */
export function dedupFrames(
  thumbs: Uint8Array[],
  opts: { ratio?: number; window?: number; tol?: number } = {},
): number[] {
  const ratio = opts.ratio ?? SCAN_DEDUP_RATIO;
  const window = opts.window ?? DEDUP_WINDOW;
  const tol = opts.tol ?? DEDUP_PIXEL_DIFF;

  const keep: number[] = [];
  const recent: Uint8Array[] = []; // 直近 window 枚の採用サムネイル
  for (let i = 0; i < thumbs.length; i++) {
    const h = thumbs[i];
    let minDist = Infinity;
    for (const k of recent) {
      const d = pixelChangeRatio(h, k, tol);
      if (d < minDist) minDist = d;
    }
    if (recent.length === 0 || minDist > ratio) {
      keep.push(i);
      recent.push(h);
      if (recent.length > window) recent.shift();
    }
  }
  return keep;
}

/** Buffer を size byte 単位に分割して Uint8Array[] にする（純関数、rawvideo 分割用）。 */
export function sliceBuffers(buf: Uint8Array, size: number): Uint8Array[] {
  const count = Math.floor(buf.length / size);
  const out: Uint8Array[] = [];
  for (let i = 0; i < count; i++) out.push(buf.subarray(i * size, (i + 1) * size));
  return out;
}
