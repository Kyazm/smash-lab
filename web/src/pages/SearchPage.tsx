// 横断検索（"/search"）。docs/01 F5 / docs/02: キャラ・技・メモをレーン分けして表示。
// キャラ/技はフレームデータ（dataProvider）から、メモは notesProvider から検索する。
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dataProvider } from "../data";
import { notesProvider } from "../data/notes";
import { NoteCard } from "../components/notes/NoteCard";
import type { Character, CharacterBundle, Move } from "../types";
import type { NoteWithMedia } from "../data/notes/types";

interface MoveHit {
  move: Move;
  character: Character;
}

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [bundles, setBundles] = useState<CharacterBundle[]>([]);
  const [noteHits, setNoteHits] = useState<NoteWithMedia[]>([]);

  // キャラ一覧 + 各キャラの moves を集約（技レーン検索用）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await dataProvider.listCharacters();
      if (cancelled) return;
      setCharacters(list);
      const loaded = await Promise.all(list.map((c) => dataProvider.getCharacterBySlug(c.slug)));
      if (!cancelled) setBundles(loaded.filter((b): b is CharacterBundle => b !== null));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // メモ検索（キーワード変化で都度）
  useEffect(() => {
    let cancelled = false;
    const k = query.trim();
    if (k === "") {
      setNoteHits([]);
      return;
    }
    notesProvider.searchNotes(k).then((hits) => {
      if (!cancelled) setNoteHits(hits);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const q = query.trim().toLowerCase();

  const charHits = useMemo(() => {
    if (q === "") return [];
    return characters.filter(
      (c) => c.name_ja.toLowerCase().includes(q) || c.name_en.toLowerCase().includes(q),
    );
  }, [characters, q]);

  const moveHits = useMemo<MoveHit[]>(() => {
    if (q === "") return [];
    const hits: MoveHit[] = [];
    for (const b of bundles) {
      for (const m of b.moves) {
        const nameJa = (m.name_ja ?? "").toLowerCase();
        const nameEn = (m.name_en ?? "").toLowerCase();
        if (nameJa.includes(q) || nameEn.includes(q)) {
          hits.push({ move: m, character: b.character });
        }
      }
    }
    return hits;
  }, [bundles, q]);

  // メモ→キャラへのリンク解決
  const charById = useMemo(
    () => new Map(characters.map((c) => [c.id, c])),
    [characters],
  );

  const hasQuery = q !== "";
  const noResults = hasQuery && charHits.length === 0 && moveHits.length === 0 && noteHits.length === 0;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Link to="/" className="text-xs text-slate-400 hover:text-slate-200">
        ← キャラ一覧
      </Link>
      <h1 className="mt-1 text-xl font-bold text-slate-100">横断検索</h1>
      <p className="mt-1 text-xs text-slate-400">キャラ名・技名・メモ（本文/タグ）を検索</p>

      <input
        type="search"
        autoFocus
        placeholder="キーワード"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-3 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
      />

      {noResults ? (
        <p className="mt-4 text-sm text-slate-400">該当する結果がありません。</p>
      ) : null}

      {/* レーン: キャラ */}
      {charHits.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-slate-200">キャラ</h2>
          <ul className="divide-y divide-slate-800">
            {charHits.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/c/${c.slug}`}
                  className="flex items-center gap-2 py-2 text-slate-100 hover:bg-slate-800/50"
                >
                  <span className="font-medium">{c.name_ja}</span>
                  <span className="text-xs text-slate-400">{c.name_en}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* レーン: 技 */}
      {moveHits.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-slate-200">技</h2>
          <ul className="divide-y divide-slate-800">
            {moveHits.map(({ move, character }) => (
              <li key={move.id}>
                <Link
                  to={`/c/${character.slug}`}
                  className="flex items-center justify-between gap-2 py-2 text-slate-100 hover:bg-slate-800/50"
                >
                  <span>
                    <span className="font-medium">{move.name_ja ?? move.name_en ?? move.slug}</span>
                    <span className="ml-2 text-xs text-slate-400">{move.name_en ?? ""}</span>
                  </span>
                  <span className="text-xs text-slate-500">{character.name_ja}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* レーン: メモ（キャラ/技レーンとは分離） */}
      {noteHits.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-slate-200">メモ</h2>
          <div className="space-y-2">
            {noteHits.map((n) => {
              const c = n.character_id ? charById.get(n.character_id) : null;
              return (
                <div key={n.id}>
                  <NoteCard note={n} compact />
                  <div className="mt-1 text-xs text-slate-500">
                    {n.kind === "own_play"
                      ? "自キャラ: 立ち回り"
                      : n.kind === "own_move"
                        ? "自キャラ: 技別"
                        : c
                          ? `キャラ対: ${c.name_ja}`
                          : "キャラ対"}
                    {c ? (
                      <Link to={`/c/${c.slug}`} className="ml-2 text-emerald-400">
                        → 開く
                      </Link>
                    ) : (
                      <Link to="/me" className="ml-2 text-emerald-400">
                        → 自キャラページ
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
