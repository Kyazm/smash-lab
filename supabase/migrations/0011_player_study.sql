-- 0011: プレイヤー研究（player-study）— トッププレイヤーの試合動画から場面別の行動統計を蓄積する。ADR-0020。
-- study_videos = 収集した試合動画のカタログ（1動画=1セット・status で収集〜ラベリング完了まで追跡）。
-- study_interactions = 場面ごとに目視ラベル付けした行動1件（代表フレーム1枚 + YouTube t_sec 根拠付き）。
-- RLS: 単一オーナーの研究データのため is_writer()（0005 定義, OWNER_UID 限定）で全操作を限定。
--   SELECT もオーナーのみ可視（0010 の user_id 系 per-user 分離はゲスト sandbox 要件のためであり本件は非該当）。
--   実書込は service role が RLS をバイパスして行う（0005 note-media と同じ運用・設計 §データモデル）。
-- Storage: 専用バケットは作らない。代表フレームは既存 note-media バケットの study/ プレフィックスに流用する
--   （ADR-0020。note-media の public-read 受容は ADR-0012 準拠）。
-- 前提: is_writer()=0005:17、set_updated_at()=0001:207、gen_random_uuid()（pgcrypto）=0001 で定義済み。

begin;

-- ============================================================
-- study_videos: 研究対象の試合動画カタログ（collect で INSERT、prep/labeling/submit で status 遷移）
-- ============================================================
create table study_videos (
  id             uuid primary key default gen_random_uuid(),
  video_id       text not null unique,
  source         text not null default 'smash-tube',
  title          text,
  tournament     text,
  round          text,
  studied_player text not null,
  studied_char   text not null,
  opp_player     text,
  opp_chars_hint text[],                          -- タイトルパース由来のヒント（確定はラベル時の opp_char）
  played_on      date,
  status         text not null default 'cataloged'
                   check (status in ('cataloged','prepped','labeling','done','error','skipped')),
  needs_review   boolean not null default false,  -- 複数キャラ/不明カード等、目視確認が要るカタログに立てる
  error_message  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index study_videos_status_idx on study_videos (status);

-- updated_at 自動更新（既存 set_updated_at()（0001:207）を張る）
create trigger study_videos_set_updated_at
  before update on study_videos
  for each row
  execute function set_updated_at();

-- ============================================================
-- study_interactions: 場面ごとにラベル付けした行動1件。集計は video_ref JOIN でのクライアント集計前提
-- ============================================================
create table study_interactions (
  id            uuid primary key default gen_random_uuid(),
  video_ref     uuid not null references study_videos(id) on delete cascade,
  game_index    int not null default 1,
  t_sec         numeric not null,
  opp_char      text,                             -- ゲーム単位・ラベル時に目視確定（カウンターピック対応）
  situation     text not null
                   check (situation in ('neutral','advantage','disadvantage',
                                        'ledge_offense','ledge_defense','landing',
                                        'edgeguard','recovery','kill_confirm')),
  sub_situation text,                             -- 崖=正準6分類+2フレ 等
  action        text not null,                    -- 行動辞書slug（docs/14 で凍結）
  action_detail text,
  outcome       text not null check (outcome in ('won','lost','even')),
  kill          boolean not null default false,
  confidence    numeric check (confidence >= 0 and confidence <= 1),
  frame_path    text,                             -- note-media バケット study/ プレフィックスの代表フレーム
  note          text,
  created_at    timestamptz not null default now()
);
create index study_interactions_video_ref_idx on study_interactions (video_ref);

-- ============================================================
-- RLS: 両テーブル owner 専用。is_writer() で select/insert/update/delete を全て限定
--   （0005 notes 系ポリシー書式に準拠。ただし SELECT はオーナーのみ可視のため using(true) ではなく is_writer()）。
-- ============================================================
alter table study_videos enable row level security;
alter table study_videos force row level security;
alter table study_interactions enable row level security;
alter table study_interactions force row level security;

create policy study_videos_select_writer on study_videos
  for select to authenticated using (public.is_writer());
create policy study_videos_insert_writer on study_videos
  for insert to authenticated with check (public.is_writer());
create policy study_videos_update_writer on study_videos
  for update to authenticated
  using (public.is_writer()) with check (public.is_writer());
create policy study_videos_delete_writer on study_videos
  for delete to authenticated using (public.is_writer());

create policy study_interactions_select_writer on study_interactions
  for select to authenticated using (public.is_writer());
create policy study_interactions_insert_writer on study_interactions
  for insert to authenticated with check (public.is_writer());
create policy study_interactions_update_writer on study_interactions
  for update to authenticated
  using (public.is_writer()) with check (public.is_writer());
create policy study_interactions_delete_writer on study_interactions
  for delete to authenticated using (public.is_writer());

commit;
