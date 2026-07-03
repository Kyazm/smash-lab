// 「試合」タブ（is_mainのみ）。docs/07 F-B: 「自分の試合」メモを立ち回りタブから分離した独立タブ。
// kind='own_match' のメモCRUD。OwnPlayTab同型だがタグフィルタは不要。YouTube等の埋め込みはNoteMediaEditor/
// markdown.tsx（ADR-0012）経由で対応する。Phase 3のAI試合レビュー（YouTube→Gemini）がこのタブに書き込む前提の土台。
// ADR-0013 (G-2): 自キャラでスコープする（両対応クエリ、docs/08）。
import { useMemo, useState } from "react";
import { useNotes } from "../../hooks/useNotes";
import { NoteCard } from "./NoteCard";
import { NoteEditor } from "./NoteEditor";
import { NoteMediaEditor } from "./NoteMediaEditor";
import type { NoteCreateInput, NoteWithMedia } from "../../data/notes/types";

interface Props {
  mainCharacterId: string;
}

type Composing = { mode: "create" } | { mode: "edit"; note: NoteWithMedia } | null;

export function OwnMatchTab({ mainCharacterId }: Props) {
  const query = useMemo(
    () => ({ kind: "own_match" as const, character_id_in: [null, mainCharacterId] }),
    [mainCharacterId],
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
        className="min-h-11 rounded bg-action px-3 py-1.5 text-sm font-medium text-white"
      >
        + 試合メモを追加
      </button>

      {composing ? (
        <div className="mt-3">
          <NoteEditor
            fixedKind="own_match"
            fixedCharacterId={mainCharacterId}
            initial={composing.mode === "edit" ? composing.note : undefined}
            onSubmit={composing.mode === "create" ? submitCreate : submitEdit}
            onCancel={() => setComposing(null)}
          />
          {composing.mode === "edit" ? (
            <NoteMediaEditor noteId={composing.note.id} media={composing.note.media} onChange={reload} />
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {notes.length === 0 ? (
          <p className="text-sm text-ink-muted">試合メモはまだありません。</p>
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
