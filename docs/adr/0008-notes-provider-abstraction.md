# ADR-0008: メモ機能のデータ供給抽象（NotesProvider）とモック切替

Status: Accepted (2026-07-03)

## Context
Phase 2 でメモ機能（notes / note_media / 横断検索）を実装する。実 Supabase DB は migration 未適用・Auth ユーザー未作成のため、実通信の e2e 検証ができない。一方、既存の `DataProvider`（characters/moves/oos_options の読み取り専用）はフレームデータ表示専用で、フィクスチャ静的 import に閉じている。メモは CRUD であり localStorage 永続のモックが必要。

## Decision
- フレームデータ供給（`DataProvider`）とメモ供給を**別インターフェース**に分ける。メモ用は `NotesProvider`（`web/src/data/notes/NotesProvider.ts`）。
  - 理由: `DataProvider` の3実装（Fixture/Imported/Supabase）はフレームデータの静的読み取りに最適化されており、CRUD を混ぜると責務が肥大化する。Phase 1 の16テストと build を壊さないため既存3ファイルは変更最小に留める。
- `NotesProvider` の実装は2つ:
  - `MockNotesProvider`: localStorage 永続。開発・ブラウザ検証の既定。seed データを同梱。
  - `SupabaseNotesProvider`: 実 DB。`supabase-js` 経由。migration 適用・Auth 後に親セッションが検証。
- 切替は環境変数 `VITE_NOTES_PROVIDER`（`mock` | `supabase`）。既定は `mock`。`VITE_DATA_PROVIDER=supabase` のときのみ `supabase` を既定にする（フレームデータと足並みを揃える）。
- `adopt_intel` 相当のロジックは Phase 2 スコープ外（intel UI は Phase 2 では作らない）。ただし `source` 列は仕様通り持ち、手動作成は `manual` 固定。
- 画像アップロードはモック時 DataURL、Supabase 時 Storage バケット `note-media`。YouTube URL は埋込プレイヤー（`youtube-nocookie.com/embed`）に変換し `t`（開始秒）対応。
- 純粋ロジック（YouTube URL パース、検索フィルタ、プロバイダのマッピング）に vitest を追加する。

## Consequences
- 既存 `DataProvider` 系（Phase 1）は無変更で16テスト維持。
- モックで全 UI をブラウザ検証可能。実 DB 検証は migration 適用後に環境変数を切り替えるだけ。
- Supabase 依存（`@supabase/supabase-js`）を web に追加する。
- Supabase 実接続時の残作業（Storage バケット作成・Auth ログイン UI 等）は Phase 2 完了報告に一覧化する。

## 追補（2026-07-03、UI刷新にて）

AI整頓（ADR-0010）の提案系メソッド `listProposals / applyProposal / rejectProposal` は `NotesProvider` インターフェースに追加する（別Provider新設はしない。提案はnotesと密結合のため）。`MockNotesProvider` は提案seedを同梱し、UI実装がSupabase無しでブラウザ検証できることを維持する。
