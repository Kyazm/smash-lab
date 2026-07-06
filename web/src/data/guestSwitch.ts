// ゲスト⇔本人のプロバイダ切替を一元化する（ADR-0018。従来AuthGateに分散していた配線の集約）。
// 重要な制約: applyProvidersForSession は「同期」であること。AuthGate は session 確定コールバック内で
// setSession の前にこれを呼ぶ（子ページのマウント=初回fetchより前にプロバイダを確定させる。
// useEffect に置くと子effectが先に走る競合がある——過去に修正済みのバグを再導入しない）。
import { setActiveNotesProvider, defaultNotesProvider } from "./notes";
import { GuestNotesProvider } from "./notes/GuestNotesProvider";
import { setActiveMatchProvider, defaultMatchProvider, GUEST_MATCH_KEY } from "./match";
import { LocalMatchProvider } from "./match/LocalMatchProvider";
import { setActiveFocusProvider, defaultFocusProvider, GUEST_FOCUS_KEY } from "./focus";
import { LocalFocusProvider } from "./focus/LocalFocusProvider";
import { setActiveSessionProvider, defaultSessionProvider, GUEST_SESSION_KEY } from "./session";
import { LocalSessionProvider } from "./session/LocalSessionProvider";

// ゲストのNotesProviderはインスタンスを保持（再ゲスト化でもローカルサンドボックスを維持）。
let guestNotes: GuestNotesProvider | null = null;

/** session に応じて全ドメインのプロバイダを同期的に確定する。シード（notes）のみ非同期fire-and-forget。 */
export function applyProvidersForSession(isGuest: boolean): void {
  if (isGuest) {
    if (!guestNotes) guestNotes = new GuestNotesProvider();
    setActiveNotesProvider(guestNotes);
    void guestNotes.seedFromSupabaseIfEmpty(); // exists()で冪等（多重発火でも二重シードしない）
    setActiveMatchProvider(new LocalMatchProvider(GUEST_MATCH_KEY));
    setActiveFocusProvider(new LocalFocusProvider(GUEST_FOCUS_KEY));
    setActiveSessionProvider(new LocalSessionProvider(GUEST_SESSION_KEY));
  } else {
    setActiveNotesProvider(defaultNotesProvider);
    setActiveMatchProvider(defaultMatchProvider);
    setActiveFocusProvider(defaultFocusProvider);
    setActiveSessionProvider(defaultSessionProvider);
  }
}

/** ゲストのローカルサンドボックスを全消去する（GuestBannerのリセット用。4系統すべて）。 */
export async function clearGuestLocal(): Promise<void> {
  const notes = guestNotes ?? new GuestNotesProvider();
  await notes.reset();
  guestNotes = notes;
  setActiveNotesProvider(notes);
  new LocalMatchProvider(GUEST_MATCH_KEY).clear();
  new LocalFocusProvider(GUEST_FOCUS_KEY).clear();
  new LocalSessionProvider(GUEST_SESSION_KEY).clear();
}
