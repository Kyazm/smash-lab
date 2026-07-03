// ゲスト（専用アカウント方式）の公開定数（ADR-0014 / disable_signup制約対応）。
// Supabaseの disable_signup=true が signInAnonymously() もブロックするため、匿名認証はやめ、
// 専用の共有ゲストアカウントでログインする方式に変更した。
// これらの値は anon(publishable) キーと同じく「公開前提」で、防御線は RLS（is_writer()=オーナーuidのみ）。
// ゲストのJWTは別uidなので、RLS上 notes 等への書込は拒否される（サンドボックスはローカル完結）。
export const GUEST_EMAIL = "guest@kyazm-smash-lab.local";
export const GUEST_PASSWORD = "9SeXOl-rk5DFtYEp99dgDQ";
export const GUEST_UID = "4847e7ae-b13b-4e5c-b7ff-b63125ec3bfe";
