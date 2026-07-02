// キャラ一覧（"/"）。日本語名/英語名の部分一致検索。モバイルファースト。
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dataProvider } from "../data";
import type { Character } from "../types";

export function CharacterListPage() {
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    dataProvider.listCharacters().then((list) => {
      if (!cancelled) setCharacters(list);
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
      <h1 className="text-xl font-bold text-slate-100">キャラ一覧</h1>

      <input
        type="search"
        placeholder="キャラ名で検索（日本語/英語）"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-3 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
      />

      {characters === null ? (
        <p className="mt-4 text-sm text-slate-400">読み込み中…</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-800">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                to={`/c/${c.slug}`}
                className="flex items-center justify-between gap-2 py-3 text-slate-100 hover:bg-slate-800/50"
              >
                <span className="flex items-center gap-2">
                  {c.icon_url ? (
                    <img src={c.icon_url} alt="" className="h-8 w-8 rounded object-contain" />
                  ) : null}
                  <span>
                    <span className="font-medium">{c.name_ja}</span>
                    <span className="ml-2 text-xs text-slate-400">{c.name_en}</span>
                  </span>
                </span>
                {c.is_main ? (
                  <span className="rounded bg-emerald-700 px-2 py-0.5 text-xs text-white">
                    使用キャラ
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="py-3 text-sm text-slate-400">該当するキャラが見つかりません。</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
