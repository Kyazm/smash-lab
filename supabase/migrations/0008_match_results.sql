-- 0008: モード別・マッチアップ別の勝敗記録（1タップ即記録の軽量ログ）。ADR-0015。
-- character_id = 対戦相手キャラ（既存「キャラ対メモ」と同じマッチアップ単位）。
-- 追記専用ログ。勝率・連勝・時系列・モード別・キャラ別集計はこのログから純関数で導出する。
--
-- セキュリティ設計（既存 is_writer() の単一オーナーモデルとは別方針）:
--   行単位 user_id = auth.uid() で各実アカウントを分離する（将来のサインアップ開放にそのまま対応）。
--   共有ゲストアカウント(GUEST_UID)は is_guest() でDBレベルで書込排除し、端末内ローカルサンドボックスに閉じる。
--   防御はRLS（docs/02「RLS+Authが唯一の防御線」）。anon publishableキー/ゲストJWTは公開前提。
--   既存 matches テーブル（セッション/動画由来の詳細ログ・is_writer書込）とは責務が別（ADR-0015参照）。

-- 共有ゲスト判定（is_writer() と対の述語）。
create or replace function public.is_guest() returns boolean
  language sql stable as $$
    select auth.uid() = '4847e7ae-b13b-4e5c-b7ff-b63125ec3bfe'::uuid
  $$;

create table if not exists match_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid(),   -- FKは張らない（既存テーブルも auth.users 非参照。整合はRLS with check が担保）
  character_id uuid not null references characters(id) on delete cascade,  -- 対戦相手
  mode         text not null check (mode in ('vip','smamate','offline')),
  result       text not null check (result in ('win','lose')),
  created_at   timestamptz not null default now()
);

create index if not exists match_results_user_scope_idx
  on match_results (user_id, character_id, mode, created_at);

alter table match_results enable row level security;
alter table match_results force row level security;

-- SELECT: 自分の行のみ。ゲストは書込不可＝常に空（既存 GuestNotesProvider と同じ体験）。
drop policy if exists match_results_select_own on match_results;
create policy match_results_select_own on match_results
  for select to authenticated
  using (user_id = auth.uid());

-- INSERT/DELETE: 自分の行 かつ 共有ゲストは排除（防御をアプリ層でなくRLSで保証）。
drop policy if exists match_results_insert_own on match_results;
create policy match_results_insert_own on match_results
  for insert to authenticated
  with check (user_id = auth.uid() and not public.is_guest());

drop policy if exists match_results_delete_own on match_results;
create policy match_results_delete_own on match_results
  for delete to authenticated
  using (user_id = auth.uid() and not public.is_guest());
