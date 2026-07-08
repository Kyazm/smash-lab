// findingカード（docs/13_match-review.md ②画面仕様: situation/habit_tagバッジ、observation/suggestion、
// mistake_type、死亡時はdeath情報〈stock/kill_move/initiating_action〉、場面ジャンプ、承認/棄却）。
import { useState } from "react";
import { formatTimeDisplay } from "../../lib/youtube";
import { HABIT_TAG_LABELS, SITUATION_LABELS, MISTAKE_TYPE_LABELS } from "../../data/review/types";
import type { Finding } from "../../data/review/types";

interface Props {
  finding: Finding;
  videoId: string | null;
  onSeek: (t_sec: number) => void;
  onStatusChange: (findingId: string, status: "accepted" | "rejected") => Promise<void>;
}

export function FindingCard({ finding, videoId, onSeek, onStatusChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const habitLabel = finding.habit_tag ? (HABIT_TAG_LABELS[finding.habit_tag] ?? finding.habit_tag) : "未分類";

  const handleStatus = async (status: "accepted" | "rejected") => {
    setBusy(true);
    setError(null);
    try {
      await onStatusChange(finding.id, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border border-border-subtle bg-surface-1 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">
          {SITUATION_LABELS[finding.situation]}
        </span>
        <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">{habitLabel}</span>
        {finding.needsReview ? (
          <span className="rounded bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">要確認</span>
        ) : null}
        <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">
          {MISTAKE_TYPE_LABELS[finding.mistake_type]}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink-primary">{finding.observation}</p>
      <p className="mt-2 border-l-2 border-action pl-2 text-sm text-ink-secondary">{finding.suggestion}</p>

      {finding.death ? (
        <div className="mt-2 rounded border border-danger/40 bg-danger/5 p-2 text-xs text-ink-secondary">
          <p className="font-semibold text-danger">撃墜情報（{finding.death.stock}ストック目）</p>
          <p className="mt-1">技: {finding.death.kill_move}</p>
          <p>起点行動: {finding.death.initiating_action}</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSeek(finding.t_sec)}
          className="min-h-9 rounded bg-surface-2 px-3 text-xs font-medium text-ink-secondary hover:text-ink-primary"
        >
          ▶ 場面へ（{formatTimeDisplay(finding.t_sec)}）
        </button>
        {videoId ? (
          <a
            href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(finding.t_sec)}s`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-action-strong underline decoration-action/40 hover:decoration-action-strong"
          >
            YouTubeで開く
          </a>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      <div className="mt-3">
        {finding.review_status === "pending" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleStatus("accepted")}
              disabled={busy}
              className="min-h-9 rounded bg-action px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              承認
            </button>
            <button
              type="button"
              onClick={() => handleStatus("rejected")}
              disabled={busy}
              className="min-h-9 rounded bg-surface-2 px-3 py-1 text-xs font-medium text-ink-secondary disabled:opacity-50"
            >
              棄却
            </button>
          </div>
        ) : (
          <span className="text-xs text-ink-muted">
            {finding.review_status === "accepted" ? "承認済み" : "棄却済み"}
          </span>
        )}
      </div>
    </div>
  );
}
