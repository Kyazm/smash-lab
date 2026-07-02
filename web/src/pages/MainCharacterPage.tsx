// 自キャラ(ZSS)ページ（"/me"）。docs/01 F1。
// タブ: 立ち回りメモ（own_play） / 技別メモ（own_move、技セレクタ付き）。
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dataProvider } from "../data";
import { OwnNotesList } from "../components/notes/OwnNotesList";
import type { CharacterBundle } from "../types";

type Tab = "play" | "move";

export function MainCharacterPage() {
  const [main, setMain] = useState<CharacterBundle | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("play");
  const [moveId, setMoveId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    dataProvider.getMainCharacter().then((m) => {
      if (!cancelled) {
        setMain(m);
        if (m && m.moves.length > 0) setMoveId(m.moves[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const moves = useMemo(() => main?.moves ?? [], [main]);
  const selectedMove = moves.find((m) => m.id === moveId) ?? null;

  if (main === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="text-sm text-slate-400">読み込み中…</p>
      </div>
    );
  }

  if (main === null) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="text-sm text-slate-400">
          使用キャラ（is_main=true）のデータが見つかりません。
        </p>
        <Link to="/" className="mt-2 inline-block text-sm text-emerald-400">
          一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Link to="/" className="text-xs text-slate-400 hover:text-slate-200">
        ← キャラ一覧
      </Link>
      <h1 className="mt-1 text-xl font-bold text-slate-100">
        {main.character.name_ja}
        <span className="ml-2 text-sm font-normal text-slate-400">（自キャラ）</span>
      </h1>

      <div className="mt-4 flex gap-2 border-b border-slate-700">
        <button
          type="button"
          onClick={() => setTab("play")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "play" ? "border-b-2 border-emerald-500 text-emerald-400" : "text-slate-400"
          }`}
        >
          立ち回りメモ
        </button>
        <button
          type="button"
          onClick={() => setTab("move")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "move" ? "border-b-2 border-emerald-500 text-emerald-400" : "text-slate-400"
          }`}
        >
          技別メモ
        </button>
      </div>

      <div className="mt-4">
        {tab === "play" ? (
          <OwnNotesList kind="own_play" emptyLabel="立ち回りメモはまだありません。" />
        ) : (
          <div>
            <label className="block text-sm text-slate-300">
              技を選択
              <select
                value={moveId}
                onChange={(e) => setMoveId(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
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
        )}
      </div>
    </div>
  );
}
