import { describe, expect, it } from "vitest";
import {
  parseAndValidateLabels,
  validateLabels,
  type LabelsJson,
} from "../src/lib/labels-schema.js";

function validLabels(): LabelsJson {
  return {
    video_id: "e76F_fDNjf8",
    games: [
      { game_index: 1, opp_char: "Shulk", side: "p1" },
      { game_index: 2, opp_char: "Snake", side: "p1" },
    ],
    interactions: [
      {
        t_sec: 123.4,
        game_index: 1,
        situation: "ledge_offense",
        sub_situation: "崖端2F上がり",
        action: "zair",
        action_detail: "空下zair",
        outcome: "won",
        kill: false,
        confidence: 0.8,
        frame: "bursts/t123/frame_015.jpg",
        note: "置きzairが刺さった",
      },
      {
        t_sec: 240,
        game_index: 2,
        situation: "kill_confirm",
        action: "boost_kick",
        outcome: "won",
        kill: true,
        confidence: 0.9,
        frame: "bursts/t240/frame_020.jpg",
      },
    ],
  };
}

describe("validateLabels 正常系", () => {
  it("完全な labels を通す", () => {
    expect(validateLabels(validLabels()).ok).toBe(true);
  });
  it("任意フィールド省略（sub_situation/kill/note/opp_char）も通す", () => {
    const v = validLabels();
    delete v.interactions[0].sub_situation;
    delete v.interactions[0].kill;
    delete v.interactions[0].note;
    delete v.interactions[0].action_detail;
    expect(validateLabels(v).ok).toBe(true);
  });
  it("interactions 空配列も通す", () => {
    const v = validLabels();
    v.interactions = [];
    expect(validateLabels(v).ok).toBe(true);
  });
  it("action=unknown / opp_char 上書きを通す", () => {
    const v = validLabels();
    v.interactions[0].action = "unknown";
    v.interactions[0].opp_char = "Mr. Game and Watch";
    expect(validateLabels(v).ok).toBe(true);
  });
});

describe("validateLabels 異常系（systematic）", () => {
  it("トップレベルが object でない", () => {
    expect(validateLabels([]).ok).toBe(false);
  });
  it("games が配列でない", () => {
    const v = validLabels() as unknown as Record<string, unknown>;
    v.games = "nope";
    expect(validateLabels(v).ok).toBe(false);
  });
  it("game_index 重複", () => {
    const v = validLabels();
    v.games[1].game_index = 1;
    const r = validateLabels(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("重複"))).toBe(true);
  });
  it("interaction.game_index が games に存在しない", () => {
    const v = validLabels();
    v.interactions[0].game_index = 99;
    const r = validateLabels(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("存在しない"))).toBe(true);
  });
  it("situation が語彙外", () => {
    const v = validLabels();
    (v.interactions[0] as unknown as Record<string, unknown>).situation = "ledge";
    expect(validateLabels(v).ok).toBe(false);
  });
  it("action が辞書外", () => {
    const v = validLabels();
    (v.interactions[0] as unknown as Record<string, unknown>).action = "nair";
    const r = validateLabels(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("action"))).toBe(true);
  });
  it("outcome が語彙外", () => {
    const v = validLabels();
    (v.interactions[0] as unknown as Record<string, unknown>).outcome = "draw";
    expect(validateLabels(v).ok).toBe(false);
  });
  it("confidence 範囲外", () => {
    const v = validLabels();
    v.interactions[0].confidence = 1.4;
    const r = validateLabels(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("confidence"))).toBe(true);
  });
  it("frame 欠落", () => {
    const v = validLabels();
    delete (v.interactions[0] as unknown as Record<string, unknown>).frame;
    const r = validateLabels(v);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes("frame"))).toBe(true);
  });
  it("side が語彙外", () => {
    const v = validLabels();
    (v.games[0] as unknown as Record<string, unknown>).side = "p3";
    expect(validateLabels(v).ok).toBe(false);
  });
  it("t_sec 負", () => {
    const v = validLabels();
    v.interactions[0].t_sec = -1;
    expect(validateLabels(v).ok).toBe(false);
  });
  it("opp_char 空文字（game）", () => {
    const v = validLabels();
    v.games[0].opp_char = "";
    expect(validateLabels(v).ok).toBe(false);
  });
});

describe("parseAndValidateLabels", () => {
  it("不正 JSON はエラー", () => {
    expect(parseAndValidateLabels("{ not json").ok).toBe(false);
  });
  it("正しい JSON 文字列を通す", () => {
    expect(parseAndValidateLabels(JSON.stringify(validLabels())).ok).toBe(true);
  });
});
