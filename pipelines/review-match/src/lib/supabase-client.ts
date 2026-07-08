// Supabase PostgREST 直叩きクライアント（service role キー、RLSバイパス）。
// restructure-notes/src/lib/supabase-client.ts と同流儀。SDK 不使用。
// claim は条件付き PATCH（&status=eq.<expected>）で競合安全にする。

export interface SupabaseConfig {
  url: string; // 例: https://xxxx.supabase.co
  serviceRoleKey: string;
}

export interface MatchRow {
  id: string;
  user_id: string;
  opponent_character_id: string | null;
  result: string | null;
  video_url: string | null;
  memo: string | null;
  mode: string | null;
  meta_source: string | null;
}

export interface ReviewRow {
  id: string;
  match_id: string;
  user_id: string;
  status: string;
  model: string | null;
  requested_timestamps: Array<{ t_sec: number; label?: string }>;
  created_at: string;
  updated_at: string;
  match: MatchRow | null;
}

export interface FocusPointRow {
  id: string;
  body: string;
  category: string;
}

export interface HabitTagRow {
  slug: string;
  label: string;
}

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

const REVIEW_SELECT =
  "select=id,match_id,user_id,status,model,requested_timestamps,created_at,updated_at," +
  "match:matches(id,user_id,opponent_character_id,result,video_url,memo,mode,meta_source)";

/** status（既定 pending）でレビュー行を古い順に取得。stale 用に updated_at 上限も指定可。 */
export async function fetchReviewsByStatus(
  cfg: SupabaseConfig,
  status: string,
  staleBeforeIso?: string,
): Promise<ReviewRow[]> {
  let url = `${cfg.url}/rest/v1/ai_reviews?status=eq.${status}&${REVIEW_SELECT}&order=created_at.asc`;
  if (staleBeforeIso) {
    url += `&updated_at=lt.${encodeURIComponent(staleBeforeIso)}`;
  }
  const res = await fetch(url, { headers: headers(cfg) });
  await assertOk(res, "fetchReviewsByStatus");
  return (await res.json()) as ReviewRow[];
}

/** pending レビュー（キューの通常経路）。 */
export function fetchPendingReviews(cfg: SupabaseConfig): Promise<ReviewRow[]> {
  return fetchReviewsByStatus(cfg, "pending");
}

export async function fetchCharacterName(cfg: SupabaseConfig, id: string): Promise<string | null> {
  const url = `${cfg.url}/rest/v1/characters?id=eq.${id}&select=name_ja,name_en`;
  const res = await fetch(url, { headers: headers(cfg) });
  await assertOk(res, "fetchCharacterName");
  const rows = (await res.json()) as Array<{ name_ja: string; name_en: string }>;
  return rows[0]?.name_ja ?? rows[0]?.name_en ?? null;
}

/** active な focus_points を user_id で絞って取得（user_id フィルタ必須）。 */
export async function fetchActiveFocusPoints(
  cfg: SupabaseConfig,
  userId: string,
): Promise<FocusPointRow[]> {
  const url =
    `${cfg.url}/rest/v1/focus_points?user_id=eq.${userId}&active=eq.true` +
    `&select=id,body,category&order=created_at.asc`;
  const res = await fetch(url, { headers: headers(cfg) });
  await assertOk(res, "fetchActiveFocusPoints");
  return (await res.json()) as FocusPointRow[];
}

/** habit_tags 語彙（15語）を取得。 */
export async function fetchHabitTags(cfg: SupabaseConfig): Promise<HabitTagRow[]> {
  const url = `${cfg.url}/rest/v1/habit_tags?select=slug,label&order=slug.asc`;
  const res = await fetch(url, { headers: headers(cfg) });
  await assertOk(res, "fetchHabitTags");
  return (await res.json()) as HabitTagRow[];
}

/**
 * レビューを processing へ遷移させて claim する（条件付き PATCH で競合安全）。
 * @param expectedStatus 現在の想定 status（pending / error / processing）。この行のみ更新される。
 * @returns claim できた行。他プロセスに取られていた等で0件なら null。
 */
export async function claimReview(
  cfg: SupabaseConfig,
  id: string,
  expectedStatus: string,
): Promise<ReviewRow | null> {
  const url =
    `${cfg.url}/rest/v1/ai_reviews?id=eq.${id}&status=eq.${expectedStatus}&${REVIEW_SELECT}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(cfg, { Prefer: "return=representation" }),
    body: JSON.stringify({ status: "processing", error_message: null }),
  });
  await assertOk(res, "claimReview");
  const rows = (await res.json()) as ReviewRow[];
  return rows[0] ?? null;
}

export interface CompletePayload {
  findings: unknown;
  summary_md: string;
  one_mistake: string;
  focus_evaluations: unknown;
}

/** レビューを done で確定する。返り値で status 遷移を確認。 */
export async function completeReview(
  cfg: SupabaseConfig,
  id: string,
  payload: CompletePayload,
): Promise<ReviewRow> {
  const url = `${cfg.url}/rest/v1/ai_reviews?id=eq.${id}&${REVIEW_SELECT}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(cfg, { Prefer: "return=representation" }),
    body: JSON.stringify({
      status: "done",
      findings: payload.findings,
      summary_md: payload.summary_md,
      one_mistake: payload.one_mistake,
      focus_evaluations: payload.focus_evaluations,
      error_message: null,
    }),
  });
  await assertOk(res, "completeReview");
  const rows = (await res.json()) as ReviewRow[];
  if (rows.length === 0) {
    throw new Error(`completeReview: id=${id} の行が見つかりません（既に削除/別状態?）`);
  }
  return rows[0];
}

/** レビューを error に戻す（error_message 付き）。作業ディレクトリは呼び出し側で残す。 */
export async function failReview(
  cfg: SupabaseConfig,
  id: string,
  message: string,
): Promise<ReviewRow> {
  const url = `${cfg.url}/rest/v1/ai_reviews?id=eq.${id}&${REVIEW_SELECT}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(cfg, { Prefer: "return=representation" }),
    body: JSON.stringify({ status: "error", error_message: message }),
  });
  await assertOk(res, "failReview");
  const rows = (await res.json()) as ReviewRow[];
  if (rows.length === 0) {
    throw new Error(`failReview: id=${id} の行が見つかりません`);
  }
  return rows[0];
}
