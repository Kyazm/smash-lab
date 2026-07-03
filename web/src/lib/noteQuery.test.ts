import { describe, it, expect } from "vitest";
import {
  matchesQuery,
  matchesKeyword,
  byUpdatedDesc,
  filterAndSort,
  searchAndSort,
} from "./noteQuery";
import type { Note } from "../data/notes/types";

function note(partial: Partial<Note> & Pick<Note, "id">): Note {
  return {
    id: partial.id,
    kind: partial.kind ?? "matchup",
    character_id: partial.character_id ?? null,
    move_id: partial.move_id ?? null,
    player_name: partial.player_name ?? null,
    title: partial.title ?? null,
    body_md: partial.body_md ?? null,
    section: partial.section ?? null,
    starred: partial.starred ?? false,
    pinned: partial.pinned ?? false,
    tags: partial.tags ?? [],
    source: partial.source ?? "manual",
    created_at: partial.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: partial.updated_at ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("matchesQuery", () => {
  it("query 未指定は常に true", () => {
    expect(matchesQuery(note({ id: "a" }))).toBe(true);
  });

  it("kind 一致で絞り込む", () => {
    const n = note({ id: "a", kind: "own_move" });
    expect(matchesQuery(n, { kind: "own_move" })).toBe(true);
    expect(matchesQuery(n, { kind: "matchup" })).toBe(false);
  });

  it("character_id を null で絞れる（own系の抽出）", () => {
    const own = note({ id: "a", character_id: null });
    const mu = note({ id: "b", character_id: "char-1" });
    expect(matchesQuery(own, { character_id: null })).toBe(true);
    expect(matchesQuery(mu, { character_id: null })).toBe(false);
    expect(matchesQuery(mu, { character_id: "char-1" })).toBe(true);
  });

  it("複数条件は AND", () => {
    const n = note({ id: "a", kind: "matchup", character_id: "c1", starred: true });
    expect(matchesQuery(n, { kind: "matchup", starred: true })).toBe(true);
    expect(matchesQuery(n, { kind: "matchup", starred: false })).toBe(false);
  });

  it("pinned で TL;DR を抽出できる", () => {
    const pinned = note({ id: "a", pinned: true });
    expect(matchesQuery(pinned, { pinned: true })).toBe(true);
    expect(matchesQuery(note({ id: "b" }), { pinned: true })).toBe(false);
  });

  // ADR-0013 (G-2): デプロイ移行用の character_id_in（NULL + mainId 両対応クエリ）。
  describe("character_id_in（ADR-0013デプロイ移行の両対応クエリ）", () => {
    it("null と mainId のどちらも拾う", () => {
      const unbackfilled = note({ id: "a", character_id: null });
      const main = note({ id: "b", character_id: "main-1" });
      const other = note({ id: "c", character_id: "other-2" });
      const query = { character_id_in: [null, "main-1"] };
      expect(matchesQuery(unbackfilled, query)).toBe(true);
      expect(matchesQuery(main, query)).toBe(true);
      expect(matchesQuery(other, query)).toBe(false);
    });

    it("character_id_in が指定されると character_id 単体条件より優先される", () => {
      const n = note({ id: "a", character_id: null });
      expect(matchesQuery(n, { character_id: "main-1", character_id_in: [null] })).toBe(true);
    });
  });
});

describe("matchesKeyword", () => {
  it("title に部分一致（大小無視）", () => {
    const n = note({ id: "a", title: "フォックス対策メモ" });
    expect(matchesKeyword(n, "フォックス")).toBe(true);
    expect(matchesKeyword(n, "対策")).toBe(true);
  });

  it("body_md に部分一致", () => {
    const n = note({ id: "a", body_md: "崖上がりは暴れ読みで置く" });
    expect(matchesKeyword(n, "崖上がり")).toBe(true);
  });

  it("tags に一致（大小無視）", () => {
    const n = note({ id: "a", tags: ["Edgeguard", "ニュートラル"] });
    expect(matchesKeyword(n, "edgeguard")).toBe(true);
    expect(matchesKeyword(n, "ニュートラル")).toBe(true);
  });

  it("空 keyword は false", () => {
    expect(matchesKeyword(note({ id: "a", title: "x" }), "")).toBe(false);
    expect(matchesKeyword(note({ id: "a", title: "x" }), "   ")).toBe(false);
  });

  it("どこにも無ければ false", () => {
    const n = note({ id: "a", title: "abc", body_md: "def", tags: ["ghi"] });
    expect(matchesKeyword(n, "zzz")).toBe(false);
  });
});

describe("byUpdatedDesc", () => {
  it("updated_at 降順（新しい順）", () => {
    const older = note({ id: "a", updated_at: "2026-01-01T00:00:00.000Z" });
    const newer = note({ id: "b", updated_at: "2026-02-01T00:00:00.000Z" });
    expect(byUpdatedDesc(older, newer)).toBeGreaterThan(0);
    expect(byUpdatedDesc(newer, older)).toBeLessThan(0);
  });

  it("updated_at 同値は created_at 降順で安定化", () => {
    const a = note({
      id: "a",
      updated_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const b = note({
      id: "b",
      updated_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-02T00:00:00.000Z",
    });
    expect(byUpdatedDesc(a, b)).toBeGreaterThan(0);
  });
});

describe("filterAndSort", () => {
  it("絞り込みと降順ソートを同時に行う", () => {
    const notes = [
      note({ id: "a", kind: "matchup", updated_at: "2026-01-01T00:00:00.000Z" }),
      note({ id: "b", kind: "matchup", updated_at: "2026-03-01T00:00:00.000Z" }),
      note({ id: "c", kind: "own_play", updated_at: "2026-02-01T00:00:00.000Z" }),
    ];
    const r = filterAndSort(notes, { kind: "matchup" });
    expect(r.map((n) => n.id)).toEqual(["b", "a"]);
  });
});

describe("searchAndSort", () => {
  it("keyword 検索して降順ソート", () => {
    const notes = [
      note({ id: "a", title: "フォックス 崖", updated_at: "2026-01-01T00:00:00.000Z" }),
      note({ id: "b", title: "フォックス 復帰", updated_at: "2026-02-01T00:00:00.000Z" }),
      note({ id: "c", title: "マリオ", updated_at: "2026-03-01T00:00:00.000Z" }),
    ];
    const r = searchAndSort(notes, "フォックス");
    expect(r.map((n) => n.id)).toEqual(["b", "a"]);
  });

  it("空 keyword は空配列", () => {
    expect(searchAndSort([note({ id: "a", title: "x" })], "  ")).toEqual([]);
  });
});
