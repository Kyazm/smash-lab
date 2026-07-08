import { describe, expect, it } from "vitest";
import { parseAndValidateResult, validateResult, type ResultJson } from "../src/lib/schema.js";

function validResult(): ResultJson {
  return {
    scenes: [
      {
        t_sec: 93,
        scene_summary: "崖際の攻防で撃墜された場面",
        findings: [
          {
            t_sec: 91.5,
            situation: "disadvantage",
            observation: "復帰ルートが一直線だった",
            suggestion: "低空からの復帰も混ぜる",
            habit_tag: "recovery",
            mistake_type: "decision",
            confidence: 0.8,
            death: { stock: 1, kill_move: "上スマ", initiating_action: "崖端2F上がり" },
          },
        ],
      },
    ],
    summary_md: "## まとめ\n復帰の択が読まれている",
    one_mistake: "復帰ルートを散らす",
    focus_evaluations: [
      { focus_point_id: "11111111-1111-1111-1111-111111111111", verdict: "not_achieved", evidence: "同ルート3回" },
    ],
  };
}

describe("validateResult 正常系", () => {
  it("完全な結果を通す", () => {
    const r = validateResult(validResult());
    expect(r.ok).toBe(true);
  });
  it("death 省略・habit_tag null も通す", () => {
    const v = validResult();
    delete v.scenes[0].findings[0].death;
    v.scenes[0].findings[0].habit_tag = null;
    expect(validateResult(v).ok).toBe(true);
  });
  it("findings / focus_evaluations 空配列も通す", () => {
    const v = validResult();
    v.scenes[0].findings = [];
    v.focus_evaluations = [];
    expect(validateResult(v).ok).toBe(true);
  });
});

describe("validateResult 異常系（systematic）", () => {
  it("トップレベルが object でない", () => {
    const r = validateResult([]);
    expect(r.ok).toBe(false);
  });
  it("scenes が配列でない", () => {
    const v = validResult() as unknown as Record<string, unknown>;
    v.scenes = "nope";
    expect(validateResult(v).ok).toBe(false);
  });
  it("situation が語彙外", () => {
    const v = validResult();
    (v.scenes[0].findings[0] as unknown as Record<string, unknown>).situation = "kill";
    const r = validateResult(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("situation"))).toBe(true);
  });
  it("mistake_type が語彙外", () => {
    const v = validResult();
    (v.scenes[0].findings[0] as unknown as Record<string, unknown>).mistake_type = "mental";
    expect(validateResult(v).ok).toBe(false);
  });
  it("confidence が範囲外", () => {
    const v = validResult();
    v.scenes[0].findings[0].confidence = 1.5;
    const r = validateResult(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("confidence"))).toBe(true);
  });
  it("observation 欠落", () => {
    const v = validResult();
    delete (v.scenes[0].findings[0] as unknown as Record<string, unknown>).observation;
    expect(validateResult(v).ok).toBe(false);
  });
  it("habit_tag が数値", () => {
    const v = validResult();
    (v.scenes[0].findings[0] as unknown as Record<string, unknown>).habit_tag = 5;
    expect(validateResult(v).ok).toBe(false);
  });
  it("death.stock 欠落", () => {
    const v = validResult();
    delete (v.scenes[0].findings[0].death as unknown as Record<string, unknown>).stock;
    expect(validateResult(v).ok).toBe(false);
  });
  it("summary_md / one_mistake 欠落", () => {
    const v = validResult() as unknown as Record<string, unknown>;
    delete v.summary_md;
    delete v.one_mistake;
    const r = validateResult(v);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.includes("summary_md"))).toBe(true);
      expect(r.errors.some((e) => e.includes("one_mistake"))).toBe(true);
    }
  });
  it("focus_evaluations の verdict が語彙外", () => {
    const v = validResult();
    (v.focus_evaluations[0] as unknown as Record<string, unknown>).verdict = "maybe";
    expect(validateResult(v).ok).toBe(false);
  });
  it("focus_point_id 空文字", () => {
    const v = validResult();
    v.focus_evaluations[0].focus_point_id = "";
    expect(validateResult(v).ok).toBe(false);
  });
});

describe("parseAndValidateResult", () => {
  it("不正 JSON はエラー", () => {
    const r = parseAndValidateResult("{ not json");
    expect(r.ok).toBe(false);
  });
  it("正しい JSON 文字列を通す", () => {
    const r = parseAndValidateResult(JSON.stringify(validResult()));
    expect(r.ok).toBe(true);
  });
});
