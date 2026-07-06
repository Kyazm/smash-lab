-- 0009: 練習ループ（セッション・意識ポイント）。ADR-0018。
-- sessions / focus_points を match_results(0008) と同じ「行単位 user_id 分離」モデルへ移行し、
-- 未実装だった練習ループ機能（目的設定→振り返り、意識ポイント）の土台にする。
-- 前提: 両テーブルは0行（機能未実装のため）。0行でないと user_id の default auth.uid() が
-- migration実行コンテキスト（auth.uid()=NULL）でbackfill不能なため、冒頭でガードする。
-- force row level security は 0001 で全テーブル適用済み。

begin;

do $$ begin
  if exists (select 1 from sessions) or exists (select 1 from focus_points) then
    raise exception '0009 expects empty sessions/focus_points (user_id backfill not implemented)';
  end if;
end $$;

-- ============================================================
-- focus_points: category追加（docs/02の記載と実DBの乖離解消）+ user分離
-- ============================================================
alter table focus_points
  add column category text not null default 'technical' check (category in ('technical','mental')),
  add column user_id uuid not null default auth.uid();

drop policy if exists focus_points_select_all on focus_points;
drop policy if exists focus_points_insert_writer on focus_points;
drop policy if exists focus_points_update_writer on focus_points;
drop policy if exists focus_points_delete_writer on focus_points;

create policy focus_points_select_own on focus_points
  for select to authenticated using (user_id = auth.uid());
create policy focus_points_insert_own on focus_points
  for insert to authenticated with check (user_id = auth.uid() and not public.is_guest());
create policy focus_points_update_own on focus_points
  for update to authenticated
  using (user_id = auth.uid() and not public.is_guest())
  with check (user_id = auth.uid() and not public.is_guest());
create policy focus_points_delete_own on focus_points
  for delete to authenticated using (user_id = auth.uid() and not public.is_guest());

create index focus_points_user_idx on focus_points (user_id, active);

-- ============================================================
-- sessions: 時間窓（started_at/ended_at）+ user分離。
-- 戦績との紐づけはFKでなく時間窓（match_results.created_at ∈ [started_at, ended_at)）。
-- started_at はDB default now() を正とする（クライアントは送らない。match_results.created_at と
-- 同じサーバ時計に統一し、開始直後の記録が窓から漏れる時計ズレを防ぐ）。
-- ============================================================
alter table sessions
  add column user_id uuid not null default auth.uid(),
  add column started_at timestamptz not null default now(),
  add column ended_at timestamptz,
  add constraint sessions_ended_after_start check (ended_at is null or ended_at >= started_at);

drop policy if exists sessions_select_all on sessions;
drop policy if exists sessions_insert_writer on sessions;
drop policy if exists sessions_update_writer on sessions;
drop policy if exists sessions_delete_writer on sessions;

create policy sessions_select_own on sessions
  for select to authenticated using (user_id = auth.uid());
create policy sessions_insert_own on sessions
  for insert to authenticated with check (user_id = auth.uid() and not public.is_guest());
create policy sessions_update_own on sessions
  for update to authenticated
  using (user_id = auth.uid() and not public.is_guest())
  with check (user_id = auth.uid() and not public.is_guest());
create policy sessions_delete_own on sessions
  for delete to authenticated using (user_id = auth.uid() and not public.is_guest());

create index sessions_user_started_idx on sessions (user_id, started_at desc);
-- activeセッション（ended_at null）はユーザーごとに最大1本（多重タブ競合のDBレベル防御）。
-- クライアントのstart()は23505（unique violation）時にgetActiveを再取得してそれを使う。
create unique index sessions_one_active_per_user_idx on sessions (user_id) where ended_at is null;

commit;
