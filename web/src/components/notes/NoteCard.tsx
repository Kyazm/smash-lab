// ノート1件のカード表示。スター/ピン切替・編集・削除の導線と、本文Markdown・タグ・メディアを表示。
import { renderMarkdown } from "../../lib/markdown";
import { sectionLabel } from "../../lib/noteSections";
import { NoteMediaView } from "./NoteMediaView";
import type { NoteWithMedia } from "../../data/notes/types";

interface Props {
  note: NoteWithMedia;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleStar?: (note: NoteWithMedia) => void;
  onTogglePin?: (note: NoteWithMedia) => void;
  /** true で本文を折りたたみ・メディアは件数のみ表示（一覧のスキャン用） */
  compact?: boolean;
}

const PIN_KINDS = new Set(["matchup", "player"]);

export function NoteCard({
  note,
  onEdit,
  onDelete,
  onToggleStar,
  onTogglePin,
  compact = false,
}: Props) {
  const canPin = PIN_KINDS.has(note.kind);

  return (
    <div className="rounded border border-border bg-surface-1/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
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
        </div>

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

      {note.body_md ? (
        <div className={compact ? "mt-2 max-h-32 overflow-hidden" : "mt-2"}>
          {renderMarkdown(note.body_md)}
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
        compact ? (
          <p className="mt-2 text-xs text-ink-muted">🎞 メディア {note.media.length}件</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {note.media.map((m) => (
              <li key={m.id}>
                <NoteMediaView media={m} />
              </li>
            ))}
          </ul>
        )
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
  );
}
