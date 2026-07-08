// ai_reviews.status バッジ（docs/13_match-review.md ②画面仕様: pending/processing/done/errorの状態表示）。
// processing が1時間超で「停滞の可能性」を表示する（docs/13 ②冪等性: --retry-stale の対象）。
import type { ReviewStatus } from "../../data/review/types";

const STALL_MS = 60 * 60 * 1000;

interface Props {
  status: ReviewStatus;
  updatedAt: string;
}

export function ReviewStatusBadge({ status, updatedAt }: Props) {
  const stalled = status === "processing" && Date.now() - new Date(updatedAt).getTime() > STALL_MS;

  let className = "bg-surface-2 text-ink-secondary";
  let label = "Macで処理待ち";
  if (status === "processing") {
    className = stalled ? "bg-warning/15 text-warning" : "bg-info/15 text-info";
    label = stalled ? "処理中（停滞の可能性）" : "処理中";
  } else if (status === "done") {
    className = "bg-action/15 text-action-strong";
    label = "完了";
  } else if (status === "error") {
    className = "bg-danger/15 text-danger";
    label = "エラー";
  }

  return (
    <span className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
