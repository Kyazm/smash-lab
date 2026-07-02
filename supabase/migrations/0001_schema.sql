-- smash-lab Phase 1 スキーマ
-- 設計: docs/02_architecture.md データモデル（lines 35-72）に厳密一致させること。
-- RLS: シングルユーザーのため全テーブル「authenticated ロールに全権」で統一（owner 列は持たない）。
--   サインアップ無効化により本人以外の auth ユーザーは存在しない。anon キーは公開前提であり RLS+Auth が唯一の防御線（docs/02 line 74）。
-- 昇格: intel → notes は adopt_intel() RPC（SECURITY DEFINER）経由のみ（ADR-0004）。

begin;

-- 検索用（notes.body_md/title/tags, moves.name_*, characters.name_*, intel_items.title/summary_md への ILIKE + pg_trgm）
create extension if not exists pg_trgm;
-- gen_random_uuid() 用
create extension if not exists pgcrypto;

-- ============================================================
-- characters
-- ============================================================
create table characters (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name_ja        text not null,
  name_en        text not null,
  fighter_number integer,
  icon_url       text,
  is_main        boolean not null default false
);

-- ============================================================
-- moves
-- ============================================================
create table moves (
  id             uuid primary key default gen_random_uuid(),
  character_id   uuid not null references characters(id) on delete cascade,
  slug           text not null,
  name_en        text,
  name_ja        text,
  category       text not null check (category in ('jab','dash','tilt','smash','aerial','special','grab','throw','dodge')),
  startup        integer,
  active         text,        -- 持続Fは "5-7" 等の範囲表記があるため text
  faf            integer,     -- 全体F（First Actionable Frame）
  on_shield      integer,     -- ガード硬直差。負値=攻撃側不利
  damage         numeric,
  notes          text,
  hitbox_img_url text,
  unique (character_id, slug)
);
create index moves_character_id_idx on moves (character_id);

-- ============================================================
-- oos_options  （全キャラ分。実効発生 = moves.startup + extra_frames）
-- ============================================================
create table oos_options (
  id           uuid primary key default gen_random_uuid(),
  move_id      uuid not null references moves(id) on delete cascade,
  oos_type     text not null check (oos_type in ('aerial','up_b','up_smash','grab','shield_drop')),
  extra_frames integer not null,
  label        text,
  range_note   text
);
create index oos_options_move_id_idx on oos_options (move_id);

