// 対戦相手キャラ選択（docs/13_match-review.md ②画面仕様: /review フォームの相手キャラ入力）。
// MoveSelectSheet.tsx と同じ「ボトムシート+検索」パターン（FATのion-select interface="modal"）をキャラ一覧向けに転用する。
import { useEffect, useMemo, useState } from "react";
import { dataProvider } from "../../data";
import { BottomSheet } from "../shared/BottomSheet";
import { CharacterIcon } from "../shared/CharacterIcon";
import type { Character } from "../../types";

interface Props {
  selectedCharacterId: string | null;
  onSelect: (characterId: string) => void;
}

export function OpponentCharacterSelect({ selectedCharacterId, onSelect }: Props) {
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    dataProvider
      .listCharacters()
      .then((list) => {
        if (!cancelled) setCharacters(list);
      })
      .catch((e) => {
        console.error("[OpponentCharacterSelect] listCharacters 失敗", e);
        if (!cancelled) setCharacters([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = characters?.find((c) => c.id === selectedCharacterId) ?? null;

  const filtered = useMemo(() => {
    if (!characters) return [];
    const q = query.trim().toLowerCase();
    if (q === "") return characters;
    return characters.filter(
      (c) => c.name_ja.toLowerCase().includes(q) || c.name_en.toLowerCase().includes(q),
    );
  }, [characters, query]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded border border-border bg-surface-1 px-3 py-2 text-left text-sm text-ink-primary hover:border-action"
      >
        {selected ? (
          <>
            <CharacterIcon character={selected} size="sm" />
            <span className="font-medium">{selected.name_ja}</span>
          </>
        ) : (
          <span className="text-ink-muted">対戦相手キャラを選択</span>
        )}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="対戦相手キャラ">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キャラ名で検索"
          className="mb-3 w-full min-h-11 rounded border border-border bg-surface-0 p-2 text-sm text-ink-primary"
        />
        <div className="max-h-[55vh] space-y-1 overflow-y-auto">
          {characters === null ? (
            <p className="text-sm text-ink-muted">読み込み中…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-ink-muted">該当するキャラがいません。</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={`flex min-h-11 w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                  c.id === selectedCharacterId
                    ? "bg-action/15 text-action-strong"
                    : "text-ink-primary hover:bg-surface-2"
                }`}
              >
                <CharacterIcon character={c} size="sm" />
                <span className="font-medium">{c.name_ja}</span>
                <span className="text-xs text-ink-muted">{c.name_en}</span>
              </button>
            ))
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
