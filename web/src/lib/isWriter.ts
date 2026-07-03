// migration 0005 の public.is_writer() と同じ判定ロジックをクライアント側でも再現する純粋関数。
// SQL: coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
// 本人JWTには is_anonymous クレームが無くNULLになりうるため、
// `->>'is_anonymous' = 'false'`（NULL=false→NULL→拒否）ではなく coalesce(...,false)=false にする
// （docs/08 レビュー[Critical1]）。クライアント側でRPC呼び出しをスキップするか判定する箇所
// （mainCharacterContext.setMainCharacter）で同じ規則を使うため、ロジックの一致をテストで担保する。
export function isWriter(isAnonymousClaim: boolean | null | undefined): boolean {
  return (isAnonymousClaim ?? false) === false;
}
