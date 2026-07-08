// AI試合レビュー一覧・詳細の購読フック（useProposals.ts の規約: 手動reload、error: string|null）。
// docs/13_match-review.md ②画面仕様: /review 一覧・/review/:id で使用する。
import { useCallback, useEffect, useState } from "react";
import { getReview, listReviews } from "../data/review/reviewApi";
import type { ReviewListItem } from "../data/review/types";

export interface UseReviewsResult {
  reviews: ReviewListItem[] | null;
  error: string | null;
  reload: () => Promise<void>;
}

export function useReviews(): UseReviewsResult {
  const [reviews, setReviews] = useState<ReviewListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const list = await listReviews();
      setReviews(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReviews([]);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { reviews, error, reload };
}

export interface UseReviewResult {
  /** undefined=読込中、null=見つからない/取得失敗 */
  review: ReviewListItem | null | undefined;
  error: string | null;
  reload: () => Promise<void>;
}

export function useReview(reviewId: string): UseReviewResult {
  const [review, setReview] = useState<ReviewListItem | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const r = await getReview(reviewId);
      setReview(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReview(null);
    }
  }, [reviewId]);

  useEffect(() => {
    setReview(undefined);
    reload();
  }, [reload]);

  return { review, error, reload };
}
