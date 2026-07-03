# 追加機能設計: 確反デフォルト / 自キャラ選択 / ゲストログイン

2026-07-03。ユーザー要望3件。features-v2（docs/07）のマージ後に着手（同じファイル群に触れるため直列）。

## G-1. ガード解除反撃をデフォルト表示

確反タブの shield_drop（ガード解除して出す反撃）トグルを**デフォルトON**にする。
- `web/src/components/PunishHitList.tsx` の `useState(false)` → `useState(true)`（`showShieldDrop`）
- docs/06 の「shield_drop系はデフォルト非表示」記述を「デフォルト表示（トグルで隠せる）」に更新
- 理由: ユーザー判断。フレーム上確定の網羅性を優先

## G-2. 自キャラのユーザー選択（ADR-0013）

依存: features-v2 の OwnMatchTab（試合タブ）が存在する前提（docs/07 F-B）。G-2はその後。

- **set_main_character(p_character_id uuid)** RPC（SECURITY DEFINER、set search_path、非書込者=匿名を弾く）:
  - is_main単一制約は**単一UPDATE文**で担保（中間で二重trueにしない。レビュー[High4]）:
    `update characters set is_main = (id = p_character_id);`
  - 部分unique indexは張らない
- **migration 0004（デプロイ順序に注意、レビュー[High3]）**:
  - own_play/own_match: `character_id` を NULL→ZSS にバックフィル
  - own_move: `character_id = (select character_id from moves where id = notes.move_id)`（**move由来**。ZSS一律は誤り。レビュー[Medium8]）。own_moveの表示は引き続き move_id を正とし、character_id は主キャラ絞り込み用の非正規化コピー
  - **適用順序**: ①新コード（own_* クエリを `character_id IS NULL OR character_id = mainId` の**両対応**）を先にデプロイ → ②0004バックフィル → ③後続でNULL両対応を撤去。単純同時デプロイは避ける
- **UI**: キャラページ（任意キャラ）に「⭐ 自キャラに設定」ボタン（現メインには「自キャラ」バッジ）。押下で set_main_character→再読込
- **own_* のスコープ化**: OwnPlayTab/OwnMoveTab/OwnMatchTab を主キャラ絞り込みに。NoteEditor の own 系作成時に character_id=mainId を付与
- タブ表示条件（is_main）・「自キャラ」ナビ・/me は既存の動的解決を流用

## G-3. ゲストサンドボックス（ADR-0014）

ゲストは実DBに書かず、ログイン時スナップショットをローカルで自由編集。編集UIは**隠さない**（本人と同じ操作感）。DB側は多層防御の最終ラインとして匿名書込を全面拒否。

- **Supabase設定**: anonymous sign-in を有効化（`external_anonymous_users_enabled`。email/passwordのサインアップ無効設定とは独立、両者独立を確認済み。本セッションでManagement API適用）
- **migration 0005**（0001の単一 for-all ポリシーを置換、全対象テーブル）:
  - **書込者判定を関数に一元化**（レビュー[Critical1]/[High6]）:
    ```sql
    create or replace function public.is_writer() returns boolean
    language sql stable as $$
      select coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
    $$;
    ```
    ※ `->>'is_anonymous' = 'false'` は不可（本人JWTにclaim無しだとNULL→全書込拒否）
  - ポリシー: `for select to authenticated using (true)` ＋ insert/update/delete を `is_writer()` 限定（using/with check）
  - reference系（characters/moves/oos_options/habit_tags）は select 開放のみ
  - **Storage**（レビュー[Critical2]）: `storage.objects` の note-media に対し insert/update/delete を `is_writer()` 限定にするポリシー追加（public-readは維持）
  - **SECURITY DEFINER RPC全て**（adopt_intel / apply_note_proposal / reject_note_proposal / set_main_character）の冒頭で `if not public.is_writer() then raise exception ...`（RPCはRLSをバイパスするため個別ガード必須）
  - 注記: 匿名ログイン後は authenticated ロール。service_role は force RLS をバイパス（パイプライン無影響）。anonロール向けポリシーは足さない
- **クライアント（サンドボックス）**:
  - AuthGate通過後 `session.user.is_anonymous` を Context 化（`useIsGuest()`）
  - ゲスト時は NotesProvider を **MockNotesProvider（localStorage）** に切替。初回に Supabase から notes/note_proposals を anon SELECT し Mock にシード
  - 自キャラ選択もローカル状態で完結（実DB非更新）
  - ヘッダー: 「ゲスト（サンドボックス）／変更はこの端末内のみ・保存されません」＋ リセット（localStorage消去）／ログアウト
- **ログイン画面**: 「ゲストとして試す」ボタン → `signInAnonymously()`

## 実装・検証

- 1エージェント（Sonnet）で G-1/G-2/G-3。migration 0004/0005 適用と anon 有効化はエージェントが実施（0002/0003実績あり）。**0004は G-2 の新コード（両対応クエリ）完成後**に適用
- G-1 は `PunishHitList.tsx:17` を `useState(true)` に + 同ファイル冒頭コメント + docs/06 の当該記述を更新（レビュー[Low]、docs/02は本セッションで更新済み）
- vitest（set_main のMock、is_writer分岐、own_* スコープ、ゲストMock切替）、build、実データ+モバイルのブラウザ確認:
  - 本人ログインで自キャラ切替（ZSS→別キャラ→戻す）とown_*の追従・非破壊性
  - ゲストで**自由に編集でき**、リロードで残り、リセットで消え、**実DBに反映されない**こと（本人ログインで無変更を確認）
  - RLS実効: ゲストJWTでの直接write（devコンソール）が拒否・本人writeは通る
  - shield_dropがデフォルト表示
- Mock seedに複数キャラのown_* とゲスト初期データも足す
