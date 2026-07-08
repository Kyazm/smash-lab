// AI試合レビュー詳細ページ「/review/:reviewId」（docs/13_match-review.md ②画面仕様）。
// オーナー専用（Macパイプライン依存・ADR-0019）。ゲストはガード文言のみ表示し、
// useReview 等のフックは owner 側の別コンポーネントでのみ呼ぶ（条件付きフック呼び出しを避ける）。
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useIsGuest } from "../lib/guestContext";
import { useReview } from "../hooks/useReviews";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { parseYouTube } from "../lib/youtube";
import { renderMarkdown } from "../lib/markdown";
import { BrandMark } from "../components/BrandMark";
import { FindingCard } from "../components/review/FindingCard";
import { updateFindingStatus, StaleReviewError } from "../data/review/reviewApi";
import type { FocusVerdict } from "../data/review/types";

const FOCUS_VERDICT_LABELS: Record<FocusVerdict, string> = {
  achieved: "達成",
  partial: "部分的",
  not_achieved: "未達成",
  not_observable: "観測不可",
};

const STALL_MS = 60 * 60 * 1000;

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="flex items-center justify-between">
        <BrandMark size="sm" />
        <Link to="/review" className="text-xs text-ink-muted hover:text-ink-primary">
          ← レビュー一覧
        </Link>
      </div>
      {children}
    </div>
  );
}

export function ReviewDetailPage() {
  const isGuest = useIsGuest();
  const { reviewId } = useParams<{ reviewId: string }>();
  return isGuest ? (
    <PageShell>
      <p className="mt-3 text-sm text-ink-secondary">オーナー専用機能。ゲストでは利用できません。</p>
    </PageShell>
  ) : (
    <ReviewDetailPageOwner reviewId={reviewId ?? ""} />
  );
}

function ReviewDetailPageOwner({ reviewId }: { reviewId: string }) {
  const { review, error, reload } = useReview(reviewId);
  const [actionError, setActionError] = useState<string | null>(null);

  const videoId = useMemo(() => {
    if (!review?.match.video_url) return null;
    return parseYouTube(review.match.video_url)?.videoId ?? null;
  }, [review]);

  const elementId = `yt-player-${reviewId}`;
  const player = useYouTubePlayer(elementId, videoId);

  const handleSeek = (t_sec: number) => {
    player?.seekTo(t_sec, true);
    player?.playVideo();
  };

  const handleStatusChange = async (findingId: string, status: "accepted" | "rejected") => {
    if (!review) return;
    setActionError(null);
    try {
      await updateFindingStatus(review.id, findingId, status, review.updated_at);
      await reload();
    } catch (e) {
      if (e instanceof StaleReviewError) {
        setActionError("他の場所で更新されています。再取得します");
        await reload();
      } else {
        setActionError(e instanceof Error ? e.message : String(e));
      }
    }
  };

  return (
    <PageShell>
      <div className="sticky top-0 z-20 -mx-4 bg-surface-0 px-4 pb-3">
        <div id={elementId} className="aspect-video w-full" />
      </div>

      {error ? <p className="mt-3 text-sm text-danger">読み込みエラー: {error}</p> : null}

      {review === undefined ? (
        <p className="mt-4 text-sm text-ink-muted">読み込み中…</p>
      ) : review === null ? (
        <p className="mt-4 text-sm text-ink-muted">レビューが見つかりません。</p>
      ) : (
        <div className="mt-3 space-y-4">
          {review.status === "error" ? (
            <div className="rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {review.error_message ?? "処理中にエラーが発生しました。"}
            </div>
          ) : null}
          {review.status === "processing" &&
          Date.now() - new Date(review.updated_at).getTime() > STALL_MS ? (
            <div className="rounded border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              停滞中の可能性があります。Mac側で `--retry-stale` を実行してください。
            </div>
          ) : null}
          {review.status === "pending" || review.status === "processing" ? (
            <div className="rounded border border-info/40 bg-info/10 p-3 text-sm text-info">
              {review.status === "pending" ? "Macでの処理待ちです。" : "Macで処理中です。"}
            </div>
          ) : null}

          {actionError ? <p className="text-sm text-danger">{actionError}</p> : null}

          {review.one_mistake ? (
            <div className="rounded border-2 border-action bg-action/5 p-3">
              <p className="text-xs font-semibold text-action-strong">今回直す1点</p>
              <p className="mt-1 text-sm text-ink-primary">{review.one_mistake}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            {[...review.findings]
              .sort((a, b) => a.t_sec - b.t_sec)
              .map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  videoId={videoId}
                  onSeek={handleSeek}
                  onStatusChange={handleStatusChange}
                />
              ))}
          </div>

          {review.summary_md ? (
            <div className="rounded border border-border-subtle bg-surface-1 p-3">
              {renderMarkdown(review.summary_md)}
            </div>
          ) : null}

          {review.focus_evaluations.length > 0 ? (
            <div className="rounded border border-border-subtle bg-surface-1 p-3">
              <p className="text-xs font-semibold text-ink-secondary">意識ポイントの評価</p>
              <ul className="mt-2 space-y-2">
                {review.focus_evaluations.map((fe) => (
                  <li key={fe.focus_point_id} className="text-sm text-ink-secondary">
                    <span className="font-medium text-ink-primary">{fe.focus_point_id}</span>
                    <span className="ml-2 text-xs text-ink-muted">{FOCUS_VERDICT_LABELS[fe.verdict]}</span>
                    <p className="mt-0.5 text-xs text-ink-muted">{fe.evidence}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
