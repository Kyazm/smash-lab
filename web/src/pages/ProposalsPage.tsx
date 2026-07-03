// 承認待ち一覧ページ「/proposals」（docs/07 F-A）。
// AI整頓の提案（note_proposals, status in pending/stale）をキャラ別にグルーピングして横断的に捌く。
// 各提案は ProposalReview（既存の差分・承認/却下UI）をインライン開閉。承認/却下で一覧から除去。
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { notesProvider } from "../data/notes";
import { ProposalReview } from "../components/notes/ProposalReview";
import type { NoteWithMedia, PendingProposalItem } from "../data/notes/types";

// own系（character_id無し）ノートのkindラベル。matchup/playerはキャラ名で表示するのでここでは使わない。
const OWN_KIND_LABEL: Partial<Record<PendingProposalItem["kind"], string>> = {
  own_play: "自キャラ・立ち回り",
  own_move: "自キャラ・技メモ",
  own_match: "自キャラ・試合",
};

function groupLabel(item: PendingProposalItem): string {
  if (item.characterName) return item.characterName;
  return OWN_KIND_LABEL[item.kind] ?? "その他";
}

function groupLinkTo(item: PendingProposalItem): string | null {
  if (item.characterSlug) {
    const tab = item.kind === "player" ? "notes" : "notes";
    return `/c/${item.characterSlug}?tab=${tab}`;
  }
  if (item.kind === "own_play") return "/me?tab=own";
  if (item.kind === "own_move") return "/me?tab=moves";
  if (item.kind === "own_match") return "/me?tab=matches";
  return null;
}

interface ProposalRowProps {
  item: PendingProposalItem;
  onChanged: () => void;
}

/** 1提案の行。開くと対象ノートを取得して ProposalReview を表示する。 */
function ProposalRow({ item, onChanged }: ProposalRowProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<NoteWithMedia | null | undefined>(undefined);

  useEffect(() => {
    if (!open || note !== undefined) return;
    let cancelled = false;
    notesProvider.getNote(item.proposal.note_id).then((n) => {
      if (!cancelled) setNote(n);
    });
    return () => {
      cancelled = true;
    };
  }, [open, note, item.proposal.note_id]);

  const isStale = item.proposal.status === "stale";

  return (
    <div className="rounded border border-border bg-surface-1/50 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-11 items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-ink-muted" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
          <span className="truncate font-medium text-ink-primary">{item.noteTitle || "（無題）"}</span>
          {isStale ? (
            <span className="shrink-0 rounded bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
              要再生成（stale）
            </span>
          ) : null}
        </span>
        {item.proposal.change_summary ? (
          <span className="hidden min-w-0 shrink truncate text-xs text-ink-muted sm:block sm:max-w-[55%]">
            {item.proposal.change_summary}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="mt-2">
          {isStale ? (
            <p className="text-xs text-ink-secondary">
              元メモがこの提案の生成後に編集されたため、提案が古くなっています。再生成が必要です（Gemini復活後に対応）。
            </p>
          ) : null}
          {note === undefined ? (
            <p className="text-xs text-ink-muted">読み込み中…</p>
          ) : note === null ? (
            <p className="text-xs text-danger">対象メモが見つかりません（削除された可能性）。</p>
          ) : (
            <ProposalReview note={note} onNoteChanged={onChanged} onResolved={onChanged} />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ProposalsPage() {
  const [items, setItems] = useState<PendingProposalItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const list = await notesProvider.listPendingProposals();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // 承認・却下されると対象提案がstatus pending/stale以外になるため、次回再取得までは
  // 楽観的に一覧から取り除く（stale化した場合は再取得後に自然と残る）。
  const removeFromList = useCallback((proposalId: string) => {
    setItems((prev) => (prev ? prev.filter((i) => i.proposal.id !== proposalId) : prev));
  }, []);

  const handleChanged = useCallback(
    (proposalId: string) => {
      removeFromList(proposalId);
      reload();
    },
    [removeFromList, reload],
  );

  const groups = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, { label: string; linkTo: string | null; items: PendingProposalItem[] }>();
    for (const item of items) {
      const label = groupLabel(item);
      const existing = map.get(label);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(label, { label, linkTo: groupLinkTo(item), items: [item] });
      }
    }
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  }, [items]);

  const pendingCount = items?.filter((i) => i.proposal.status === "pending").length ?? 0;
  const staleCount = items?.filter((i) => i.proposal.status === "stale").length ?? 0;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Link to="/" className="text-xs text-ink-muted hover:text-ink-primary">
        ← キャラ一覧
      </Link>
      <h1 className="mt-1 text-xl font-bold text-ink-primary">承認待ちの提案</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        AI整頓の提案をキャラ別にまとめて確認・承認/却下できます。
        {items ? (
          <span className="ml-1 text-ink-muted">
            （承認待ち {pendingCount} 件{staleCount > 0 ? ` / 要再生成 ${staleCount} 件` : ""}）
          </span>
        ) : null}
      </p>

      {error ? <p className="mt-3 text-sm text-danger">読み込みエラー: {error}</p> : null}

      {items === null ? (
        <p className="mt-4 text-sm text-ink-muted">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">承認待ちの提案はありません。</p>
      ) : (
        <div className="mt-4 space-y-6">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-secondary">
                {group.linkTo ? (
                  <Link to={group.linkTo} className="hover:text-action-strong hover:underline">
                    {group.label}
                  </Link>
                ) : (
                  group.label
                )}
                <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-normal text-ink-muted">
                  {group.items.length}
                </span>
              </h2>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <ProposalRow
                    key={item.proposal.id}
                    item={item}
                    onChanged={() => handleChanged(item.proposal.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
