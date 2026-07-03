// キャラ対メモタブ。docs/01 F4 / docs/05: 対戦の合間に数秒でスキャンできることを最優先。
//   - pinned(TL;DR) を冒頭に固定表示
//   - セクションテンプレート（ニュートラル/不利状況/復帰阻止/飛び道具対策/ステージ選択）で分類表示
//   - ⭐フィルタ
//   - player スコープのメモ一覧
import { useMemo, useState } from "react";
import { useNotes } from "../../hooks/useNotes";
import { MATCHUP_SECTIONS } from "../../lib/noteSections";
import { NoteCard } from "./NoteCard";
import { NoteEditor } from "./NoteEditor";
import { NoteMediaEditor } from "./NoteMediaEditor";
import type { NoteCreateInput, NoteWithMedia, NoteKind } from "../../data/notes/types";

interface Props {
  /** 相手キャラID */
  characterId: string;
  characterNameJa: string;
}

type Composing =
  | { mode: "create"; kind: NoteKind }
  | { mode: "edit"; note: NoteWithMedia }
  | null;

export function MatchupNotesTab({ characterId, characterNameJa }: Props) {
  // matchup + player の両方を取得（character_id で絞る）
  const query = useMemo(() => ({ character_id: characterId }), [characterId]);
  const { notes, error, create, update, remove, toggleStar, togglePin, reload } = useNotes(query);
  const [starOnly, setStarOnly] = useState(false);
  const [composing, setComposing] = useState<Composing>(null);

  const matchupNotes = useMemo(
    () => (notes ?? []).filter((n) => n.kind === "matchup"),
    [notes],
  );
  const playerNotes = useMemo(
    () => (notes ?? []).filter((n) => n.kind === "player"),
    [notes],
  );

  const visible = (list: NoteWithMedia[]) => (starOnly ? list.filter((n) => n.starred) : list);

  const pinned = useMemo(
    () => visible(matchupNotes).filter((n) => n.pinned),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchupNotes, starOnly],
  );

  const cardHandlers = {
    onEdit: (id: string) => {
      const n = (notes ?? []).find((x) => x.id === id);
      if (n) setComposing({ mode: "edit", note: n });
    },
    onDelete: (id: string) => remove(id),
    onToggleStar: toggleStar,
    onTogglePin: togglePin,
  };

  const submitCreate = async (input: NoteCreateInput) => {
    await create(input);
    setComposing(null);
  };
  const submitEdit = async (input: NoteCreateInput) => {
    if (composing?.mode !== "edit") return;
    await update(composing.note.id, input);
    setComposing(null);
  };

  if (notes === null) {
    return <p className="text-sm text-slate-400">読み込み中…</p>;
  }

  return (
    <div>
      {error ? <p className="mb-2 text-sm text-red-400">読み込みエラー: {error}</p> : null}

      {/* 操作バー */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setComposing({ mode: "create", kind: "matchup" })}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          + キャラ対メモ
        </button>
        <button
          type="button"
          onClick={() => setComposing({ mode: "create", kind: "player" })}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          + プレイヤー別メモ
        </button>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 sm:ml-auto">
          <input
            type="checkbox"
            checked={starOnly}
            onChange={(e) => setStarOnly(e.target.checked)}
            className="accent-amber-500"
          />
          ⭐のみ
        </label>
      </div>

      {/* 作成/編集フォーム */}
      {composing ? (
        <div className="mt-3">
          <NoteEditor
            fixedKind={composing.mode === "create" ? composing.kind : composing.note.kind}
            fixedCharacterId={characterId}
            initial={composing.mode === "edit" ? composing.note : undefined}
            sectionChoices={
              (composing.mode === "create" ? composing.kind : composing.note.kind) === "matchup"
                ? MATCHUP_SECTIONS
                : undefined
            }
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

      {/* TL;DR ピン留め（冒頭固定） */}
      {pinned.length > 0 ? (
        <section className="mt-4">
          <h2 className="mb-2 flex items-center gap-1 text-sm font-bold text-emerald-400">
            📌 TL;DR（要点）
          </h2>
          <div className="space-y-2 rounded border border-emerald-800/60 bg-emerald-950/20 p-2">
            {pinned.map((n) => (
              <NoteCard key={n.id} note={n} {...cardHandlers} />
            ))}
          </div>
        </section>
      ) : null}

      {/* セクションテンプレート別 */}
      {MATCHUP_SECTIONS.map((sec) => {
        const inSection = visible(matchupNotes).filter((n) => n.section === sec.key && !n.pinned);
        if (inSection.length === 0) return null;
        return (
          <section key={sec.key} className="mt-4">
            <h2 className="mb-2 text-sm font-bold text-slate-200">{sec.label}</h2>
            <div className="space-y-2">
              {inSection.map((n) => (
                <NoteCard key={n.id} note={n} {...cardHandlers} />
              ))}
            </div>
          </section>
        );
      })}

      {/* 未分類の matchup メモ */}
      {(() => {
        const unsectioned = visible(matchupNotes).filter((n) => n.section === null && !n.pinned);
        if (unsectioned.length === 0) return null;
        return (
          <section className="mt-4">
            <h2 className="mb-2 text-sm font-bold text-slate-200">未分類</h2>
            <div className="space-y-2">
              {unsectioned.map((n) => (
                <NoteCard key={n.id} note={n} {...cardHandlers} />
              ))}
            </div>
          </section>
        );
      })()}

      {/* プレイヤー別メモ */}
      {visible(playerNotes).length > 0 ? (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-bold text-indigo-300">プレイヤー別メモ</h2>
          <div className="space-y-2">
            {visible(playerNotes).map((n) => (
              <NoteCard key={n.id} note={n} {...cardHandlers} />
            ))}
          </div>
        </section>
      ) : null}

      {matchupNotes.length === 0 && playerNotes.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          {characterNameJa} のキャラ対メモはまだありません。上のボタンから追加できます。
        </p>
      ) : null}
    </div>
  );
}
