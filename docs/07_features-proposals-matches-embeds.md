# 追加機能設計: 承認待ち一覧 / 試合タブ / リッチ埋め込み

2026-07-03。ユーザー要望3件の設計。UI刷新（docs/06）の続き。

## F-A. 承認待ち一覧ページ `/proposals`

AI整頓の提案（現状62 pending）は各キャラのメモタブに散在し、横断で捌けない。1ページに集約する。

- 新ルート `/proposals`。ホームのナビに「承認待ち (N)」リンク+件数バッジ
- **Provider追加**: `listPendingProposals()` — `note_proposals`（status in pending/stale）を `notes`(title, kind, character_id) と `characters`(name_ja, slug) にJOINして `{proposal, noteTitle, kind, characterName, characterSlug}[]` を返す。Supabaseは1クエリのネストselect、Mockは結合を模す
- ページ: キャラ別にグルーピング、各提案は `ProposalReview`（既存の差分・承認/却下UI）をインラインで開閉。承認/却下したら一覧から消える。**stale** は「元メモが編集された」旨と再生成待ちの表示（再生成ボタンはPhase 4のGemini復活後、当面は無効化+注記）
- 楽観ロック（ADR-0010）: 承認時に `apply_note_proposal` が `stale` を返したら、その行をstale表示に切り替える
- 空状態: 「承認待ちの提案はありません」

## F-B. 「試合」タブ（is_mainのみ）

「自分の試合」メモを立ち回りタブから分離し独立タブに。Phase 3のAI試合レビュー（YouTube→Gemini）がこのタブに書き込む前提の土台。

- **migration 0003**: 既存の `kind='own_play'` かつ title='自分の試合' のノートを `kind='own_match'` に変更（1件）。将来の手動試合メモ・Geminiレビュー出力もこのkindに入る
- CharacterPageの is_main タブに「試合」を追加（順序: 立ち回り / 技メモ / 試合）。`?tab=matches`
- `OwnMatchTab`: `kind='own_match'` のメモCRUD（OwnPlayTab同型だがタグフィルタは不要）。YouTube URL埋め込みで試合動画を貼れる
- 立ち回りタブ（own_play）からは自動的に消える（kind変更のため）
- **Phase 3への布石**: このタブのメモがGeminiレビューの入力/出力先になる旨をdocs/03のPhase 3に追記（`matches`テーブルとの関係は後続設計）

## F-C. リッチ埋め込み（ADR-0012）

Markdownレンダラを拡張し、メモ本文中のURL・プレースホルダを埋め込み表示。詳細はADR-0012。実装は `web/src/lib/markdown.tsx` + 新規 `lib/embeds.ts`（URL種別判定の純関数、テスト対象）。

- 判定純関数 `classifyUrl(url): {kind: 'youtube'|'image'|'tweet'|'link', ...}` にテスト
- `attachment://` 解決は storage_path 変換の純関数 + `notesProvider.resolveImageUrl`
- ブロック要素として段落から分離（画像・埋め込みは `<p>` に入れない）

## 実装・検証

- 1エージェント（Sonnet）で F-A/F-B/F-C をまとめて実装（すべて notes 領域で競合するため直列）。migration 0003 は先に本セッションで適用
- vitest（embeds.ts / listPendingProposals のMock / attachment解決）、build、モバイル+実データ（Supabase）でのブラウザ確認
- Mockプロバイダにも提案・own_match・埋め込み対象を含むseedを追加し、mock検証を可能に
