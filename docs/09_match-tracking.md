# 追加機能設計: モード別・マッチアップ別 勝敗記録

2026-07-03。ユーザー要望の設計。

## 目的

一覧でモードを選択し、勝/負をワンタップで記録できるようにする。記録した結果はモード別・マッチアップ別に勝率・連勝をグラフ表示する。

## データモデル

新テーブル `match_results`（`character_id`=対戦相手キャラ、`mode`=vip/smamate/offline、`result`=win/lose の追記専用ログ）。RLSモデルの決定と理由はADR-0015を参照（行単位 `user_id = auth.uid()` 分離、`is_writer()` は不使用）。適用済み migration は `supabase/migrations/0008_match_results.sql`。

## プロバイダ層

`web/src/data/match/` に配置する想定。notesのProxy委譲パターンを踏襲する。

- owner: `SupabaseMatchProvider`（DB書込。`user_id` はdefault依存でクライアントから送らない）
- guest: `LocalMatchProvider`（localStorage。シードしない空サンドボックスから開始。DBには一切書き込まない）

## モード状態の永続化

選択中モードは `smash-lab.match-mode.v1` にlocalStorage永続。既定値は `'vip'`。自キャラContextと同型の実装にする。

## UI

### 一覧（CharacterListPage）
- `ModeSelector`（VIP / スマメイト / オフラインのセグメント）
- 各行に `WinLoseControl`（勝/負ボタン、現モードの戦績を小さく表示、タップ→楽観更新→数秒間undo可能）

### キャラ詳細「戦績」タブ
`CommonTab` に追加。`is_main` 不問（対戦相手キャラ単位のため全キャラ共通）。「vsこのキャラ」の成績を表示する。

タブ順序: フレーム表 / 確定反撃 / キャラ対メモ / **戦績** / 立ち回り / 技メモ / 試合

### `/stats` 全体ダッシュボード
新ルート。ゲストにも表示可（自分のローカル戦績を試せる）。モードフィルタと4種のグラフを表示する。

## グラフ（4種、手書きSVG/CSS、ライブラリ非導入）

1. 勝率の時系列推移（累積、SVG polyline）
2. モード別サマリ（横バー3行）
3. 連勝/連敗（現在＋最長）
4. キャラ別ランキング（勝率降順、得意/苦手）

## RLS

ADR-0015参照。要点: 行単位 `user_id = auth.uid()` 分離、ゲストは `is_guest()` でDBレベルの書込を排除。

## テスト方針

- 集計ロジック（`matchStats.ts`）は純関数でユニットテスト必須。境界: 空 / 全勝 / 全敗 / 連勝連敗の符号 / ゼロ除算など
- `LocalMatchProvider` のテスト
- ブラウザでの実データ検証: 一覧でのモード切替→記録→undo、戦績タブ、`/stats`、ゲストがDB非書込であること

## 実装・検証

実装はサブエージェントへ委譲する。DB migration適用と最終統合監査は本セッションで行う。
