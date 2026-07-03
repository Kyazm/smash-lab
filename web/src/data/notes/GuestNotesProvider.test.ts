// ADR-0014 (G-3): ゲストサンドボックスのMock切替・非破壊性を検証する。
// Supabase呼び出しはvi.mockでスタブし、実ネットワークには繋がない。
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({
    from: (_table: string) => ({
      select: (_cols: string) => mockSelect(_table),
    }),
  }),
  NOTE_MEDIA_BUCKET: "note-media",
}));

import { GuestNotesProvider } from "./GuestNotesProvider";

const SNAPSHOT_NOTE = {
  id: "real-note-1",
  kind: "own_play" as const,
  character_id: null,
  move_id: null,
  player_name: null,
  title: "実データの立ち回りメモ",
  body_md: "本人の実データ",
  section: null,
  starred: false,
  pinned: false,
  tags: [],
  source: "manual" as const,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

beforeEach(() => {
  mockSelect.mockReset();
  mockSelect.mockImplementation((table: string) => {
    if (table === "notes") return Promise.resolve({ data: [SNAPSHOT_NOTE], error: null });
    return Promise.resolve({ data: [], error: null });
  });
});

describe("GuestNotesProvider", () => {
  it("初回は Supabase スナップショットでシードされる", async () => {
    const provider = new GuestNotesProvider();
    await provider.seedFromSupabaseIfEmpty();
    const notes = await provider.listNotes();
    expect(notes.map((n) => n.id)).toContain("real-note-1");
  });

  it("ローカルでの編集は実DBに送らず、ローカル永続層のみで完結する（非破壊性）", async () => {
    const provider = new GuestNotesProvider();
    await provider.seedFromSupabaseIfEmpty();

    const created = await provider.createNote({
      kind: "own_play",
      character_id: null,
      move_id: null,
      player_name: null,
      title: "ゲストが追加したメモ",
      body_md: "ローカルのみ",
      section: null,
      starred: false,
      pinned: false,
      tags: [],
    });

    // 実DBへのinsert/update呼び出しが発生していないこと（mockSelectはselectのみ、書込系メソッドは未定義=呼ばれたら例外）
    expect(created.title).toBe("ゲストが追加したメモ");

    // 同一インスタンス内で読み直しても残っている（永続層への書込を経由している）
    const notes = await provider.listNotes();
    expect(notes.some((n) => n.title === "ゲストが追加したメモ")).toBe(true);
  });

  it("2回目以降は既存ローカルデータを保持し、再シードしない", async () => {
    const provider = new GuestNotesProvider();
    await provider.seedFromSupabaseIfEmpty();
    await provider.updateNote("real-note-1", { title: "ゲストが編集済み" });

    // シードを再度呼んでも上書きされない（非破壊）
    await provider.seedFromSupabaseIfEmpty();
    const note = await provider.getNote("real-note-1");
    expect(note?.title).toBe("ゲストが編集済み");
  });

  it("reset() でローカル編集を消去し、実データのスナップショットに戻す", async () => {
    const provider = new GuestNotesProvider();
    await provider.seedFromSupabaseIfEmpty();
    await provider.updateNote("real-note-1", { title: "ゲストが編集済み" });

    await provider.reset();
    const note = await provider.getNote("real-note-1");
    expect(note?.title).toBe(SNAPSHOT_NOTE.title);
  });
});
