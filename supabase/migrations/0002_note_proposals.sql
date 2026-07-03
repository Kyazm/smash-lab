-- smash-lab Phase 2: キャラ対メモのAI整頓（提案・承認制）
-- 設計: docs/06_ui-redesign.md「キャラ対メモのAI整頓（ADR-0010）」/ docs/adr/0010-ai-note-restructure.md
-- RLS: 0001 と同じ「authenticated ロールに全権」（シングルユーザー、docs/02 line 74）。

begin;

-- ============================================================
-- note_revisions  （承認時の旧本文保全。reason列で将来のintel採用時の本文差替にも転用可能な汎用設計）
-- ============================================================
create table note_revisions (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references notes(id) on delete cascade,
  body_md      text,
  replaced_at  timestamptz not null default now(),
  reason       text
);
create index note_revisions_note_id_idx on note_revisions (note_id);

-- ============================================================
-- note_proposals  （AI整頓の提案。承認/却下はUIから1件ずつ。一括承認はしない：ADR-0010）
-- ============================================================
create table note_proposals (
  id                uuid primary key default gen_random_uuid(),
  note_id           uuid not null references notes(id) on delete cascade,
  proposed_body_md  text not null,
  change_summary    text,
  engine            text,
  base_updated_at   timestamptz not null,
  status            text not null default 'pending' check (status in ('pending','accepted','rejected','stale')),
  created_at        timestamptz not null default now()
);
create index note_proposals_note_id_idx on note_proposals (note_id);
create index note_proposals_status_idx on note_proposals (status);

-- ============================================================
-- RLS: authenticated ロールに全権 + force RLS（0001 と同じ方針）
-- ============================================================
do $$
declare
  t text;
  tbls text[] := array['note_revisions','note_proposals'];
begin
  foreach t in array tbls loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format($f$
      create policy %I on %I
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t || '_authenticated_all', t);
  end loop;
end;
$$;

-- ============================================================
-- apply_note_proposal(): 提案の承認。SECURITY DEFINER で 1トランザクション（ADR-0010）
--   ①proposalsをロックして取得（pending以外は例外）
--   ②notes.updated_at と base_updated_at を照合。不一致 → status='stale' にして中断（楽観ロック）
--   ③一致 → note_revisions に旧本文を保存(reason='ai_restructure') → notes.body_md 更新 → status='accepted'
-- 返り値: 適用後の status（'accepted' | 'stale'）
-- ============================================================
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

grant execute on function apply_note_proposal(uuid) to authenticated;

-- ============================================================
-- reject_note_proposal(): 提案の却下。pending以外は例外。
-- ============================================================
create or replace function reject_note_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
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

grant execute on function reject_note_proposal(uuid) to authenticated;

commit;
