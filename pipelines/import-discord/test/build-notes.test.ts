import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNotes, type CharacterRef, type MoveRef } from "../src/lib/build-notes.js";
import { emitSql } from "../src/lib/emit-sql.js";
import type { DiscordMessage, MappingRow } from "../src/lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

const characters: CharacterRef[] = JSON.parse(
  readFileSync(join(REPO_ROOT, "data", "imported", "characters.json"), "utf8"),
);
const allMoves = JSON.parse(readFileSync(join(REPO_ROOT, "data", "imported", "moves.json"), "utf8"));
const zss = characters.find((c) => c.slug === "zero_suit_samus")!;
const zssMoves: MoveRef[] = allMoves.filter(
  (m: { character_id: string }) => m.character_id === zss.id,
);

const foxMessages: DiscordMessage[] = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "messages-fox.json"), "utf8"),
);
const sidebMessages: DiscordMessage[] = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "messages-sideb.json"), "utf8"),
);

const mapping: MappingRow[] = [
  {
    channel: "7_フォックス対策⭐",
    channel_id: "1001",
    category: "64キャラ対策",
    kind: "matchup",
    character_slug: "fox",
    move_slug: "",
    starred: "true",
    note: "",
  },
  {
    channel: "横b",
    channel_id: "3001",
    category: "ゼロサム技",
    kind: "own_move",
    character_slug: "",
    move_slug: "side-b-plasma-whip",
    starred: "false",
    note: "",
  },
  {
    channel: "コンボ雑談",
    channel_id: "3004",
    category: "ゼロサム技",
    kind: "own_move",
    character_slug: "",
    move_slug: "",
    starred: "false",
    note: "技未解決",
  },
];

const messagesByChannel = new Map<string, DiscordMessage[]>([
  ["1001", foxMessages],
  ["3001", sidebMessages],
  ["3004", []],
]);

describe("buildNotes", () => {
  const { notes, warnings } = buildNotes({ mapping, messagesByChannel, characters, zssMoves });

  it("投稿ありチャンネルのみノート化（空チャンネルはスキップ）", () => {
    expect(notes).toHaveLength(2);
    expect(warnings.some((w) => w.includes("コンボ雑談"))).toBe(true);
  });

  it("matchup ノート: character_id=Fox, move_id=null, kind=matchup, starred", () => {
    const fox = notes.find((n) => n._channel_id === "1001")!;
    expect(fox.kind).toBe("matchup");
    expect(fox.character_id).toBe(characters.find((c) => c.slug === "fox")!.id);
    expect(fox.move_id).toBeNull();
    expect(fox.starred).toBe(true);
    expect(fox.title).toBe("フォックス対策");
    expect(fox.source).toBe("discord_import");
  });

  it("matchup ノートに画像/動画メディアが両方付く", () => {
    const fox = notes.find((n) => n._channel_id === "1001")!;
    const types = fox.media.map((m) => m.type).sort();
    expect(types).toEqual(["image", "local_video"]);
    const img = fox.media.find((m) => m.type === "image")!;
    expect(img.storage_path).toContain("att777");
    expect(img.url).toBeNull();
    const vid = fox.media.find((m) => m.type === "local_video")!;
    expect(vid.url).toContain("att888");
    expect(vid.storage_path).toBeNull();
  });

  it("own_move ノート: move_id=ZSS横B, character_id=null, kind=own_move", () => {
    const sideb = notes.find((n) => n._channel_id === "3001")!;
    expect(sideb.kind).toBe("own_move");
    expect(sideb.character_id).toBeNull();
    expect(sideb.move_id).toBe(zssMoves.find((m) => m.slug === "side-b-plasma-whip")!.id);
  });

  it("決定的ID: 同一入力で同じ note id", () => {
    const again = buildNotes({ mapping, messagesByChannel, characters, zssMoves });
    expect(again.notes.map((n) => n.id)).toEqual(notes.map((n) => n.id));
  });
});

describe("emitSql", () => {
  const { notes } = buildNotes({ mapping, messagesByChannel, characters, zssMoves });
  const sql = emitSql(notes);

  it("notes / note_media への INSERT を含み、source=discord_import", () => {
    expect(sql).toContain("insert into notes");
    expect(sql).toContain("insert into note_media");
    expect(sql).toContain("'discord_import'");
  });

  it("トランザクションで囲まれ ON CONFLICT DO NOTHING で冪等", () => {
    expect(sql.trim().startsWith("--") || sql.includes("begin;")).toBe(true);
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
    expect(sql).toContain("on conflict (id) do nothing");
  });

  it("シングルクォートをエスケープする", () => {
    const withQuote = notes.map((n) => ({ ...n, body_md: "it's a test" }));
    expect(emitSql(withQuote)).toContain("it''s a test");
  });

  it("ADR-0004 の位置づけコメントを含む（intel 自動書込禁止とは別枠）", () => {
    expect(sql).toContain("ADR-0004");
  });
});
