import { describe, expect, it } from "vitest";
import { assignGridCells, gridCount } from "../src/lib/grid.js";

describe("assignGridCells 3x3 row-major", () => {
  it("10フレーム → 2グリッド（9 + 1）、セル⇔t_sec が正しい", () => {
    const tSecs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const grids = assignGridCells(tSecs, 3, 3);
    expect(grids.length).toBe(2);

    // グリッド0: 9セル、row-major
    expect(grids[0].cells).toHaveLength(9);
    expect(grids[0].cells[0]).toEqual({ row: 0, col: 0, t_sec: 0 });
    expect(grids[0].cells[1]).toEqual({ row: 0, col: 1, t_sec: 1 });
    expect(grids[0].cells[2]).toEqual({ row: 0, col: 2, t_sec: 2 });
    expect(grids[0].cells[3]).toEqual({ row: 1, col: 0, t_sec: 3 });
    expect(grids[0].cells[8]).toEqual({ row: 2, col: 2, t_sec: 8 });

    // グリッド1: 端数1セル
    expect(grids[1].cells).toHaveLength(1);
    expect(grids[1].cells[0]).toEqual({ row: 0, col: 0, t_sec: 9 });
    expect(grids[1].grid_index).toBe(1);
  });

  it("ちょうど9フレームは1グリッド", () => {
    const grids = assignGridCells([0, 1, 2, 3, 4, 5, 6, 7, 8], 3, 3);
    expect(grids.length).toBe(1);
    expect(grids[0].cells).toHaveLength(9);
  });

  it("空配列は空", () => {
    expect(assignGridCells([], 3, 3)).toEqual([]);
  });

  it("rows/cols が 0 以下は例外", () => {
    expect(() => assignGridCells([1], 0, 3)).toThrow();
  });
});

describe("gridCount", () => {
  it("端数を切り上げ", () => {
    expect(gridCount(10, 3, 3)).toBe(2);
    expect(gridCount(9, 3, 3)).toBe(1);
    expect(gridCount(0, 3, 3)).toBe(0);
    expect(gridCount(19, 3, 3)).toBe(3);
  });
});
