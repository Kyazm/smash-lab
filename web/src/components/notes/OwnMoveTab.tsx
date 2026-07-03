// 技メモタブ（is_mainのみ）。docs/06 A-3: 技の正規順（弱→強→スマッシュ→空中→B技→投げ）でグループ化し、
// 技名チップでジャンプする。タイトルはchannel名でなく技の正式名（move_id結合）を表示する
// （OwnNotesList/NoteEditorが move.name_ja を使う既存実装を維持）。
import { useState } from "react";
import { OwnNotesList } from "./OwnNotesList";
import { groupMovesBySection } from "../../lib/moveSections";
import type { Move } from "../../types";

interface Props {
  moves: Move[];
  mainCharacterId: string;
}

export function OwnMoveTab({ moves, mainCharacterId }: Props) {
  const grouped = groupMovesBySection(moves);
  const [moveId, setMoveId] = useState<string>(() => grouped[0]?.moves[0]?.id ?? "");

  const selectedMove = moves.find((m) => m.id === moveId) ?? null;

  if (moves.length === 0) {
    return <p className="text-sm text-ink-muted">技データがありません。</p>;
  }

  return (
    <div>
      <div className="space-y-3">
        {grouped.map((g) => (
          <div key={g.section.key}>
            <div className="mb-1 text-xs font-semibold text-ink-muted">{g.section.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.moves.map((m) => {
                const label = m.name_ja ?? m.name_en ?? m.slug;
                const selected = m.id === moveId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMoveId(m.id)}
                    aria-pressed={selected}
                    className={`min-h-9 rounded-full border px-3 py-1 text-xs font-medium ${
                      selected
                        ? "border-action bg-action/15 text-action-strong"
                        : "border-border-subtle text-ink-secondary hover:border-action"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-border-subtle pt-4">
        <h3 className="text-sm font-bold text-ink-primary">
          {selectedMove?.name_ja ?? selectedMove?.name_en ?? "技を選択してください"}
        </h3>
        <div className="mt-3">
          {/* key で技切替時に作成/編集状態をリセット */}
          <OwnNotesList
            key={moveId}
            kind="own_move"
            moveId={selectedMove?.id}
            mainCharacterId={mainCharacterId}
            emptyLabel={`${selectedMove?.name_ja ?? "この技"}のメモはまだありません。`}
          />
        </div>
      </div>
    </div>
  );
}
