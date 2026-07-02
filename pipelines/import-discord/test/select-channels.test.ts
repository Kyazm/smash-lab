import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyCategory } from "../src/config.js";
import { selectTargetChannels } from "../src/lib/select-channels.js";
import type { DiscordChannel } from "../src/lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const channels: DiscordChannel[] = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "guild-channels.json"), "utf8"),
);

describe("classifyCategory", () => {
  it("末尾『キャラ対策』は matchup", () => {
    expect(classifyCategory("64キャラ対策")).toBe("matchup");
    expect(classifyCategory("DXキャラ対策")).toBe("matchup");
  });
  it("ゼロサム技は own_move", () => {
    expect(classifyCategory("ゼロサム技")).toBe("own_move");
  });
  it("ゼロサムについて / スマブラ基本 は own_play", () => {
    expect(classifyCategory("ゼロサムについて")).toBe("own_play");
    expect(classifyCategory("スマブラ基本")).toBe("own_play");
  });
  it("対象外カテゴリは null", () => {
    expect(classifyCategory("雑談")).toBeNull();
    expect(classifyCategory("キャラ対策について")).toBeNull(); // 末尾一致しない
  });
});

describe("selectTargetChannels", () => {
  const selected = selectTargetChannels(channels);

  it("対象カテゴリ配下のテキストチャンネルのみ選ぶ", () => {
    const names = selected.map((s) => s.channel.name);
    expect(names).toContain("7_フォックス対策⭐");
    expect(names).toContain("横b");
    expect(names).toContain("立ち回り");
    expect(names).toContain("ガード関連");
  });

  it("対象外カテゴリ（雑談）配下は除外", () => {
    const names = selected.map((s) => s.channel.name);
    expect(names).not.toContain("general");
  });

  it("カテゴリ自身（type=4）は含めない", () => {
    expect(selected.every((s) => s.channel.type === 0 || s.channel.type === 5)).toBe(true);
  });

  it("kind がカテゴリから正しく伝播する", () => {
    const sideb = selected.find((s) => s.channel.name === "横b");
    expect(sideb?.categoryKind).toBe("own_move");
    const fox = selected.find((s) => s.channel.name === "7_フォックス対策⭐");
    expect(fox?.categoryKind).toBe("matchup");
  });
});
