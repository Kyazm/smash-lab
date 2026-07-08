// フレーム間引きの純関数（crv core.py の dedup_frames / max_frames cap を移植・純化）。
// 実ピクセル差分（16x16 RGB のダウンスケール）で近傍重複を落とす。知覚ハッシュより
// 平坦色・輝度のみの変化に強い（crv 準拠）。IO（ffmpeg でのサムネイル化）は video.ts 側。
import {
  DEDUP_PIXEL_DIFF,
  DEDUP_RATIO,
  DEDUP_THUMB_SIZE,
  DEDUP_WINDOW,
  MAX_FRAMES_PER_SCENE,
} from "../config.js";

const THUMB_BYTES = DEDUP_THUMB_SIZE * DEDUP_THUMB_SIZE * 3; // 16*16*3 = 768

/** 2枚の 16x16 RGB サムネイル間で「変化した画素の割合」を返す（0..1）。 */
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
 * sliding window は A-B-A 交互（間に別カットが挟まった既視ショット）も弾く（crv 準拠）。
 * @param thumbs 各フレームの 768byte(16x16 RGB) サムネイル。時刻昇順であること。
 * @param meta   thumbs と同順のメタ（tSec）。長さ検証にのみ使用。
 * @returns 採用するフレームの index（thumbs への添字、昇順）。
 */
export function dedupFrames(
  thumbs: Uint8Array[],
  meta: { tSec: number }[],
  opts: { ratio?: number; window?: number; tol?: number } = {},
): number[] {
  if (thumbs.length !== meta.length) {
    throw new Error(`dedupFrames: thumbs(${thumbs.length}) と meta(${meta.length}) の長さ不一致`);
  }
  const ratio = opts.ratio ?? DEDUP_RATIO;
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

/**
 * 配列を上限 max へ「時間軸均等」に間引く（純関数、crv の cap 相当）。
 * 順序は保持。max 以下ならそのまま返す。
 */
export function thinUniform<T>(items: T[], max: number = MAX_FRAMES_PER_SCENE): T[] {
  if (items.length <= max) return items.slice();
  const step = items.length / max;
  const keepIdx = new Set<number>();
  for (let i = 0; i < max; i++) keepIdx.add(Math.floor(i * step));
  return items.filter((_, i) => keepIdx.has(i));
}

export { THUMB_BYTES };
