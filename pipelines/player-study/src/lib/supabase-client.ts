// Supabase PostgREST 直叩き（service role, RLSバイパス）+ Storage 直PUT。SDK 不使用。
// review-match/src/lib/supabase-client.ts と同流儀。study_videos / study_interactions（migration 0011）と
// note-media バケット study/ プレフィックス（ADR-0012 / ADR-0020）を扱う。
import { STORAGE_BUCKET, STORAGE_PREFIX } from "../config.js";

export interface SupabaseConfig {
  url: string; // 例: https://xxxx.supabase.co
  serviceRoleKey: string;
}

export interface StudyVideoRow {
  id: string;
  video_id: string;
  source: string | null;
  title: string | null;
  tournament: string | null;
  round: string | null;
  studied_player: string | null;
  studied_char: string | null;
  opp_player: string | null;
  opp_chars_hint: string[] | null;
  played_on: string | null;
  status: string;
  needs_review: boolean | null;
  error_message: string | null;
  created_at: string;
}

export interface StudyVideoInsert {
  video_id: string;
  source: string;
  title: string;
  tournament: string | null;
  round: string | null;
  studied_player: string;
  studied_char: string;
  opp_player: string | null;
  opp_chars_hint: string[];
  played_on: string | null;
  needs_review: boolean;
  status: "cataloged";
}

export interface StudyInteractionInsert {
  video_ref: string;
  game_index: number;
  t_sec: number;
  opp_char: string;
  situation: string;
  sub_situation: string | null;
  action: string;
  action_detail: string | null;
  outcome: string;
  kill: boolean;
  confidence: number;
  frame_path: string;
  line: string | null;
  note: string | null;
}

const VIDEO_SELECT =
  "select=id,video_id,source,title,tournament,round,studied_player,studied_char," +
  "opp_player,opp_chars_hint,played_on,status,needs_review,error_message,created_at";

function headers(cfg: SupabaseConfig, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: cfg.serviceRoleKey,
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function assertOk(res: Response, label: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${label} failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`);
  }
}

/**
 * study_videos へ collect 結果を投入する。video_id 重複は on_conflict で無視
 * （Prefer: resolution=ignore-duplicates）。返り値は実際に挿入された行（重複はスキップ）。
 */
export async function insertCatalog(
  cfg: SupabaseConfig,
  rows: StudyVideoInsert[],
): Promise<StudyVideoRow[]> {
  if (rows.length === 0) return [];
  const url = `${cfg.url}/rest/v1/study_videos?on_conflict=video_id&${VIDEO_SELECT}`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(cfg, { Prefer: "resolution=ignore-duplicates,return=representation" }),
    body: JSON.stringify(rows),
  });
  await assertOk(res, "insertCatalog");
  return (await res.json()) as StudyVideoRow[];
}

/** status=cataloged の最古1件を取得（--next 用）。 */
export async function fetchOldestCataloged(cfg: SupabaseConfig): Promise<StudyVideoRow | null> {
  const url =
    `${cfg.url}/rest/v1/study_videos?status=eq.cataloged&${VIDEO_SELECT}` +
    `&order=created_at.asc&limit=1`;
  const res = await fetch(url, { headers: headers(cfg) });
  await assertOk(res, "fetchOldestCataloged");
  const rows = (await res.json()) as StudyVideoRow[];
  return rows[0] ?? null;
}

/** video_id で study_videos 1件を取得。 */
export async function fetchStudyVideo(
  cfg: SupabaseConfig,
  videoId: string,
): Promise<StudyVideoRow | null> {
  const url = `${cfg.url}/rest/v1/study_videos?video_id=eq.${encodeURIComponent(videoId)}&${VIDEO_SELECT}`;
  const res = await fetch(url, { headers: headers(cfg) });
  await assertOk(res, "fetchStudyVideo");
  const rows = (await res.json()) as StudyVideoRow[];
  return rows[0] ?? null;
}

async function patchStatus(
  cfg: SupabaseConfig,
  videoId: string,
  patch: Record<string, unknown>,
  label: string,
): Promise<StudyVideoRow> {
  const url = `${cfg.url}/rest/v1/study_videos?video_id=eq.${encodeURIComponent(videoId)}&${VIDEO_SELECT}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(cfg, { Prefer: "return=representation" }),
    body: JSON.stringify(patch),
  });
  await assertOk(res, label);
  const rows = (await res.json()) as StudyVideoRow[];
  if (rows.length === 0) throw new Error(`${label}: video_id=${videoId} の行が見つかりません`);
  return rows[0];
}

/** prep 完了 → status=prepped。 */
export function markPrepped(cfg: SupabaseConfig, videoId: string): Promise<StudyVideoRow> {
  return patchStatus(cfg, videoId, { status: "prepped", error_message: null }, "markPrepped");
}

/** submit 完了 → status=done。 */
export function markDone(cfg: SupabaseConfig, videoId: string): Promise<StudyVideoRow> {
  return patchStatus(cfg, videoId, { status: "done", error_message: null }, "markDone");
}

/** fail → status=error + error_message。作業Dirは呼び出し側で残す。 */
export function failVideo(
  cfg: SupabaseConfig,
  videoId: string,
  message: string,
): Promise<StudyVideoRow> {
  return patchStatus(cfg, videoId, { status: "error", error_message: message }, "failVideo");
}

/** study_interactions へ一括 INSERT。 */
export async function insertInteractions(
  cfg: SupabaseConfig,
  rows: StudyInteractionInsert[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const url = `${cfg.url}/rest/v1/study_interactions`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(cfg, { Prefer: "return=minimal" }),
    body: JSON.stringify(rows),
  });
  await assertOk(res, "insertInteractions");
  return rows.length;
}

/** 代表フレームを note-media/study/<videoId>/<n>.jpg へ PUT（service role, x-upsert）。返り値は object path。 */
export async function uploadFrame(
  cfg: SupabaseConfig,
  videoId: string,
  n: number,
  bytes: Uint8Array,
): Promise<string> {
  const objectPath = `${STORAGE_PREFIX}/${videoId}/${n}.jpg`;
  const url = `${cfg.url}/storage/v1/object/${STORAGE_BUCKET}/${objectPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: cfg.serviceRoleKey,
      Authorization: `Bearer ${cfg.serviceRoleKey}`,
      "Content-Type": "image/jpeg",
      "x-upsert": "true",
    },
    body: bytes,
  });
  await assertOk(res, "uploadFrame");
  return objectPath;
}
