import { describe, expect, it } from "vitest";
import { computeCleanupPath } from "../src/lib/cleanup.js";

const ROOT = "/Users/x/Desktop/work/smash-lab/.context/player-study";

describe("computeCleanupPath 安全ガード", () => {
  it("正当な video_id は workRoot 配下のパスを返す", () => {
    const p = computeCleanupPath(ROOT, "e76F_fDNjf8");
    expect(p).toBe(`${ROOT}/e76F_fDNjf8`);
    expect(p.startsWith(`${ROOT}/`)).toBe(true);
    expect(p.endsWith("e76F_fDNjf8")).toBe(true);
  });

  it("末尾スラッシュ付き workRoot でも正しく解決", () => {
    const p = computeCleanupPath(`${ROOT}/`, "ZyOYAOsfD6U");
    expect(p).toBe(`${ROOT}/ZyOYAOsfD6U`);
  });

  it("空 video_id は例外", () => {
    expect(() => computeCleanupPath(ROOT, "")).toThrow();
  });

  it("パス区切りを含む video_id は例外", () => {
    expect(() => computeCleanupPath(ROOT, "a/b")).toThrow();
    expect(() => computeCleanupPath(ROOT, "e76F/fDNjf")).toThrow();
  });

  it("親参照（トラバーサル）は例外", () => {
    expect(() => computeCleanupPath(ROOT, "..")).toThrow();
    expect(() => computeCleanupPath(ROOT, "../../etc")).toThrow();
  });

  it("11桁でない ID は例外", () => {
    expect(() => computeCleanupPath(ROOT, "short")).toThrow();
    expect(() => computeCleanupPath(ROOT, "waytoolongvideoid")).toThrow();
  });
});
