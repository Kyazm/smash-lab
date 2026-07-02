// キャラページ（"/c/:slug"）。タブ: フレームデータ表 / 確定反撃（守り・攻め）。
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dataProvider } from "../data";
import { FrameDataTable } from "../components/FrameDataTable";
import { PunishPanel } from "../components/PunishPanel";
import type { CharacterBundle } from "../types";

type Tab = "framedata" | "punish";

export function CharacterPage() {
  const { slug } = useParams<{ slug: string }>();
  const [bundle, setBundle] = useState<CharacterBundle | null | undefined>(undefined);
  const [main, setMain] = useState<CharacterBundle | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("framedata");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setBundle(undefined);
    dataProvider.getCharacterBySlug(slug).then((b) => {
      if (!cancelled) setBundle(b);
    });
    dataProvider.getMainCharacter().then((m) => {
      if (!cancelled) setMain(m);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (bundle === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="text-sm text-slate-400">読み込み中…</p>
      </div>
    );
  }

  if (bundle === null) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="text-sm text-slate-400">キャラが見つかりません。</p>
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
        {bundle.character.name_ja}
        <span className="ml-2 text-sm font-normal text-slate-400">{bundle.character.name_en}</span>
      </h1>

      <div className="mt-4 flex gap-2 border-b border-slate-700">
        <button
          type="button"
          onClick={() => setTab("framedata")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "framedata"
              ? "border-b-2 border-emerald-500 text-emerald-400"
              : "text-slate-400"
          }`}
        >
          フレームデータ表
        </button>
        <button
          type="button"
          onClick={() => setTab("punish")}
          className={`px-3 py-2 text-sm font-medium ${
            tab === "punish" ? "border-b-2 border-emerald-500 text-emerald-400" : "text-slate-400"
          }`}
        >
          確定反撃
        </button>
      </div>

      <div className="mt-4">
        {tab === "framedata" ? (
          <FrameDataTable moves={bundle.moves} />
        ) : (
          /* key でキャラ切替時に選択状態をリセット（技選択の持ち越し防止） */
          <PunishPanel key={bundle.character.id} opponent={bundle} main={main ?? null} />
        )}
      </div>
    </div>
  );
}
