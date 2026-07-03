// キャラ一覧（"/"）。日本語名/英語名の部分一致検索。モバイルファースト。
// ADR-0013 (G-2): is_main バッジは自キャラ切替で更新されるよう mainCharacterId を依存に含めて再取得する。
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dataProvider } from "../data";
import { notesProvider } from "../data/notes";
import { useMainCharacter } from "../lib/mainCharacterContext";
import type { Character } from "../types";

export function CharacterListPage() {
  const { mainCharacterId } = useMainCharacter();
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [query, setQuery] = useState("");
  // 承認待ち(pending+stale)件数バッジ（docs/07 F-A）。
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    dataProvider
      .listCharacters()
      .then((list) => {
        if (!cancelled) setCharacters(list);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("[CharacterListPage] listCharacters 失敗", e);
          setCharacters([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mainCharacterId]);

  useEffect(() => {
    let cancelled = false;
    notesProvider
      .listPendingProposals()
      .then((list) => {
        if (!cancelled) setPendingCount(list.length);
      })
      .catch((e) => {
        // バッジは補助情報。取得失敗時は非表示(null)にとどめ、致命的エラーにはしない。
        if (!cancelled) {
          console.error("[CharacterListPage] listPendingProposals 失敗", e);
          setPendingCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!characters) return [];
    const q = query.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter(
      (c) => c.name_ja.toLowerCase().includes(q) || c.name_en.toLowerCase().includes(q),
    );
  }, [characters, query]);

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl tracking-wide text-ink-primary">キャラ一覧</h1>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            to="/me"
            className="flex min-h-11 items-center rounded bg-action px-3 py-1.5 font-medium text-white hover:bg-action-strong"
          >
            自キャラ
          </Link>
          <Link
            to="/search"
            className="flex min-h-11 items-center rounded bg-surface-2 px-3 py-1.5 font-medium text-ink-secondary hover:text-ink-primary"
          >
            横断検索
          </Link>
          <Link
            to="/proposals"
            className="flex min-h-11 items-center gap-1.5 rounded bg-surface-2 px-3 py-1.5 font-medium text-ink-secondary hover:text-ink-primary"
          >
            承認待ち
            {pendingCount !== null && pendingCount > 0 ? (
              <span className="rounded-full bg-warning px-1.5 py-0.5 text-xs font-bold text-surface-0">
                {pendingCount}
              </span>
            ) : null}
          </Link>
          <Link
            to="/library"
            className="flex min-h-11 items-center rounded bg-surface-2 px-3 py-1.5 font-medium text-ink-secondary hover:text-ink-primary"
          >
            ライブラリ
          </Link>
        </nav>
      </div>

      <input
        type="search"
        placeholder="キャラ名で検索（日本語/英語）"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-3 w-full min-h-11 rounded border border-border bg-surface-1 p-2 text-sm text-ink-primary"
      />

      {characters === null ? (
        <p className="mt-4 text-sm text-ink-muted">読み込み中…</p>
      ) : (
        <ul className="mt-4 divide-y divide-border-subtle">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                to={`/c/${c.slug}`}
                className="flex min-h-11 items-center justify-between gap-2 py-3 text-ink-primary hover:bg-surface-2/50"
              >
                <span className="flex items-center gap-2">
                  {c.icon_url ? (
                    <img src={c.icon_url} alt="" className="h-8 w-8 rounded object-contain" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded bg-surface-2 text-xs text-ink-muted">
                      {c.name_ja.slice(0, 1)}
                    </span>
                  )}
                  <span>
                    <span className="font-medium">{c.name_ja}</span>
                    <span className="ml-2 text-xs text-ink-muted">{c.name_en}</span>
                  </span>
                </span>
                {c.is_main ? (
                  <span className="rounded bg-action px-2 py-0.5 text-xs text-white">使用キャラ</span>
                ) : null}
              </Link>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="py-3 text-sm text-ink-muted">該当するキャラが見つかりません。</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
