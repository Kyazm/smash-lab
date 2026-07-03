// ゲスト（専用アカウント）判定のContext化（ADR-0014 / docs/08 G-3）。
// AuthGate配下で session.user.id === GUEST_UID を購読し、useIsGuest() で全コンポーネントから参照できるようにする。
// mockモード（AuthGate自体が素通し）では常に false を返す既定値を使う。
import { createContext, useContext } from "react";

const GuestContext = createContext<boolean>(false);

export const GuestProvider = GuestContext.Provider;

/** true ならゲスト（専用アカウント）セッション。NotesProvider の切替・自キャラ選択のローカル完結判定に使う。 */
export function useIsGuest(): boolean {
  return useContext(GuestContext);
}
