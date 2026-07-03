# ADR-0015: モード別・マッチアップ別の勝敗記録（match_results）

Status: Accepted (2026-07-03)

## Context
既存の一覧・キャラ詳細に「勝敗を1タップで記録し、モード別・マッチアップ別に勝率/連勝をグラフで見たい」という要望がある。既存の `matches` テーブルはセッション/動画由来の詳細ログ（`session_id` 必須、Gemini推定の `opponent_character_id`/`result` を前提）で、1タップ即記録という用途には重すぎる。

## Decision

### 新テーブル `match_results`
1タップ即記録の軽量勝敗ログ。`character_id` は**対戦相手キャラ**を指す（マッチアップ単位、既存「キャラ対メモ」と同じ意味づけ）。`mode`（vip/smamate/offline）と `result`（win/lose）を持つ。追記専用ログとし、勝率・連勝・時系列・モード別・キャラ別集計はすべてこのログから純関数で導出する。

```sql
create or replace function public.is_guest() returns boolean
  language sql stable as $$
    select auth.uid() = '4847e7ae-b13b-4e5c-b7ff-b63125ec3bfe'::uuid
  $$;

create table match_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid(),
  character_id uuid not null references characters(id) on delete cascade,
  mode         text not null check (mode in ('vip','smamate','offline')),
  result       text not null check (result in ('win','lose')),
  created_at   timestamptz not null default now()
);
create index match_results_user_scope_idx on match_results (user_id, character_id, mode, created_at);
alter table match_results enable row level security;
alter table match_results force row level security;

create policy match_results_select_own on match_results
  for select to authenticated using (user_id = auth.uid());
create policy match_results_insert_own on match_results
  for insert to authenticated with check (user_id = auth.uid() and not public.is_guest());
create policy match_results_delete_own on match_results
  for delete to authenticated using (user_id = auth.uid() and not public.is_guest());
```

（migration 0008_match_results.sql として適用済み）

### RLSモデル: 行単位 `user_id = auth.uid()`（is_writer()は不使用）
既存テーブル群は `is_writer()`（単一オーナーのuidにのみ全書込権を与える述語）で保護されている。`match_results` はこの方式を採らず、行単位で `user_id = auth.uid()` を課す新方式にする。

- オーナー1人に全データの書込権を集約する設計はセキュリティリスクが大きい。行単位分離ならある行の書込権はその行の所有者にしか及ばない
- 将来のサインアップ開放でマルチアカウントになっても、この方式ならスキーマ変更なしにそのまま対応できる

共有ゲスト（GUEST_UID）は新設の `is_guest()` 関数でDBレベルの書込を排除する。SELECTは自分の行のみ（ゲストも他ユーザーの行は見えない）。書込判定をアプリ層のプロバイダ切替に委ねず、RLSに置く（docs/02「RLSが唯一の防御線」方針の順守）。ゲストは端末内ローカルサンドボックスの体験を継続し、DBは常に空に見える（既存GuestNotesProviderと同じ体験）。

### 既存 `matches` テーブルとの責務分離
- 既存 `matches`: セッション/動画由来の詳細ログ。`is_writer()` 書込、`session_id` 必須、Gemini推定前提
- 新 `match_results`: モード別の軽量勝敗ログ。`user_id` 行単位分離、`mode` 列あり、1タップ記録

UI上も「試合」タブ（定性メモ）と「戦績」タブ（定量集計）は別物として扱う。将来的な統合の可能性はあるが、現時点では分離する。

### 集計方針
勝率・連勝・時系列・モード別サマリ・キャラ別ランキングは、追記ログから純関数で導出する。

### グラフ描画
ライブラリを導入せず、手書きSVG/CSSで実装する（プロジェクトの既存方針と整合）。

### IA
キャラ詳細ページに「戦績」タブを追加する。全体ダッシュボードは新ルート `/stats` とする（`/me` はADR-0009で自キャラページへのリダイレクト用途のため、既存導線を壊さないよう新設する）。

## Consequences
- 既存テーブル群（notes等）の `is_writer()` から行単位 `user_id` 分離への一括移行は本ADRのスコープ外。必要になれば別ADRで検討する
- 集計は当面クライアントで全件取得して計算する。将来データ量が増えた場合はRPCまたはmaterialized viewへの移行余地がある
- ミラーマッチ（自キャラvs自キャラ）は記録を許容する（禁止しない）
- 行単位RLSにより各実アカウントのデータが物理的に分離される一方、ゲストは書込不可のため常に空のダッシュボードになる（既存ゲスト体験との一貫性）
