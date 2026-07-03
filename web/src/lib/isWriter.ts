// migration 0005 の public.is_writer() と同じ規則をクライアント側でも再現する純粋関数。
// DB側の定義（disable_signup制約対応で匿名認証→専用ゲストアカウント方式に変更後）:
//   SQL: auth.uid() = OWNER_UID
// すなわち「オーナー本人のみ書込可」。ゲスト（専用アカウント、別uid）は書込不可。
// クライアント側でRPC呼び出しをスキップするか判定する箇所（mainCharacterContext）で
// 同じ規則（= ゲストでない認証ユーザー）を使うため、ロジックの一致をテストで担保する。
import { GUEST_UID } from "../data/guestConfig";

/** userId がオーナー本人（=ゲストでない認証ユーザー）なら書込可。 */
export function isWriter(userId: string | null | undefined): boolean {
  return userId != null && userId !== GUEST_UID;
}
