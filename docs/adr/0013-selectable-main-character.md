# ADR-0013: 自キャラ（メインキャラ）のユーザー選択

Status: Accepted (2026-07-03)

## Context
`characters.is_main` はZSS固定で、立ち回り/技メモ/試合タブと「自キャラ」ナビ・`/me` がこれに従う。ユーザーは自キャラを自由に選べる機能を要望。ただし既存の立ち回り(own_play)/技(own_move)/試合(own_match)メモはZSS固有の内容。

## Decision
- **is_main をUIから変更可能に**。キャラページに「自キャラに設定」アクション。単一制約はRPC `set_main_character(p_character_id)` の**単一UPDATE文**で担保（中間で二重trueにならない）:
  `update characters set is_main = (id = p_character_id);`（部分unique indexは張らない）
- **own_* メモをキャラにスコープする**: own_play/own_move/own_match は `character_id`（notesに既存の列）で所属キャラを持つ
  - own_play/own_match: migration 0004 でZSSにバックフィル
  - own_move: `character_id = moves.character_id`（move由来）でバックフィル。表示は move_id を正とし character_id は主キャラ絞り込み用の非正規化コピー
  - own_* の一覧クエリは `character_id = <現メインキャラ>` でフィルタ
- 自キャラを切り替えると、立ち回り/技/試合タブは新メインキャラのown_*メモを表示（初期は空）。旧メインのメモは character_id で保全され、戻せば再表示（非破壊）
- `getMainCharacter()` と `/me` リダイレクトは is_main を動的解決（ADR-0009で既に動的化済み）

## Consequences
- 複数キャラを本格運用でき、使用キャラ変更・二刀流に対応
- own_* メモがキャラ単位に分離される（正しい挙動）
- **デプロイ順序**: 0004バックフィルは旧コード（own_playを character_id IS NULL でクエリ）と非互換。安全順序は ①新コードを `character_id IS NULL OR character_id = mainId` の両対応でデプロイ → ②0004適用 → ③後続でNULL両対応を撤去（共有DB稼働中プロダクトを壊さない）

## 実装注記（2026-07-03、実装時に判明）
- `characters.is_main` の表示実体は `data/imported/characters.json`（ビルド時固定の静的JSON、ImportedProviderが読む）で、Supabaseの `characters` テーブルとは別系統。`set_main_character` RPCでDB側を更新してもフロント表示に即反映されないため、`DataProvider.setMainCharacterOverride()` + `MainCharacterContext`（起動時にDB実値と同期、切替時にRPC+ローカル上書きを一元管理）で吸収した
- `set_main_character` の単一UPDATE文はSupabaseの「WHERE句なしUPDATE拒否」設定に当たるため `where true` を付与（挙動は不変）
