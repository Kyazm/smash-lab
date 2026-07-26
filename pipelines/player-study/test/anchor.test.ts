import { describe, expect, it } from "vitest";
import { coalesceAnchors, detectStockAnchors } from "../src/lib/anchor.js";

const THUMB_BYTES = 32 * 8 * 3; // 768

/** 全画素を fill で埋めた 32x8 RGB サムネイル。 */
function mkThumb(fill: number): Uint8Array {
  return new Uint8Array(THUMB_BYTES).fill(fill);
}

/** n 画素だけ 255 にした（残り 0）サムネイル。 */
function mkThumbChanged(nPixels: number): Uint8Array {
  const t = new Uint8Array(THUMB_BYTES);
  for (let i = 0; i < nPixels; i++) {
    t[i * 3] = 255;
    t[i * 3 + 1] = 255;
    t[i * 3 + 2] = 255;
  }
  return t;
}

describe("detectStockAnchors", () => {
  it("大変動の秒を候補に拾う（過検出許容）", () => {
    // t: 0,1,2,3,4 は同一 → 5 で全変化 → 6 で戻る
    const thumbs = [mkThumb(0), mkThumb(0), mkThumb(0), mkThumb(0), mkThumb(0), mkThumb(255), mkThumb(0)];
    const anchors = detectStockAnchors(thumbs, { fps: 1 });
    expect(anchors).toContain(5);
    expect(anchors).toContain(6);
  });

  it("しきい値未満の微小変化は拾わない", () => {
    // 256画素中 1画素のみ変化 = 0.39% < 18%
    const thumbs = [mkThumb(0), mkThumbChanged(1), mkThumb(0)];
    expect(detectStockAnchors(thumbs, { fps: 1 })).toEqual([]);
  });

  it("しきい値超（例: 50%画素変化）は拾う", () => {
    const thumbs = [mkThumb(0), mkThumbChanged(128)]; // 128/256 = 50%
    expect(detectStockAnchors(thumbs, { fps: 1 })).toEqual([1]);
  });

  it("fps に応じて秒へ換算", () => {
    const thumbs = [mkThumb(0), mkThumb(255)];
    expect(detectStockAnchors(thumbs, { fps: 2 })).toEqual([0.5]);
  });

  it("空・単一入力は空配列", () => {
    expect(detectStockAnchors([], {})).toEqual([]);
    expect(detectStockAnchors([mkThumb(0)], {})).toEqual([]);
  });
});

describe("coalesceAnchors", () => {
  it("minGap 以内の連続候補は先頭のみ残す", () => {
    expect(coalesceAnchors([5, 6, 20, 21, 22, 40], 2)).toEqual([5, 20, 40]);
  });
  it("ソートしてから間引く", () => {
    expect(coalesceAnchors([40, 5, 21, 6, 20], 2)).toEqual([5, 20, 40]);
  });
});
