// 自キャラの own_play / own_move メモ一覧 + 作成/編集。
// own_move の場合は move_id で紐づく技メモのみ表示する（呼び出し側が moveId を渡す）。
// ADR-0013 (G-2): own_move は move由来のcharacter_idを持つ（表示はmove_idが正）。新規作成時に
// character_id=mainCharacterId を付与し、0004のmoveバックフィルと整合させる。
import { useMemo, useState } from "react";
import { useNotes } from "../../hooks/useNotes";
import { NoteCard } from "./NoteCard";
import { NoteEditor } from "./NoteEditor";
import { NoteMediaEditor } from "./NoteMediaEditor";
import type { NoteCreateInput, NoteKind, NoteWithMedia } from "../../data/notes/types";

interface Props {
  kind: Extract<NoteKind, "own_play" | "own_move">;
  /** own_move 時に絞り込む技ID。own_play 時は undefined */
  moveId?: string;
  /** 新規作成時に付与する自キャラID */
  mainCharacterId: string;
  emptyLabel: string;
}

type Composing = { mode: "create" } | { mode: "edit"; note: NoteWithMedia } | null;

export function OwnNotesList({ kind, moveId, mainCharacterId, emptyLabel }: Props) {
  // own_move は move_id で絞る（character_idはmove由来の非正規化コピーのため絞り込みには使わない）。
  // own_play は character_id の両対応クエリ（デプロイ移行、docs/08）。
  const query = useMemo(
    () =>
      kind === "own_move" && moveId
        ? { kind, move_id: moveId }
        : { kind, character_id_in: [null, mainCharacterId] },
    [kind, moveId, mainCharacterId],
  );
  const { notes, error, create, update, remove, toggleStar, reload } = useNotes(query);
  const [composing, setComposing] = useState<Composing>(null);

  const submitCreate = async (input: NoteCreateInput) => {
    await create(input);
    setComposing(null);
  };
  const submitEdit = async (input: NoteCreateInput) => {
    if (composing?.mode !== "edit") return;
    await update(composing.note.id, input);
    setComposing(null);
  };

  if (notes === null) return <p className="text-sm text-ink-muted">読み込み中…</p>;

  return (
    <div>
      {error ? <p className="mb-2 text-sm text-danger">読み込みエラー: {error}</p> : null}

      <button
        type="button"
        onClick={() => setComposing({ mode: "create" })}
        className="min-h-11 rounded bg-action px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        disabled={kind === "own_move" && !moveId}
      >
        + メモを追加
      </button>
      {kind === "own_move" && !moveId ? (
        <p className="mt-2 text-xs text-ink-muted">技を選択するとメモを追加できます。</p>
      ) : null}

      {composing ? (
        <div className="mt-3">
          <NoteEditor
            fixedKind={kind}
            fixedCharacterId={mainCharacterId}
            fixedMoveId={kind === "own_move" ? moveId : undefined}
            initial={composing.mode === "edit" ? composing.note : undefined}
            onSubmit={composing.mode === "create" ? submitCreate : submitEdit}
            onCancel={() => setComposing(null)}
          />
          {composing.mode === "edit" ? (
            <NoteMediaEditor
              noteId={composing.note.id}
              media={composing.note.media}
              onChange={reload}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {notes.length === 0 ? (
          <p className="text-sm text-ink-muted">{emptyLabel}</p>
        ) : (
          notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onEdit={(id) => {
                const found = notes.find((x) => x.id === id);
                if (found) setComposing({ mode: "edit", note: found });
              }}
              onDelete={remove}
              onToggleStar={toggleStar}
            />
          ))
        )}
      </div>
    </div>
  );
}
