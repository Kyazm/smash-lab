// AI試合レビュー申請フォーム（docs/13_match-review.md ②画面仕様: /review フォーム）。
// YouTube URL・タイムスタンプ複数・相手キャラ・勝敗・モード・メモを入力し、
// create_review_request RPC 経由で matches + ai_reviews(pending) を1トランザクションで作成する。
import { useState } from "react";
import { parseYouTube, parseFlexibleTime, formatTimeDisplay } from "../../lib/youtube";
import { createReviewRequest } from "../../data/review/reviewApi";
import type { RequestedTimestamp } from "../../data/review/types";
import { MATCH_MODES, MATCH_MODE_LABELS } from "../../data/match/types";
import type { MatchMode, MatchOutcome } from "../../data/match/types";
import { useMatchMode } from "../../lib/matchModeContext";
import { OpponentCharacterSelect } from "./OpponentCharacterSelect";

interface Props {
  onCreated: () => void;
}

export function ReviewRequestForm({ onCreated }: Props) {
  const { mode: currentMatchMode } = useMatchMode();

  const [videoUrl, setVideoUrl] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [timeInputNotice, setTimeInputNotice] = useState<string | null>(null);
  const [timestamps, setTimestamps] = useState<RequestedTimestamp[]>([]);
  const [opponentCharacterId, setOpponentCharacterId] = useState<string | null>(null);
  const [result, setResult] = useState<MatchOutcome | null>(null);
  const [mode, setMode] = useState<MatchMode>(currentMatchMode);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parsedVideo = videoUrl.trim() === "" ? null : parseYouTube(videoUrl);
  const videoUrlInvalid = videoUrl.trim() !== "" && parsedVideo === null;

  const canSubmit =
    parsedVideo !== null &&
    timestamps.length > 0 &&
    opponentCharacterId !== null &&
    result !== null &&
    !submitting;

  const addTimestamp = () => {
    const t_sec = parseFlexibleTime(timeInput);
    if (t_sec === null) {
      setTimeInputNotice("タイムスタンプの形式が正しくありません（mm:ss / h:mm:ss / 秒数）");
      return;
    }
    if (timestamps.some((ts) => ts.t_sec === t_sec)) {
      setTimeInputNotice("同じ時刻が既に追加されています");
      return;
    }
    const label = labelInput.trim();
    setTimestamps((prev) => [...prev, label ? { t_sec, label } : { t_sec }]);
    setTimeInput("");
    setLabelInput("");
    setTimeInputNotice(null);
  };

  const removeTimestamp = (t_sec: number) => {
    setTimestamps((prev) => prev.filter((ts) => ts.t_sec !== t_sec));
  };

  const handleSubmit = async () => {
    if (!canSubmit || !opponentCharacterId || !result) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createReviewRequest({
        videoUrl,
        timestamps,
        opponentCharacterId,
        mode,
        result,
        memo: memo.trim() === "" ? null : memo,
      });
      setVideoUrl("");
      setTimeInput("");
      setLabelInput("");
      setTimestamps([]);
      setOpponentCharacterId(null);
      setResult(null);
      setMemo("");
      onCreated();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded border border-border-subtle bg-surface-1 p-3">
      <div>
        <label className="text-xs font-medium text-ink-secondary">YouTube URL</label>
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="mt-1 w-full min-h-11 rounded border border-border bg-surface-0 p-2 text-sm text-ink-primary"
        />
        {videoUrlInvalid ? (
          <p className="mt-1 text-xs text-danger">YouTubeのURLとして認識できません。</p>
        ) : null}
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-ink-secondary">タイムスタンプ</label>
        <p className="mt-1 text-xs text-ink-muted">撃墜されたシーンのタイムスタンプ推奨</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            type="text"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            placeholder="mm:ss"
            className="min-h-9 w-24 rounded border border-border bg-surface-0 p-2 text-sm text-ink-primary"
          />
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="ラベル（任意）"
            className="min-h-9 flex-1 rounded border border-border bg-surface-0 p-2 text-sm text-ink-primary"
          />
          <button
            type="button"
            onClick={addTimestamp}
            className="min-h-9 rounded bg-surface-2 px-3 text-xs font-medium text-ink-secondary hover:text-ink-primary"
          >
            追加
          </button>
        </div>
        {timeInputNotice ? <p className="mt-1 text-xs text-warning">{timeInputNotice}</p> : null}
        {timestamps.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {timestamps.map((ts) => (
              <li
                key={ts.t_sec}
                className="flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary"
              >
                <span>
                  {formatTimeDisplay(ts.t_sec)}
                  {ts.label ? ` ${ts.label}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => removeTimestamp(ts.t_sec)}
                  aria-label="削除"
                  className="text-ink-muted hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-ink-secondary">対戦相手キャラ</label>
        <div className="mt-1">
          <OpponentCharacterSelect selectedCharacterId={opponentCharacterId} onSelect={setOpponentCharacterId} />
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-ink-secondary">勝敗</label>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setResult("win")}
            className={`min-h-9 rounded-md px-3 text-sm font-bold ${
              result === "win"
                ? "bg-action text-white"
                : "border border-border bg-surface-2 text-ink-secondary hover:text-ink-primary"
            }`}
          >
            勝
          </button>
          <button
            type="button"
            onClick={() => setResult("lose")}
            className={`min-h-9 rounded-md px-3 text-sm font-medium ${
              result === "lose"
                ? "bg-action text-white"
                : "border border-border bg-surface-2 text-ink-secondary hover:text-ink-primary"
            }`}
          >
            負
          </button>
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-ink-secondary">モード</label>
        <div className="mt-1 inline-flex rounded-md border border-border-subtle bg-surface-0 p-0.5">
          {MATCH_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`min-h-9 rounded px-3 text-xs font-medium transition-colors ${
                mode === m ? "bg-action text-white" : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              {MATCH_MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-ink-secondary">メモ（任意）</label>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded border border-border bg-surface-0 p-2 text-sm text-ink-primary"
        />
      </div>

      {submitError ? <p className="mt-3 text-xs text-danger">{submitError}</p> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-4 min-h-11 w-full rounded bg-action px-3 font-medium text-white hover:bg-action-strong disabled:opacity-50"
      >
        {submitting ? "送信中…" : "レビューを依頼する"}
      </button>
    </div>
  );
}
