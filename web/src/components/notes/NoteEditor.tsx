// ノートの新規作成/編集フォーム。kind/character_id/move_id は呼び出し側で固定して渡す。
import { useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import type { SectionDef } from "../../lib/noteSections";
import type { Note, NoteCreateInput, NoteKind, NoteSection } from "../../data/notes/types";

interface Props {
  initial?: Partial<Note>;
  fixedKind: NoteKind;
  fixedCharacterId?: string | null;
  fixedMoveId?: string | null;
  onSubmit: (input: NoteCreateInput) => Promise<void> | void;
  onCancel: () => void;
  /** matchup 用のセクション選択肢。渡すとセクション select を表示 */
  sectionChoices?: SectionDef[];
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");
}

export function NoteEditor({
  initial,
  fixedKind,
  fixedCharacterId,
  fixedMoveId,
  onSubmit,
  onCancel,
  sectionChoices,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body_md ?? "");
  const [section, setSection] = useState<NoteSection | "">(initial?.section ?? "");
  const [playerName, setPlayerName] = useState(initial?.player_name ?? "");
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(", "));
  const [starred, setStarred] = useState(initial?.starred ?? false);
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [busy, setBusy] = useState(false);

  const canPin = fixedKind === "matchup" || fixedKind === "player";

  const submit = async () => {
    setBusy(true);
    try {
      const input: NoteCreateInput = {
        kind: fixedKind,
        character_id: fixedCharacterId ?? null,
        move_id: fixedMoveId ?? null,
        player_name: fixedKind === "player" ? playerName.trim() || null : null,
        title: title.trim() || null,
        body_md: body,
        section: section === "" ? null : section,
        starred,
        pinned: canPin ? pinned : false,
        tags: parseTags(tagsRaw),
      };
      await onSubmit(input);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
      {fixedKind === "player" ? (
        <label className="block text-sm text-slate-300">
          プレイヤー名
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="例: Light"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
          />
        </label>
      ) : null}

      <label className="mt-2 block text-sm text-slate-300">
        タイトル
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
        />
      </label>

      {sectionChoices ? (
        <label className="mt-2 block text-sm text-slate-300">
          セクション
          <select
            value={section}
            onChange={(e) => setSection(e.target.value as NoteSection | "")}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
          >
            <option value="">（なし）</option>
            {sectionChoices.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mt-2">
        <span className="block text-sm text-slate-300">本文（Markdown）</span>
        <div className="mt-1">
          <MarkdownEditor value={body} onChange={setBody} placeholder="# 見出し\n- 箇条書き\n**太字**" />
        </div>
      </div>

      <label className="mt-2 block text-sm text-slate-300">
        タグ（カンマ区切り）
        <input
          type="text"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="ニュートラル, 復帰阻止"
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-1.5 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={starred}
            onChange={(e) => setStarred(e.target.checked)}
            className="accent-amber-500"
          />
          ⭐ 重要
        </label>
        {canPin ? (
          <label className="flex items-center gap-1.5 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="accent-emerald-500"
            />
            📌 冒頭に固定（TL;DR）
          </label>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded bg-slate-700 px-4 py-1.5 text-sm font-medium text-slate-200 disabled:opacity-50"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
