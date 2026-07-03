// メモ供給プロバイダの選択（ADR-0008）。
//   VITE_NOTES_PROVIDER=supabase → SupabaseNotesProvider
//   VITE_NOTES_PROVIDER=mock     → MockNotesProvider
//   未指定時: VITE_DATA_PROVIDER=supabase なら supabase、それ以外は mock
// 既定は mock（localStorage 永続）。実 DB 検証時のみ supabase に切替える。
//
// ADR-0014（G-3 ゲストサンドボックス）: ゲストセッションでは実体を GuestNotesProvider
// （localStorage、Supabaseスナップショットでシード）に差し替える。呼び出し側は全て
// `notesProvider.method()` の形で参照しているため、Proxy で委譲先を実行時に切替可能にし、
// 呼び出し側コードの変更を不要にする（setActiveNotesProvider を認証ゲートから呼ぶ）。
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

/** 起動時に決定する既定プロバイダ（本人ログイン/mock時用）。ゲストからの復帰時にこれへ戻す。 */
export const defaultNotesProvider: NotesProvider = createNotesProvider();

let activeProvider: NotesProvider = defaultNotesProvider;

/** ゲストログイン確立時などに委譲先を差し替える（ADR-0014）。 */
export function setActiveNotesProvider(provider: NotesProvider): void {
  activeProvider = provider;
}

export function getActiveNotesProvider(): NotesProvider {
  return activeProvider;
}

/** 呼び出し側は今まで通り `notesProvider.listNotes(...)` のように使える（Proxyで実体委譲）。 */
export const notesProvider: NotesProvider = new Proxy({} as NotesProvider, {
  get(_target, prop: keyof NotesProvider) {
    const value = activeProvider[prop];
    return typeof value === "function" ? value.bind(activeProvider) : value;
  },
});

export type { NotesProvider } from "./NotesProvider";
