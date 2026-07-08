-- 0010: AI試合レビューのキュー整備（YouTube+タイムスタンプ → Claude Codeフレーム解析）。ADR-0019。
-- 0001作成の matches / ai_reviews（0行・未使用）を再利用し、0009 と同じ
-- 「0行ガード → 行単位 user_id 分離」モデルへ移行する。
-- 前提: 両テーブルは0行。0行でないと user_id の default auth.uid() が
-- migration実行コンテキスト（auth.uid()=NULL）でbackfill不能なため、冒頭でガードする。
-- force row level security は 0001 で全テーブル適用済み。is_guest() は 0008、set_updated_at() は 0001 定義。

begin;

-- 0行ガード（user_id backfill未実装のため空テーブルを要求）
do $$ begin
  if exists (select 1 from matches) or exists (select 1 from ai_reviews) then
    raise exception '0010 expects empty matches/ai_reviews (user_id backfill not implemented)';
  end if;
end $$;

-- ============================================================
-- matches: user分離 + モード列追加 + played_at に default 付与
--   opponent_character_id / result / video_url / memo / meta_source は 0001 の既存列を流用（追加しない）
-- ============================================================
alter table matches
  add column user_id uuid not null default auth.uid(),
  add column mode text check (mode in ('vip','smamate','offline'));

-- 0001:117 の played_at は nullable・default無し。フォーム未指定時にサーバ時計で入るよう default 付与
alter table matches
  alter column played_at set default now();

drop policy if exists matches_select_all on matches;
drop policy if exists matches_insert_writer on matches;
drop policy if exists matches_update_writer on matches;
drop policy if exists matches_delete_writer on matches;

create policy matches_select_own on matches
  for select to authenticated using (user_id = auth.uid());
create policy matches_insert_own on matches
  for insert to authenticated with check (user_id = auth.uid() and not public.is_guest());
create policy matches_update_own on matches
  for update to authenticated
  using (user_id = auth.uid() and not public.is_guest())
  with check (user_id = auth.uid() and not public.is_guest());
create policy matches_delete_own on matches
  for delete to authenticated using (user_id = auth.uid() and not public.is_guest());

-- ============================================================
-- ai_reviews: user分離 + レビュー用列追加 + updated_at 自動更新 + status語彙拡張
--   match_id / model / summary_md / findings / focus_evaluations / created_at は 0001 既存列を流用
-- ============================================================
alter table ai_reviews
  add column user_id uuid not null default auth.uid(),
  add column requested_timestamps jsonb not null default '[]'::jsonb,  -- [{t_sec:number, label?:string}]
  add column one_mistake text,                                          -- One-Mistake Rule の改善仮説1文
  add column error_message text,
  add column updated_at timestamptz not null default now();

-- 既存 set_updated_at()（0001:207）を ai_reviews にも張る
create trigger ai_reviews_set_updated_at
  before update on ai_reviews
  for each row
  execute function set_updated_at();

-- status: 0001 の無名インライン制約（デフォルト名 ai_reviews_status_check、pending/done/error）を
-- drop し、processing を加えた語彙で同名再作成
alter table ai_reviews drop constraint ai_reviews_status_check;
alter table ai_reviews
  add constraint ai_reviews_status_check
  check (status in ('pending','processing','done','error'));

drop policy if exists ai_reviews_select_all on ai_reviews;
drop policy if exists ai_reviews_insert_writer on ai_reviews;
drop policy if exists ai_reviews_update_writer on ai_reviews;
drop policy if exists ai_reviews_delete_writer on ai_reviews;

create policy ai_reviews_select_own on ai_reviews
  for select to authenticated using (user_id = auth.uid());
create policy ai_reviews_insert_own on ai_reviews
  for insert to authenticated with check (user_id = auth.uid() and not public.is_guest());
create policy ai_reviews_update_own on ai_reviews
  for update to authenticated
  using (user_id = auth.uid() and not public.is_guest())
  with check (user_id = auth.uid() and not public.is_guest());
create policy ai_reviews_delete_own on ai_reviews
  for delete to authenticated using (user_id = auth.uid() and not public.is_guest());

-- ============================================================
-- index: 一覧の実ソートキー・キュー走査に一致（matches側indexは作らない）
-- ============================================================
create index ai_reviews_pending_idx on ai_reviews (created_at)
  where status in ('pending','processing');
create index ai_reviews_user_idx on ai_reviews (user_id, created_at desc);

-- ============================================================
-- habit_tags 語彙拡張（方法論の原因タグ。0001:324-337 のseed書式に厳密一致）
-- ============================================================
insert into habit_tags (slug, label) values
  ('combo_escape',       'コンボ抜け'),
  ('self_destruct',      '暴発・自滅'),
  ('percent_management', '%管理')
on conflict (slug) do nothing;

-- ============================================================
-- create_review_request(): フォーム入力から matches + ai_reviews を1トランザクションINSERT。
--   SECURITY DEFINER（RLSバイパス）のため冒頭で auth.uid()/is_guest()/入力形状を個別ガードする
--   （adopt_intel / apply_note_proposal の既存流儀）。
--   返り値: 生成した ai_reviews.id
-- ============================================================
create or replace function create_review_request(
  p_video_url             text,
  p_timestamps            jsonb,
  p_opponent_character_id uuid,
  p_mode                  text,
  p_result                text,
  p_memo                  text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id  uuid;
  v_review_id uuid;
begin
  -- 認証・ゲストガード（SECURITY DEFINERはRLSをバイパスするため必須）
  if auth.uid() is null then
    raise exception 'create_review_request: authentication required';
  end if;
  if public.is_guest() then
    raise exception 'create_review_request: guest users cannot write';
  end if;

  -- p_timestamps の形状検証: 非空配列で各要素が t_sec(number) を持つオブジェクト
  if p_timestamps is null or jsonb_typeof(p_timestamps) <> 'array' then
    raise exception 'create_review_request: p_timestamps must be a jsonb array';
  end if;
  if jsonb_array_length(p_timestamps) = 0 then
    raise exception 'create_review_request: p_timestamps must not be empty';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_timestamps) as e
    where jsonb_typeof(e) <> 'object'
       or jsonb_typeof(e -> 't_sec') is distinct from 'number'  -- t_sec 欠落(NULL)も検出
  ) then
    raise exception 'create_review_request: each timestamp must be an object with numeric t_sec';
  end if;

  -- matches INSERT（meta_source は AI推定廃止で 'manual' 固定。played_at は default now()）
  insert into matches (
    user_id, opponent_character_id, result, video_url, memo, mode, meta_source
  ) values (
    auth.uid(), p_opponent_character_id, p_result, p_video_url, p_memo, p_mode, 'manual'
  )
  returning id into v_match_id;

  -- ai_reviews INSERT（キュー投入。エンジンは claude-code）
  insert into ai_reviews (
    match_id, user_id, status, requested_timestamps, model
  ) values (
    v_match_id, auth.uid(), 'pending', p_timestamps, 'claude-code'
  )
  returning id into v_review_id;

  return v_review_id;
end;
$$;

grant execute on function create_review_request(text, jsonb, uuid, text, text, text) to authenticated;

commit;
