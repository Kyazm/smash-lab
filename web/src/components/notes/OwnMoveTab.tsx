// 技メモタブ（is_mainのみ）。技セレクタ + 選択技のメモ一覧。技の正規順グループ化はWave A-3。
import { useEffect, useState } from "react";
import { OwnNotesList } from "./OwnNotesList";
import type { Move } from "../../types";

interface Props {
  moves: Move[];
}

export function OwnMoveTab({ moves }: Props) {
  const [moveId, setMoveId] = useState<string>("");

  useEffect(() => {
    if (moves.length > 0 && !moves.some((m) => m.id === moveId)) {
      setMoveId(moves[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves]);

  const selectedMove = moves.find((m) => m.id === moveId) ?? null;

  return (
    <div>
      <label className="block text-sm text-ink-secondary">
        技を選択
        <select
          value={moveId}
          onChange={(e) => setMoveId(e.target.value)}
          className="mt-1 w-full min-h-11 rounded border border-border bg-surface-1 p-2 text-sm text-ink-primary"
        >
          {moves.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name_ja ?? m.name_en ?? m.slug}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-4">
        {/* key で技切替時に作成/編集状態をリセット */}
        <OwnNotesList
          key={moveId}
          kind="own_move"
          moveId={selectedMove?.id}
          emptyLabel={`${selectedMove?.name_ja ?? "この技"}のメモはまだありません。`}
        />
      </div>
    </div>
  );
}
