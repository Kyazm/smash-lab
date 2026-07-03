// AI整頓提案の差分ビュー + 承認/却下UI（docs/06 A-3 / ADR-0010）。
// モバイルはbefore/after切替、デスクトップは並列表示。stale提案は再生成ボタン導線を表示する
// （実際の再生成パイプライン実行はSupabase/Agent B側の責務。ここではUIとしての導線のみ用意し、
//   クリック時は「再生成をリクエストする」旨を案内する）。
import { useEffect, useState } from "react";
import { renderMarkdown } from "../../lib/markdown";
import { useProposals } from "../../hooks/useProposals";
import type { NoteWithMedia } from "../../data/notes/types";

interface Props {
  note: NoteWithMedia;
  /** 承認/却下後にノート一覧を再取得するためのコールバック */
  onNoteChanged: () => void;
  /**
   * 却下、または承認によりこのノートの pending/stale 提案が0件になったタイミングで呼ばれる。
   * /proposals 一覧（docs/07 F-A）が行を除去するのに使う。省略可（既存呼び出し元は無変更でよい）。
   */
  onResolved?: () => void;
}

type MobileView = "before" | "after";

export function ProposalReview({ note, onNoteChanged, onResolved }: Props) {
  const { proposals, error, apply, reject } = useProposals(note.id);
  const [mobileView, setMobileView] = useState<MobileView>("after");
  const [busy, setBusy] = useState(false);
  const [staleNotice, setStaleNotice] = useState(false);

  const pending = (proposals ?? []).filter((p) => p.status === "pending");
  const stale = (proposals ?? []).filter((p) => p.status === "stale");
  const resolved = proposals !== null && pending.length === 0 && stale.length === 0;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (resolved) onResolved?.();
  }, [resolved]);

  if (proposals === null) {
    return <p className="text-xs text-ink-muted">提案を確認中…</p>;
  }
  if (error) {
    return <p className="text-xs text-danger">提案の読み込みに失敗しました: {error}</p>;
  }

  if (resolved) return null;

  const proposal = pending[0] ?? stale[0];
  const isStale = proposal.status === "stale";

  const handleApply = async () => {
    setBusy(true);
    setStaleNotice(false);
    try {
      const result = await apply(proposal.id);
      if (result === "stale") {
        setStaleNotice(true);
      } else {
        onNoteChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await reject(proposal.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded border border-info/40 bg-info/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-info">
          🪄 AI整頓の提案{isStale ? "（要再生成）" : ""}
        </span>
        {!isStale ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={busy}
              className="min-h-9 rounded bg-action px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              承認して置き換え
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={busy}
              className="min-h-9 rounded bg-surface-2 px-3 py-1 text-xs font-medium text-ink-secondary disabled:opacity-50"
            >
              却下
            </button>
          </div>
        ) : null}
      </div>

      {proposal.change_summary ? (
        <p className="mt-1 text-xs text-ink-secondary">{proposal.change_summary}</p>
      ) : null}

      {isStale ? (
        <div className="mt-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          元メモがこの提案の生成後に編集されたため、提案が古くなっています（stale）。内容を確認し、
          必要であれば再生成をリクエストしてください。
          {/* docs/07 F-A: 再生成の実処理は未実装のため当面disabled。Gemini復活後（Phase 4）に対応。 */}
          <button
            type="button"
            disabled
            title="Gemini復活後に対応"
            className="mt-2 block min-h-9 cursor-not-allowed rounded bg-warning/10 px-3 py-1 text-xs font-medium text-warning/50"
          >
            再生成をリクエスト（Gemini復活後に対応）
          </button>
        </div>
      ) : null}

      {staleNotice ? (
        <p className="mt-2 text-xs text-warning">
          承認に失敗しました。元メモが編集されたため提案が stale になりました。再生成が必要です。
        </p>
      ) : null}

      {/* デスクトップ: 並列表示 / モバイル: before/after切替 */}
      <div className="mt-3 sm:hidden">
        <div className="flex gap-1" role="tablist" aria-label="変更前/変更後">
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === "before"}
            onClick={() => setMobileView("before")}
            className={`min-h-9 rounded px-3 py-1 text-xs font-medium ${
              mobileView === "before" ? "bg-surface-2 text-ink-primary" : "text-ink-muted"
            }`}
          >
            変更前
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === "after"}
            onClick={() => setMobileView("after")}
            className={`min-h-9 rounded px-3 py-1 text-xs font-medium ${
              mobileView === "after" ? "bg-surface-2 text-ink-primary" : "text-ink-muted"
            }`}
          >
            変更後
          </button>
        </div>
        <div className="mt-2 rounded border border-border-subtle bg-surface-1 p-2">
          {mobileView === "before"
            ? renderMarkdown(note.body_md ?? "")
            : renderMarkdown(proposal.proposed_body_md)}
        </div>
      </div>

      <div className="mt-3 hidden gap-3 sm:grid sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs text-ink-muted">変更前</div>
          <div className="rounded border border-border-subtle bg-surface-1 p-2">
            {renderMarkdown(note.body_md ?? "")}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-ink-muted">変更後</div>
          <div className="rounded border border-action/40 bg-action/5 p-2">
            {renderMarkdown(proposal.proposed_body_md)}
          </div>
        </div>
      </div>
    </div>
  );
}
