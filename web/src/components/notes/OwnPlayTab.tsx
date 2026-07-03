// 立ち回りメモタブ（is_mainのみ）。ADR-0009: 縦一列で長すぎた不満①への対応。
// docs/06 A-3: タグチップ「ゼロサム / 基本」（Discordの元カテゴリを .context/backfill-own-play-tags.py で
// notes.tags[0] に復元済み）でフィルタ + NoteCardのデフォルト折りたたみで一覧を圧縮する。
// ADR-0013 (G-2): 自キャラでスコープする。character_id IS NULL（0004バックフィル前の既存メモ）と
// character_id = mainCharacterId の両対応クエリ（デプロイ順序の安全のため、docs/08）。
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

// Discord元カテゴリ由来の代表タグ（.context/backfill-own-play-tags.py の TAG_BY_CATEGORY と一致）。
// 実データには他の自由入力タグも混在しうるため、チップは「代表タグ + その他」の構成にする。
const KNOWN_TAGS = ["ゼロサム", "基本"];
const OTHER = "__other__" as const;
type TagFilter = string | typeof OTHER | null;

export function OwnPlayTab({ mainCharacterId }: Props) {
  const query = useMemo(
    () => ({ kind: "own_play" as const, character_id_in: [null, mainCharacterId] }),
    [mainCharacterId],
  );
  const { notes, error, create, update, remove, toggleStar, reload } = useNotes(query);
  const [composing, setComposing] = useState<Composing>(null);
  const [tagFilter, setTagFilter] = useState<TagFilter>(null);

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

  const presentKnownTags = KNOWN_TAGS.filter((t) => notes.some((n) => n.tags.includes(t)));
  const hasOther = notes.some((n) => !n.tags.some((t) => KNOWN_TAGS.includes(t)));

  const filtered =
    tagFilter === null
      ? notes
      : tagFilter === OTHER
        ? notes.filter((n) => !n.tags.some((t) => KNOWN_TAGS.includes(t)))
        : notes.filter((n) => n.tags.includes(tagFilter));

  return (
    <div>
      {error ? <p className="mb-2 text-sm text-danger">読み込みエラー: {error}</p> : null}

      <button
        type="button"
        onClick={() => setComposing({ mode: "create" })}
        className="min-h-11 rounded bg-action px-3 py-1.5 text-sm font-medium text-white"
      >
        + メモを追加
      </button>

      {presentKnownTags.length > 0 || hasOther ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            className={`min-h-9 rounded-full border px-3 py-1 text-xs font-medium ${
              tagFilter === null
                ? "border-action bg-action/15 text-action-strong"
                : "border-border-subtle text-ink-secondary hover:border-action"
            }`}
          >
            すべて {notes.length}
          </button>
          {presentKnownTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTagFilter(t)}
              className={`min-h-9 rounded-full border px-3 py-1 text-xs font-medium ${
                tagFilter === t
                  ? "border-action bg-action/15 text-action-strong"
                  : "border-border-subtle text-ink-secondary hover:border-action"
              }`}
            >
              #{t} {notes.filter((n) => n.tags.includes(t)).length}
            </button>
          ))}
          {hasOther ? (
            <button
              type="button"
              onClick={() => setTagFilter(OTHER)}
              className={`min-h-9 rounded-full border px-3 py-1 text-xs font-medium ${
                tagFilter === OTHER
                  ? "border-action bg-action/15 text-action-strong"
                  : "border-border-subtle text-ink-secondary hover:border-action"
              }`}
            >
              その他
            </button>
          ) : null}
        </div>
      ) : null}

      {composing ? (
        <div className="mt-3">
          <NoteEditor
            fixedKind="own_play"
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
        {filtered.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {notes.length === 0 ? "立ち回りメモはまだありません。" : "該当するメモがありません。"}
          </p>
        ) : (
          filtered.map((n) => (
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
