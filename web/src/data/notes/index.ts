// メモ供給プロバイダの選択（ADR-0008）。
//   VITE_NOTES_PROVIDER=supabase → SupabaseNotesProvider
//   VITE_NOTES_PROVIDER=mock     → MockNotesProvider
//   未指定時: VITE_DATA_PROVIDER=supabase なら supabase、それ以外は mock
// 既定は mock（localStorage 永続）。実 DB 検証時のみ supabase に切替える。
import type { NotesProvider } from "./NotesProvider";
import { MockNotesProvider } from "./MockNotesProvider";
import { SupabaseNotesProvider } from "./SupabaseNotesProvider";

function createNotesProvider(): NotesProvider {
  const kind = import.meta.env.VITE_NOTES_PROVIDER;
  if (kind === "supabase") return new SupabaseNotesProvider();
  if (kind === "mock") return new MockNotesProvider();
  if (import.meta.env.VITE_DATA_PROVIDER === "supabase") return new SupabaseNotesProvider();
  return new MockNotesProvider();
}

export const notesProvider: NotesProvider = createNotesProvider();

export type { NotesProvider } from "./NotesProvider";
