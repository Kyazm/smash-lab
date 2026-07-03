# ADR-0014: ゲストサンドボックスログイン（専用アカウント方式）

Status: Accepted (2026-07-03、実装時に匿名→専用アカウント方式へ改訂)

## Context
アプリは単一ユーザーのメール認証（サインアップ無効、RLS=authenticated全権）。ユーザーはゲストログインを要望し、**ゲストも自由に編集できるサンドボックス**を希望。用途は「パスワードなしで触らせる/デモ/別端末で試す」。制約: ゲストの操作が本人の実データを破壊してはならない。

**実装時の重要な発見**: 当初は匿名認証（`signInAnonymously()`）を想定したが、Supabaseの `disable_signup=true`（本アプリ必須のサインアップ無効）が匿名sign-inも一律ブロックする（GoTrueは匿名も`/signup`経路のため）。「匿名はsign-in枠」という前提はSupabase実装と矛盾していた。→ 専用ゲストアカウント方式に改訂。

## Decision
ゲスト = **ログイン時点の実データのスナップショットをローカル(localStorage)に読み込み、そこで自由にCRUDできるサンドボックス**。実DBには一切書き込まない。認証は事前作成した**専用ゲストアカウント**。

- ログイン画面に「ゲストとして試す」ボタン → `signInWithPassword(GUEST_EMAIL, GUEST_PASSWORD)`（`web/src/data/guestConfig.ts` の公開定数。anonキー同様に公開前提）
- 専用ゲストアカウントを admin API で事前作成（disable_signup をバイパス）。anonymous sign-in は無効のまま
- **RLSの書込判定はオーナーuid限定**: `is_writer()` = `auth.uid() = <owner_uid>`。ゲストアカウントは別uidなので**実データを書けない**（RLS+RPCガードで担保）。既存の全ポリシー/RPCは is_writer() を呼ぶだけなので関数本体の差替で全有効
- **クライアント**: ゲスト判定は `session.user.id === GUEST_UID`。ゲスト時 NotesProvider を **MockNotesProvider（localStorage）に切替**。初回に Supabase から notes/note_proposals を SELECT（読み取りは開放）し Mock シードに投入。以降の読み書きは全てローカル。フレームデータ・確反はバンドルJSONで元から動く
  - 自キャラ選択もローカル状態で完結（実DBの is_main は変えない）
  - 編集UIは**本人と同じく全て有効**（サンドボックスなので隠さない）。ヘッダーに「ゲスト（サンドボックス）・リセット/ログアウト」。「変更は保存されません（この端末内のみ）」の注記
- **RLSは書込を非匿名に限定**（migration 0005、多層防御の最終ライン。クライアントがバグで書きに行っても実DBは守られる）:
  - SELECT: authenticated 全員（本人+匿名）可（スナップショット取得のため匿名も読む）
  - INSERT/UPDATE/DELETE: `public.is_writer()`（= `auth.uid() = <owner_uid>`）の本人のみ。ゲストアカウントは別uidなので書込不可
  - **Storage**: `storage.objects` の note-media 書込も `is_writer()` 限定（table RLSと別系統。docs/08 レビュー[Critical2]）
  - reference系（characters/moves/oos_options/habit_tags）は service_role のみ書込なので読み取り開放のみ
  - SECURITY DEFINER RPC（adopt_intel/apply_note_proposal/reject_note_proposal/set_main_character）冒頭で匿名を弾く（RPCはSECURITY DEFINERでRLSをバイパスするため個別ガード必須）
- サインアップは引き続き無効（匿名は sign-in 枠であってサインアップではない）

## Consequences
- ゲストは本人と同じ操作感で自由に試せる。実データは二重に保護（クライアントが書きに行かない + RLSが匿名書込を拒否）
- ゲストの編集はその端末のlocalStorageのみ。リロードで残る（リセットボタンで消去）。ログイン後のスナップショットなので本人の後続変更は反映されない（サンドボックス仕様）
- Mockプロバイダ（既存）をほぼ流用でき実装コスト小
- 匿名ユーザーがSupabaseに生成される（無料枠のユーザー数計上、個人利用で実害小、必要なら定期削除）
- anonキー露出前提のRLS防御線がゲストにも効くことを維持（docs/02 セキュリティ節と整合）
