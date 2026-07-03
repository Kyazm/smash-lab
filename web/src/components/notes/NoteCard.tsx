// ノート1件のカード表示。デフォルト折りたたみ（タイトル+冒頭2行+メタ）、タップで展開（docs/06 A-3）。
// 長文ノート展開時は見出しへのTOCチップを表示。スター/ピン切替・編集・削除の導線と、タグ・メディアを表示。
import { useId, useState } from "react";
import { renderMarkdown } from "../../lib/markdown";
import { sectionLabel } from "../../lib/noteSections";
import { extractHeadings, extractPreviewLines, isLongNote } from "../../lib/notePreview";
import { NoteMediaView } from "./NoteMediaView";
import type { NoteWithMedia } from "../../data/notes/types";

interface Props {
  note: NoteWithMedia;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleStar?: (note: NoteWithMedia) => void;
  onTogglePin?: (note: NoteWithMedia) => void;
  /** true で常にプレビュー表示（展開不可）。横断検索など一覧のスキャン専用に使う */
  compact?: boolean;
  /** true でデフォルト展開（TL;DRピン留めなど、常に全文を見せたいカードに使う） */
  defaultExpanded?: boolean;
}

const PIN_KINDS = new Set(["matchup", "player"]);

export function NoteCard({
  note,
  onEdit,
  onDelete,
  onToggleStar,
  onTogglePin,
  compact = false,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bodyId = useId();
  const canPin = PIN_KINDS.has(note.kind);
  const body = note.body_md ?? "";
  const previewLines = extractPreviewLines(body);
  const headings = expanded ? extractHeadings(body) : [];
  const showToc = expanded && isLongNote(body) && headings.length > 1;

  const scrollToHeading = (index: number) => {
    document.getElementById(`${bodyId}-h${index}`)?.scrollIntoView({ block: "start" });
  };

  return (
    <div className="rounded border border-border bg-surface-1/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => !compact && setExpanded((v) => !v)}
          disabled={compact}
          aria-expanded={compact ? undefined : expanded}
          aria-controls={compact ? undefined : bodyId}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          <div className="flex flex-wrap items-center gap-2">
            {!compact ? (
              <span className="text-ink-muted" aria-hidden="true">
                {expanded ? "▾" : "▸"}
              </span>
            ) : null}
            <span className="font-medium text-ink-primary">{note.title || "（無題）"}</span>
            {note.section ? (
              <span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">
                {sectionLabel(note.section)}
              </span>
            ) : null}
            {note.player_name ? (
              <span className="rounded bg-info/70 px-2 py-0.5 text-xs text-white">
                vs {note.player_name}
              </span>
            ) : null}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {onToggleStar ? (
            <button
              type="button"
              onClick={() => onToggleStar(note)}
              title={note.starred ? "スターを外す" : "スターを付ける"}
              className={`min-h-11 min-w-11 text-lg leading-none ${note.starred ? "text-warning" : "text-ink-muted"}`}
            >
              {note.starred ? "★" : "☆"}
            </button>
          ) : null}
          {onTogglePin && canPin ? (
            <button
              type="button"
              onClick={() => onTogglePin(note)}
              title={note.pinned ? "ピンを外す" : "冒頭に固定（TL;DR）"}
              className={`min-h-11 min-w-11 text-sm leading-none ${note.pinned ? "text-action-strong" : "text-ink-muted"}`}
            >
              📌
            </button>
          ) : null}
        </div>
      </div>

      {/* 折りたたみ時: タイトル+冒頭2行+メタのみ。compactは常にこの表示（横断検索のスキャン用） */}
      {!expanded && previewLines.length > 0 ? (
        <p className="mt-1.5 line-clamp-2 text-sm text-ink-secondary">{previewLines.join(" ")}</p>
      ) : null}

      {expanded ? (
        <div id={bodyId}>
          {showToc ? (
            <div className="mt-2 flex flex-wrap gap-1 border-b border-border-subtle pb-2">
              {headings.map((h) => (
                <button
                  key={h.index}
                  type="button"
                  onClick={() => scrollToHeading(h.index)}
                  className="min-h-8 rounded-full border border-border-subtle px-2.5 py-1 text-xs text-ink-secondary hover:border-action hover:text-action-strong"
                >
                  {h.text}
                </button>
              ))}
            </div>
          ) : null}

          {body ? (
            <div className="mt-2 [&_h3]:scroll-mt-4 [&_h4]:scroll-mt-4 [&_h5]:scroll-mt-4">
              <HeadingAnchoredMarkdown body={body} idPrefix={bodyId} />
            </div>
          ) : null}

          {note.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {note.tags.map((t) => (
                <span key={t} className="rounded bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">
                  #{t}
                </span>
              ))}
            </div>
          ) : null}

          {note.media.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {note.media.map((m) => (
                <li key={m.id}>
                  <NoteMediaView media={m} />
                </li>
              ))}
            </ul>
          ) : null}

          {onEdit || onDelete ? (
            <div className="mt-3 flex gap-3 border-t border-border-subtle pt-2">
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(note.id)}
                  className="min-h-11 text-xs text-ink-secondary hover:text-ink-primary"
                >
                  編集
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("このメモを削除しますか？")) onDelete(note.id);
                  }}
                  className="min-h-11 text-xs text-danger hover:opacity-80"
                >
                  削除
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {note.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {note.tags.slice(0, 4).map((t) => (
                <span key={t} className="rounded bg-surface-2 px-2 py-0.5 text-xs text-ink-secondary">
                  #{t}
                </span>
              ))}
            </div>
          ) : null}
          {note.media.length > 0 ? (
            <p className="mt-2 text-xs text-ink-muted">🎞 メディア {note.media.length}件</p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** renderMarkdown の出力に見出しID(idPrefix-hN)を後付けする軽量ラッパー。 */
function HeadingAnchoredMarkdown({ body, idPrefix }: { body: string; idPrefix: string }) {
  // renderMarkdown はReact要素を直接返すためDOM後処理でid付与する（見出し数は少なく許容範囲）。
  const ref = (el: HTMLDivElement | null) => {
    if (!el) return;
    const headings = el.querySelectorAll("h3, h4, h5");
    headings.forEach((h, i) => {
      h.id = `${idPrefix}-h${i}`;
    });
  };
  return <div ref={ref}>{renderMarkdown(body)}</div>;
}
