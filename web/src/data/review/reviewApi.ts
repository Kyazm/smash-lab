// AI試合レビューの直接Supabaseアクセス（docs/13_match-review.md ②機能設計・JSONスキーマ契約）。
// オーナー専用機能（Macパイプライン依存・ADR-0019）のため switchable/guestSwitch には乗せず、
// getSupabaseClient() を無条件に呼ぶ（ゲスト用サンドボックス実装を作る価値がないため）。
import { getSupabaseClient } from "../supabaseClient";
import type { MatchMode, MatchOutcome } from "../match/types";
import type {
  Finding,
  FocusEvaluation,
  MatchMeta,
  RequestedTimestamp,
  ReviewFindingStatus,
  ReviewListItem,
  ReviewStatus,
} from "./types";

const REVIEW_SELECT = "*, match:matches(video_url,opponent_character_id,mode,result,memo)";

interface MatchRow {
  video_url: string | null;
  opponent_character_id: string | null;
  mode: MatchMode | null;
  result: MatchOutcome | null;
  memo: string | null;
}

interface AiReviewRow {
  id: string;
  match_id: string;
  status: ReviewStatus;
  requested_timestamps: RequestedTimestamp[];
  findings: Finding[];
  summary_md: string | null;
  one_mistake: string | null;
  focus_evaluations: FocusEvaluation[];
  error_message: string | null;
  created_at: string;
  updated_at: string;
  match: MatchRow | null;
}

// row -> ReviewListItem マッピング（snake_case のまま保持する契約なのでフィールド変換は最小限）
function toReviewListItem(row: AiReviewRow): ReviewListItem {
  const match: MatchMeta = row.match
    ? {
        video_url: row.match.video_url,
        opponent_character_id: row.match.opponent_character_id,
        mode: row.match.mode,
        result: row.match.result,
        memo: row.match.memo,
      }
    : { video_url: null, opponent_character_id: null, mode: null, result: null, memo: null };

  return {
    id: row.id,
    match_id: row.match_id,
    status: row.status,
    requested_timestamps: row.requested_timestamps,
    findings: row.findings,
    summary_md: row.summary_md,
    one_mistake: row.one_mistake,
    focus_evaluations: row.focus_evaluations,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
    match,
  };
}

export async function listReviews(): Promise<ReviewListItem[]> {
  const { data, error } = await getSupabaseClient()
    .from("ai_reviews")
    .select(REVIEW_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => toReviewListItem(r as AiReviewRow));
}

export async function getReview(id: string): Promise<ReviewListItem | null> {
  const { data, error } = await getSupabaseClient()
    .from("ai_reviews")
    .select(REVIEW_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toReviewListItem(data as AiReviewRow) : null;
}

export interface CreateReviewRequestInput {
  videoUrl: string;
  timestamps: RequestedTimestamp[];
  opponentCharacterId: string;
  mode: MatchMode;
  result: MatchOutcome;
  memo: string | null;
}

export async function createReviewRequest(input: CreateReviewRequestInput): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc("create_review_request", {
    p_video_url: input.videoUrl,
    p_timestamps: input.timestamps,
    p_opponent_character_id: input.opponentCharacterId,
    p_mode: input.mode,
    p_result: input.result,
    p_memo: input.memo,
  });
  if (error) throw error;
  return data as string;
}

export class StaleReviewError extends Error {
  constructor() {
    super("findings has been updated elsewhere. reload and retry.");
    this.name = "StaleReviewError";
  }
}

/** findings配列中の対象idのreview_statusを書き換える純関数（テスト対象）。id不在ならthrow。 */
export function applyFindingStatus(
  findings: Finding[],
  findingId: string,
  status: ReviewFindingStatus,
): Finding[] {
  const idx = findings.findIndex((f) => f.id === findingId);
  if (idx === -1) throw new Error(`finding not found: ${findingId}`);
  const next = [...findings];
  next[idx] = { ...next[idx], review_status: status };
  return next;
}

interface FindingsRow {
  findings: Finding[];
}

export async function updateFindingStatus(
  reviewId: string,
  findingId: string,
  status: ReviewFindingStatus,
  expectedUpdatedAt: string,
): Promise<void> {
  const client = getSupabaseClient();
  const { data: current, error: fetchError } = await client
    .from("ai_reviews")
    .select("findings")
    .eq("id", reviewId)
    .single();
  if (fetchError) throw fetchError;
  const nextFindings = applyFindingStatus((current as FindingsRow).findings, findingId, status);
  const { data: updated, error: updateError } = await client
    .from("ai_reviews")
    .update({ findings: nextFindings })
    .eq("id", reviewId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id");
  if (updateError) throw updateError;
  if (!updated || updated.length === 0) throw new StaleReviewError();
}
