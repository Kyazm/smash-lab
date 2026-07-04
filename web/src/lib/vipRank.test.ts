import { describe, expect, it } from "vitest";
import { rankFromGsp, VIP_RANKS } from "./vipRank";

const BORDER = 10_000_000;

describe("rankFromGsp", () => {
  it("ボーダーちょうどは VIP到達（指数1.0）", () => {
    const r = rankFromGsp(BORDER, BORDER);
    expect(r?.rank.name).toBe("VIP到達！");
    expect(r?.ratio).toBe(1);
    expect(r?.isVip).toBe(true);
  });

  it("ボーダーの1.105倍以上は最上位「桜井」", () => {
    expect(rankFromGsp(BORDER * 1.105, BORDER)?.rank.name).toBe("桜井");
    expect(rankFromGsp(BORDER * 1.2, BORDER)?.rank.name).toBe("桜井");
  });

  it("ボーダー未満はVIP未到達（isVip=false）", () => {
    const r = rankFromGsp(BORDER * 0.95, BORDER);
    expect(r?.rank.name).toBe("VIPまでラストスパート"); // 0.9<=0.95<1.0
    expect(r?.isVip).toBe(false);
  });

  it("極端に低い値でも最下位段位にフォールバック", () => {
    expect(rankFromGsp(1, BORDER)?.rank.name).toBe("未VIP発射台");
  });

  it("不正入力は null", () => {
    expect(rankFromGsp(0, BORDER)).toBeNull();
    expect(rankFromGsp(BORDER, 0)).toBeNull();
    expect(rankFromGsp(NaN, BORDER)).toBeNull();
    expect(rankFromGsp(-5, BORDER)).toBeNull();
  });

  it("段位テーブルは指数降順で並んでいる（探索の前提）", () => {
    for (let i = 1; i < VIP_RANKS.length; i++) {
      expect(VIP_RANKS[i - 1].index).toBeGreaterThanOrEqual(VIP_RANKS[i].index);
    }
  });
});
