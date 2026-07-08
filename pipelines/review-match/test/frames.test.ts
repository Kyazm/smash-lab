import { describe, expect, it } from "vitest";
import { dedupFrames, pixelChangeRatio, thinUniform } from "../src/lib/frames.js";

/** 全画素を value で塗った 16x16 RGB サムネイル。 */
function solid(value: number): Uint8Array {
  return new Uint8Array(768).fill(value);
}

/** 先頭 k 画素だけ 255、残り 0 のサムネイル。 */
function firstKPixels(k: number): Uint8Array {
  const a = new Uint8Array(768); // 全 0
  for (let i = 0; i < k; i++) {
    a[i * 3] = 255;
    a[i * 3 + 1] = 255;
    a[i * 3 + 2] = 255;
  }
  return a;
}

describe("pixelChangeRatio", () => {
  it("同一サムネイルは 0", () => {
    expect(pixelChangeRatio(solid(0), solid(0))).toBe(0);
  });
  it("全画素変化は 1.0", () => {
    expect(pixelChangeRatio(solid(0), solid(255))).toBe(1);
  });
  it("変化画素数 / 総画素数（256画素中 k）", () => {
    expect(pixelChangeRatio(solid(0), firstKPixels(64))).toBeCloseTo(64 / 256);
  });
  it("tol 以下の差は変化に数えない", () => {
    // 差 20 < tol 25 → 変化なし
    expect(pixelChangeRatio(solid(0), solid(20))).toBe(0);
  });
});

describe("dedupFrames", () => {
  it("先頭は常に採用、直後の同一フレームは落とす", () => {
    const thumbs = [solid(0), solid(0), solid(255)];
    const meta = thumbs.map(() => ({ tSec: 0 }));
    expect(dedupFrames(thumbs, meta)).toEqual([0, 2]);
  });

  it("変化率が ratio(0.08) 以下なら落とす", () => {
    // 256画素中20画素変化 = 0.078 < 0.08 → 落とす
    const thumbs = [solid(0), firstKPixels(20)];
    const meta = thumbs.map(() => ({ tSec: 0 }));
    expect(dedupFrames(thumbs, meta)).toEqual([0]);
  });

  it("変化率が ratio 超なら採用する", () => {
    // 256画素中24画素変化 = 0.09375 > 0.08 → 採用
    const thumbs = [solid(0), firstKPixels(24)];
    const meta = thumbs.map(() => ({ tSec: 0 }));
    expect(dedupFrames(thumbs, meta)).toEqual([0, 1]);
  });

  it("sliding window で A-B-A の再出現を弾く", () => {
    // A(0) 採用 → B(255) 採用 → A(0) は直近window内のAと一致で落とす
    const thumbs = [solid(0), solid(255), solid(0)];
    const meta = thumbs.map(() => ({ tSec: 0 }));
    expect(dedupFrames(thumbs, meta)).toEqual([0, 1]);
  });

  it("thumbs と meta の長さ不一致は例外", () => {
    expect(() => dedupFrames([solid(0)], [])).toThrow();
  });
});

describe("thinUniform", () => {
  it("max 以下はそのまま", () => {
    expect(thinUniform([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });
  it("均等間引き（10→4 は index 0,2,5,7）", () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(thinUniform(items, 4)).toEqual([0, 2, 5, 7]);
  });
  it("間引き後は max 枚", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    expect(thinUniform(items, 24).length).toBe(24);
  });
  it("順序を保つ", () => {
    const items = [10, 20, 30, 40, 50, 60];
    const out = thinUniform(items, 3);
    expect(out).toEqual([...out].sort((a, b) => a - b));
  });
});
