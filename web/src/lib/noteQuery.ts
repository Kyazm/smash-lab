// notes の絞り込み・検索・ソート（純粋関数）。
// Mock/Supabase 双方のロジックを一本化し、テスト可能にする。
// 検索は docs/02: notes.title / body_md / tags を対象に部分一致（ILIKE 相当、大小無視）。
import type { Note, NoteQuery } from "../data/notes/types";

/** query の指定項目のみ AND で一致するか。未指定項目は無視。 */
export function matchesQuery(note: Note, query?: NoteQuery): boolean {
  if (!query) return true;
  if (query.kind !== undefined && note.kind !== query.kind) return false;
  if (query.character_id !== undefined && note.character_id !== query.character_id) return false;
  if (query.move_id !== undefined && note.move_id !== query.move_id) return false;
  if (query.starred !== undefined && note.starred !== query.starred) return false;
  if (query.pinned !== undefined && note.pinned !== query.pinned) return false;
  return true;
}

/** title / body_md / tags のいずれかに keyword（大小無視）が部分一致するか。 */
export function matchesKeyword(note: Note, keyword: string): boolean {
  const k = keyword.trim().toLowerCase();
  if (k === "") return false;
  if ((note.title ?? "").toLowerCase().includes(k)) return true;
  if ((note.body_md ?? "").toLowerCase().includes(k)) return true;
  if (note.tags.some((t) => t.toLowerCase().includes(k))) return true;
  return false;
}

/** updated_at 降順（新しい順）。同値は created_at 降順で安定化。 */
export function byUpdatedDesc<T extends Pick<Note, "updated_at" | "created_at">>(
  a: T,
  b: T,
): number {
  if (a.updated_at !== b.updated_at) return a.updated_at < b.updated_at ? 1 : -1;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return 0;
}

/** query で絞り込み → updated_at 降順ソート。 */
export function filterAndSort<T extends Note>(notes: T[], query?: NoteQuery): T[] {
  return notes.filter((n) => matchesQuery(n, query)).sort(byUpdatedDesc);
}

/** keyword 検索 → updated_at 降順。空 keyword は空配列。 */
export function searchAndSort<T extends Note>(notes: T[], keyword: string): T[] {
  if (keyword.trim() === "") return [];
  return notes.filter((n) => matchesKeyword(n, keyword)).sort(byUpdatedDesc);
}
