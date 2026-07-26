// スキャングリッドのセル⇔t_sec 対応（純関数）。dedup 後の採用フレーム（時刻昇順の t_sec 列）を
// rows×cols グリッドへ row-major（左上→右、次段）に詰め、各セルの (row,col,t_sec) を返す。
// 末尾グリッドは端数（cols*rows 未満）を許容し、実フレーム分のセルだけを持つ。

export interface GridCell {
  row: number;
  col: number;
  t_sec: number;
}

export interface GridAssignment {
  grid_index: number; // 0 始まり
  cells: GridCell[];
}

/**
 * t_sec 列を rows×cols グリッド群へ割り当てる（純関数）。ffmpeg tile と同じ row-major 順。
 * path はここでは付けない（IO 側で grid_NN.jpg を割当）。
 */
export function assignGridCells(tSecs: number[], rows: number, cols: number): GridAssignment[] {
  if (rows <= 0 || cols <= 0) throw new Error("assignGridCells: rows/cols は正である必要があります");
  const perGrid = rows * cols;
  const grids: GridAssignment[] = [];
  for (let g = 0; g * perGrid < tSecs.length; g++) {
    const cells: GridCell[] = [];
    for (let k = 0; k < perGrid; k++) {
      const idx = g * perGrid + k;
      if (idx >= tSecs.length) break;
      cells.push({ row: Math.floor(k / cols), col: k % cols, t_sec: tSecs[idx] });
    }
    grids.push({ grid_index: g, cells });
  }
  return grids;
}

/** グリッド枚数（端数含む）。 */
export function gridCount(frameCount: number, rows: number, cols: number): number {
  const perGrid = rows * cols;
  return Math.ceil(frameCount / perGrid);
}
