// プレイヤー研究データの直接Supabaseアクセス（docs/14_player-study.md ⑪統計表示）。
// オーナー専用機能（0011_player_study.sql の RLS が select も is_writer() 限定）のため
// switchable/guestSwitch には乗せず getSupabaseClient() を無条件に呼ぶ（reviewApi.ts と同じ判断）。
//
// JOINはクライアント側で行う（0011 のコメント「集計は video_ref JOIN でのクライアント集計前提」）。
// PostgREST の埋め込みリソースを使わないのは、interactions 側から見た N:1 埋め込みだと
// 動画メタが行ごとに複製されて転送量が増えるため（動画は数十件・interactionは数千件想定）。
import { getSupabaseClient, NOTE_MEDIA_BUCKET } from "../supabaseClient";
import type {
  StudyDataset,
  StudyInteraction,
  StudyInteractionWithVideo,
  StudyVideo,
} from "./types";

const VIDEO_COLUMNS =
  "id,video_id,title,tournament,round,studied_player,studied_char,opp_player,played_on,status,needs_review";

const INTERACTION_COLUMNS =
  "id,video_ref,game_index,t_sec,opp_char,situation,sub_situation,action,action_detail,outcome,kill,confidence,frame_path,note,created_at";

/**
 * ラベリング完了（status='done'）の動画と、その interaction 全件を取得してクライアントJOINする。
 * done 以外の動画に紐づく interaction は統計に混ぜない（途中まで貼られた行で分母が歪むため）。
 */
export async function fetchStudyDataset(): Promise<StudyDataset> {
  const sb = getSupabaseClient();

  const { data: videoRows, error: videoError } = await sb
    .from("study_videos")
    .select(VIDEO_COLUMNS)
    .eq("status", "done")
    .order("played_on", { ascending: false, nullsFirst: false });
  if (videoError) throw videoError;

  const videos = (videoRows ?? []) as StudyVideo[];
  const videoById = new Map(videos.map((v) => [v.id, v]));

  // interaction は video_ref で絞らず全件取り、done動画に紐づくものだけ残す
  // （動画数が増えても .in() の URL 長制限に当たらないようにするため）。
  // PostgREST は1リクエスト最大1000行のため range でページングする（超過分のサイレント切り捨て防止）。
  const PAGE = 1000;
  const rows: StudyInteraction[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: rowError } = await sb
      .from("study_interactions")
      .select(INTERACTION_COLUMNS)
      .order("t_sec", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (rowError) throw rowError;
    rows.push(...((page ?? []) as StudyInteraction[]));
    if (!page || page.length < PAGE) break;
  }

  const interactions: StudyInteractionWithVideo[] = [];
  for (const raw of rows) {
    const video = videoById.get(raw.video_ref);
    if (!video) continue;
    // numeric列（t_sec/confidence）は supabase-js が number で返すが、
    // 精度によっては文字列で来る可能性があるため取り込み時に正規化する。
    interactions.push({
      ...raw,
      t_sec: Number(raw.t_sec),
      confidence: raw.confidence == null ? null : Number(raw.confidence),
      video,
    });
  }

  return { videos, interactions };
}

/**
 * 代表フレームの公開URL。frame_path は note-media バケットの object path（例 study/<video_id>/1.jpg）。
 * SupabaseNotesProvider.resolveImageUrl と同じバケット定数・同じ getPublicUrl を使う。
 */
export function resolveFrameUrl(framePath: string | null): string | null {
  if (!framePath) return null;
  const { data } = getSupabaseClient().storage.from(NOTE_MEDIA_BUCKET).getPublicUrl(framePath);
  return data.publicUrl;
}