-- ============================================================
-- notes  （自分の考察。intel とは分離：ADR-0004）
-- ============================================================
create table notes (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('own_play','own_move','matchup','player')),
  character_id uuid references characters(id) on delete set null,  -- matchup/player時=相手キャラ, own時=NULL
  move_id      uuid references moves(id) on delete set null,        -- own_move時
  player_name  text,                                               -- player時
  title        text,
  body_md      text,
  section      text check (section in ('neutral','disadvantage','edgeguard','projectile','stage','tldr')),
  starred      boolean not null default false,
  pinned       boolean not null default false,  -- TL;DR用。キャラ対ページ冒頭に固定表示
  tags         text[] not null default '{}',
  source       text not null default 'manual' check (source in ('discord_import','manual','intel_adopted')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index notes_character_id_idx on notes (character_id);
create index notes_move_id_idx on notes (move_id);
create index notes_kind_idx on notes (kind);
-- 検索（pg_trgm）
create index notes_title_trgm_idx on notes using gin (title gin_trgm_ops);
create index notes_body_md_trgm_idx on notes using gin (body_md gin_trgm_ops);
create index notes_tags_idx on notes using gin (tags);

-- ============================================================
-- note_media
-- ============================================================
create table note_media (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references notes(id) on delete cascade,
  type         text not null check (type in ('image','youtube','local_video')),
  storage_path text,   -- image（Supabase Storage）用
  url          text,   -- youtube/local_video 用
  caption      text
);
create index note_media_note_id_idx on note_media (note_id);

-- ============================================================
-- sessions  （練習セッション: 目的設定→振り返り）
-- ============================================================
create table sessions (
  id       uuid primary key default gen_random_uuid(),
  date     date not null,
  goal     text,
  retro_md text
);

-- ============================================================
-- matches
-- ============================================================
create table matches (
  id                     uuid primary key default gen_random_uuid(),
  session_id             uuid references sessions(id) on delete set null,
  played_at              timestamptz,
  opponent_character_id  uuid references characters(id) on delete set null,
  result                 text check (result in ('win','lose')),
  stocks_diff            integer,
  video_url              text,   -- YouTube限定公開
  memo                   text,
  -- opponent/result は Gemini 推定を初期値(auto)とし、UIで訂正すると manual に。癖統計は訂正後の値を使う
  meta_source            text not null default 'auto' check (meta_source in ('auto','manual'))
);
create index matches_session_id_idx on matches (session_id);
create index matches_opponent_character_id_idx on matches (opponent_character_id);

-- ============================================================
-- ai_reviews
-- ============================================================
create table ai_reviews (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  model             text,
  status            text not null default 'pending' check (status in ('pending','done','error')),
  summary_md        text,
  -- findings: [{t_sec, situation, observation, suggestion, habit_tag, confidence,
  --             review_status(pending|accepted|rejected), clip_media_id}]
  --   findings は「候補」。承認/棄却を UI で操作し、癖統計は rejected 除外で集計（docs/04 #9）
  findings          jsonb not null default '[]'::jsonb,
  -- focus_evaluations: [{focus_point_id, verdict, evidence}]
  focus_evaluations jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);
create index ai_reviews_match_id_idx on ai_reviews (match_id);

-- ============================================================
-- focus_points  （「意識すること」。アクティブは 1〜3個に制限：docs/04 #10）
-- ============================================================
create table focus_points (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- habit_tags  （固定タクソノミ）
-- ============================================================
create table habit_tags (
  slug  text primary key,
  label text not null
);

-- ============================================================
-- intel_items  （外部収集。notes とは分離：ADR-0004）
-- ============================================================
create table intel_items (
  id              uuid primary key default gen_random_uuid(),
  character_id    uuid references characters(id) on delete set null,  -- NULL=汎用
  type            text not null check (type in ('article','video')),
  source_url      text not null,
  title           text,
  summary_md      text,
  fetched_at      timestamptz not null default now(),
  status          text not null default 'inbox' check (status in ('inbox','adopted','dismissed')),
  adopted_note_id uuid references notes(id) on delete set null
);
create index intel_items_character_id_idx on intel_items (character_id);
create index intel_items_status_idx on intel_items (status);
create index intel_items_title_trgm_idx on intel_items using gin (title gin_trgm_ops);
create index intel_items_summary_md_trgm_idx on intel_items using gin (summary_md gin_trgm_ops);

-- ============================================================
-- intel_requests  （オンデマンド深掘りのキュー：Web→ローカルの非同期連携）
-- ============================================================
create table intel_requests (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid references characters(id) on delete set null,
  query_hint   text,
  status       text not null default 'pending' check (status in ('pending','running','done','error')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
create index intel_requests_status_idx on intel_requests (status);

-- 検索用 trgm インデックス（characters / moves）
create index characters_name_ja_trgm_idx on characters using gin (name_ja gin_trgm_ops);
create index characters_name_en_trgm_idx on characters using gin (name_en gin_trgm_ops);
create index moves_name_ja_trgm_idx on moves using gin (name_ja gin_trgm_ops);
create index moves_name_en_trgm_idx on moves using gin (name_en gin_trgm_ops);

-- ============================================================
-- notes.updated_at 自動更新トリガ
-- ============================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notes_set_updated_at
  before update on notes
  for each row
  execute function set_updated_at();

-- ============================================================
-- RLS: 全テーブル authenticated ロールに全権（owner 列なし。docs/02 line 74）
-- ============================================================
do $$
declare
  t text;
  tbls text[] := array[
    'characters','moves','oos_options','notes','note_media','sessions',
    'matches','ai_reviews','focus_points','habit_tags','intel_items','intel_requests'
  ];
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
-- adopt_intel(): intel → notes の昇格。SECURITY DEFINER で 1トランザクション（ADR-0004）
--   mode = 'new_note'         … 新規ノート化（source=intel_adopted + 出典URL）
--   mode = 'append_proposal'  … 既存ノート(target_note_id)へ出典付き追記
--   いずれも intel_items.status='adopted' + adopted_note_id を設定
-- 返り値: 反映先 note の id
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

-- 認証ユーザーが RPC を呼べるように
grant execute on function adopt_intel(uuid, text, uuid) to authenticated;

-- ============================================================
-- habit_tags seed（固定語彙。docs/02 line 66）
-- ============================================================
insert into habit_tags (slug, label) values
  ('ledge_getup',   '崖上がり'),
  ('jump',          '飛び'),
  ('shield',        'ガード'),
  ('spacing_move',  '置き技'),
  ('edgeguard',     '復帰阻止'),
  ('landing',       '着地'),
  ('throw_mixup',   '投げ択'),
  ('op_management', 'OP管理'),
  ('recovery',      '復帰'),
  ('neutral',       'ニュートラル'),
  ('dash_dance',    'ダッシュ管理'),
  ('tech_chase',    '受け身狩り')
on conflict (slug) do nothing;

commit;
