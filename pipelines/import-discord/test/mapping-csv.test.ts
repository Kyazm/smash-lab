import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMappingRows,
  serializeMappingCsv,
  parseMappingCsv,
  type ChannelInput,
} from "../src/lib/mapping-csv.js";
import type { CharacterLite, MoveLite } from "../src/lib/match-channel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const characters: CharacterLite[] = JSON.parse(
  readFileSync(join(REPO_ROOT, "data", "imported", "characters.json"), "utf8"),
);
const allMoves = JSON.parse(readFileSync(join(REPO_ROOT, "data", "imported", "moves.json"), "utf8"));
const zss = characters.find((c) => (c as { slug: string }).slug === "zero_suit_samus") as unknown as { id: string };
const zssMoves: MoveLite[] = allMoves
  .filter((m: { character_id: string }) => m.character_id === zss.id)
  .map((m: { slug: string; name_ja: string | null; category: string }) => ({
    slug: m.slug,
    name_ja: m.name_ja,
    category: m.category,
  }));

const inputs: ChannelInput[] = [
  { channel: "7_フォックス対策⭐", channel_id: "1001", category: "64キャラ対策", kind: "matchup" },
  { channel: "謎キャラ対策⭐", channel_id: "2002", category: "DXキャラ対策", kind: "matchup" },
  { channel: "横b", channel_id: "3001", category: "ゼロサム技", kind: "own_move" },
  { channel: "コンボ雑談", channel_id: "3004", category: "ゼロサム技", kind: "own_move" },
  { channel: "立ち回り", channel_id: "4001", category: "ゼロサムについて", kind: "own_play" },
];

describe("buildMappingRows", () => {
  const rows = buildMappingRows(inputs, characters, zssMoves);

  it("matchup 解決成功で character_slug と starred が入る", () => {
    const fox = rows.find((r) => r.channel_id === "1001")!;
    expect(fox.character_slug).toBe("fox");
    expect(fox.starred).toBe("true");
    expect(fox.note).toBe("");
  });

  it("matchup 解決失敗は note に理由、character_slug 空", () => {
    const nazo = rows.find((r) => r.channel_id === "2002")!;
    expect(nazo.character_slug).toBe("");
    expect(nazo.note).toContain("キャラ未解決");
  });

  it("own_move 解決成功で move_slug が入る", () => {
    const sideb = rows.find((r) => r.channel_id === "3001")!;
    expect(sideb.move_slug).toBe("side-b-plasma-whip");
  });

  it("own_move 解決失敗は note に理由", () => {
    const combo = rows.find((r) => r.channel_id === "3004")!;
    expect(combo.move_slug).toBe("");
    expect(combo.note).toContain("技未解決");
  });

  it("own_play はキャラ/技を持たない", () => {
    const tach = rows.find((r) => r.channel_id === "4001")!;
    expect(tach.character_slug).toBe("");
    expect(tach.move_slug).toBe("");
  });
});

describe("CSV round-trip", () => {
  it("serialize → parse で内容が保存される（カンマ・日本語含む）", () => {
    const rows = buildMappingRows(inputs, characters, zssMoves);
    const csv = serializeMappingCsv(rows);
    const parsed = parseMappingCsv(csv);
    expect(parsed).toHaveLength(rows.length);
    for (let i = 0; i < rows.length; i++) {
      expect(parsed[i]).toEqual(rows[i]);
    }
  });

  it("クォート/エスケープを含む値も往復できる", () => {
    const rows = buildMappingRows(inputs, characters, zssMoves);
    rows[0].note = 'カンマ, と "引用符" と\n改行';
    const parsed = parseMappingCsv(serializeMappingCsv(rows));
    expect(parsed[0].note).toBe('カンマ, と "引用符" と\n改行');
  });

  it("人間が character_slug を手で埋めた CSV を読み戻せる", () => {
    const edited =
      "channel,channel_id,category,kind,character_slug,move_slug,starred,note\n" +
      "謎キャラ対策⭐,2002,DXキャラ対策,matchup,mewtwo,,true,手動解決\n";
    const parsed = parseMappingCsv(edited);
    expect(parsed[0].character_slug).toBe("mewtwo");
    expect(parsed[0].starred).toBe("true");
  });
});
