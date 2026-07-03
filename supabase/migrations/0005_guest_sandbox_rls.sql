-- 0005: ゲスト（専用アカウント）サンドボックスのRLS防御線（ADR-0014 / docs/08 G-3）。
-- 0001の全 for-all ポリシーを「SELECT=authenticated全員 / INSERT/UPDATE/DELETE=is_writer()限定」に置換。
-- reference系（characters/moves/oos_options/habit_tags）はselect開放のみ（元々authenticated全権だったが
-- 書込はservice_roleのみが行う運用のため、is_writer()限定にしても実害はない）。
-- storage.objects の note-media 書込も is_writer() 限定にする（別系統のRLSのため個別対応が必須）。
-- SECURITY DEFINER RPC は個別に is_writer() ガードを追加（RPCはRLSをバイパスするため）。

begin;

-- ============================================================
-- is_writer(): 書込者判定を一元化。オーナー本人のuidのみ書込可。
-- 当初は匿名sign-in(is_anonymousクレーム)方式だったが、Supabaseの disable_signup=true が
-- signInAnonymously() もブロックするため、専用ゲストアカウント方式に変更（docs/08 G-3、DBは対応済み）。
-- ゲストは別uidの通常アカウントなので、この判定で実データへの書込が拒否される。
-- OWNER_UID は本人のauth.users.id（.context/guest-creds.txt / 本番Auth参照）。
-- ============================================================
create or replace function public.is_writer() returns boolean
language sql stable as $$
  select auth.uid() = '2035ebe5-27c0-4c31-b34d-cc957a0529f8'::uuid
$$;

-- ============================================================
-- 全テーブルのポリシーを置換: for-all(authenticated) → select(全authenticated) + write(is_writer())
-- ============================================================
do $$
declare
  t text;
  tbls text[] := array[
    'characters','moves','oos_options','notes','note_media','sessions',
    'matches','ai_reviews','focus_points','habit_tags','intel_items','intel_requests',
    'note_revisions','note_proposals'
  ];
begin
  foreach t in array tbls loop
    execute format('drop policy if exists %I on %I;', t || '_authenticated_all', t);

    execute format($f$
      create policy %I on %I
        for select
        to authenticated
        using (true);
    $f$, t || '_select_all', t);

    execute format($f$
      create policy %I on %I
        for insert
        to authenticated
        with check (public.is_writer());
    $f$, t || '_insert_writer', t);

    execute format($f$
      create policy %I on %I
        for update
        to authenticated
        using (public.is_writer())
        with check (public.is_writer());
    $f$, t || '_update_writer', t);

    execute format($f$
      create policy %I on %I
        for delete
        to authenticated
        using (public.is_writer());
    $f$, t || '_delete_writer', t);
  end loop;
end;
$$;

-- ============================================================
-- Storage: note-media バケットの書込を is_writer() 限定に（public-read は維持）。
-- ============================================================
drop policy if exists "note_media_insert_writer" on storage.objects;
drop policy if exists "note_media_update_writer" on storage.objects;
drop policy if exists "note_media_delete_writer" on storage.objects;

create policy "note_media_insert_writer" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'note-media' and public.is_writer());

create policy "note_media_update_writer" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'note-media' and public.is_writer())
  with check (bucket_id = 'note-media' and public.is_writer());

create policy "note_media_delete_writer" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'note-media' and public.is_writer());

-- ============================================================
-- SECURITY DEFINER RPC は RLS をバイパスするため、冒頭で個別ガードが必要。
-- adopt_intel / apply_note_proposal / reject_note_proposal に is_writer() チェックを追加。
-- set_main_character は 0004 で既に匿名チェック済みだが、is_writer() へ統一する。
-- ============================================================
create or replace function adopt_intel(
  intel_id uuid,
  mode text,
  target_note_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intel      intel_items%rowtype;
  v_note_id    uuid;
  v_source_tag text;
  v_append     text;
begin
  if not public.is_writer() then
    raise exception 'adopt_intel: anonymous users cannot write';
  end if;

  select * into v_intel from intel_items where id = intel_id for update;
  if not found then
    raise exception 'intel_item % not found', intel_id;
  end if;
  if v_intel.status = 'adopted' then
    raise exception 'intel_item % is already adopted', intel_id;
  end if;

  v_source_tag := format('（出典: %s）', v_intel.source_url);

  if mode = 'new_note' then
    insert into notes (kind, character_id, title, body_md, source)
    values (
      case when v_intel.character_id is null then 'own_play' else 'matchup' end,
      v_intel.character_id,
      coalesce(v_intel.title, '（無題の採用ノート）'),
      coalesce(v_intel.summary_md, '') || E'\n\n' || v_source_tag,
      'intel_adopted'
    )
    returning id into v_note_id;

  elsif mode = 'append_proposal' then
    if target_note_id is null then
      raise exception 'append_proposal requires target_note_id';
    end if;
    perform 1 from notes where id = target_note_id;
    if not found then
      raise exception 'target note % not found', target_note_id;
    end if;
    v_append := E'\n\n---\n' || coalesce(v_intel.summary_md, '') || E'\n' || v_source_tag;
    update notes
      set body_md = coalesce(body_md, '') || v_append
      where id = target_note_id;
    v_note_id := target_note_id;

  else
    raise exception 'unknown adopt mode: % (expected new_note | append_proposal)', mode;
  end if;

  update intel_items
    set status = 'adopted',
        adopted_note_id = v_note_id
    where id = intel_id;

  return v_note_id;
end;
$$;

create or replace function apply_note_proposal(p_proposal_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal   note_proposals%rowtype;
  v_note       notes%rowtype;
begin
  if not public.is_writer() then
    raise exception 'apply_note_proposal: anonymous users cannot write';
  end if;

  select * into v_proposal from note_proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'note_proposal % not found', p_proposal_id;
  end if;
  if v_proposal.status <> 'pending' then
    raise exception 'note_proposal % is not pending (status=%)', p_proposal_id, v_proposal.status;
  end if;

  select * into v_note from notes where id = v_proposal.note_id for update;
  if not found then
    raise exception 'note % not found', v_proposal.note_id;
  end if;

  if v_note.updated_at <> v_proposal.base_updated_at then
    update note_proposals set status = 'stale' where id = p_proposal_id;
    return 'stale';
  end if;

  insert into note_revisions (note_id, body_md, reason)
    values (v_note.id, v_note.body_md, 'ai_restructure');

  update notes
    set body_md = v_proposal.proposed_body_md
    where id = v_note.id;

  update note_proposals set status = 'accepted' where id = p_proposal_id;

  return 'accepted';
end;
$$;

create or replace function reject_note_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_writer() then
    raise exception 'reject_note_proposal: anonymous users cannot write';
  end if;

  select status into v_status from note_proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'note_proposal % not found', p_proposal_id;
  end if;
  if v_status <> 'pending' then
    raise exception 'note_proposal % is not pending (status=%)', p_proposal_id, v_status;
  end if;

  update note_proposals set status = 'rejected' where id = p_proposal_id;
end;
$$;

create or replace function set_main_character(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_writer() then
    raise exception 'set_main_character: anonymous users cannot write';
  end if;

  perform 1 from characters where id = p_character_id;
  if not found then
    raise exception 'character % not found', p_character_id;
  end if;

  -- Supabase側の安全設定（pg-safeupdate相当）がWHERE句無しUPDATEを拒否するため、
  -- 全行対象であることを明示する where true を付ける（単一UPDATE文の方針自体は変えない）。
  update characters set is_main = (id = p_character_id) where true;
end;
$$;

commit;
