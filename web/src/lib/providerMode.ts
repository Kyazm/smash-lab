// メモ供給プロバイダ種別の解決（純粋関数）。ADR-0008 の切替規則を一箇所に集約。
//   VITE_NOTES_PROVIDER=supabase → supabase
//   VITE_NOTES_PROVIDER=mock     → mock
//   未指定/不明値: VITE_DATA_PROVIDER=supabase なら supabase、それ以外 mock
// AuthGate（supabase時のみ認証必須）と data/notes/index.ts の両方がこの関数を使う。

export type NotesProviderKind = "mock" | "supabase";

export function resolveNotesProviderKind(
  notesProviderEnv: string | undefined,
  dataProviderEnv: string | undefined,
): NotesProviderKind {
  if (notesProviderEnv === "supabase") return "supabase";
  if (notesProviderEnv === "mock") return "mock";
  if (dataProviderEnv === "supabase") return "supabase";
  return "mock";
}
