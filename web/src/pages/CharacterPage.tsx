// 統一キャラページ（"/c/:slug"）。ADR-0009: 全キャラ共通 frames|punish|notes、is_mainのみ own|moves を追加。
// タブ状態は `?tab=` に、確反タブの守り/攻めは `&mode=defend|attack` に持つ（共有・戻る対応、docs/06）。
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { dataProvider } from "../data";
import { FrameDataTable } from "../components/FrameDataTable";
import { PunishPanel } from "../components/PunishPanel";
import { MatchupNotesTab } from "../components/notes/MatchupNotesTab";
import { OwnPlayTab } from "../components/notes/OwnPlayTab";
import { OwnMoveTab } from "../components/notes/OwnMoveTab";
import { OwnMatchTab } from "../components/notes/OwnMatchTab";
import { TabBar } from "../components/shared/TabBar";
import type { CharacterBundle } from "../types";

type CommonTab = "frames" | "punish" | "notes";
type MainOnlyTab = "own" | "moves" | "matches";
type Tab = CommonTab | MainOnlyTab;

const COMMON_TABS: { key: CommonTab; label: string }[] = [
  { key: "frames", label: "フレーム表" },
  { key: "punish", label: "確定反撃" },
  { key: "notes", label: "キャラ対メモ" },
];
// docs/07 F-B: 順序は フレーム表/確定反撃/キャラ対メモ/立ち回り/技メモ/試合
const MAIN_ONLY_TABS: { key: MainOnlyTab; label: string }[] = [
  { key: "own", label: "立ち回り" },
  { key: "moves", label: "技メモ" },
  { key: "matches", label: "試合" },
];

function isValidTab(v: string | null, isMain: boolean): v is Tab {
  if (v === "frames" || v === "punish" || v === "notes") return true;
  if (isMain && (v === "own" || v === "moves" || v === "matches")) return true;
  return false;
}

export function CharacterPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bundle, setBundle] = useState<CharacterBundle | null | undefined>(undefined);
  const [main, setMain] = useState<CharacterBundle | null | undefined>(undefined);

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

  const isMain = bundle?.character.is_main ?? false;
  const tabParam = searchParams.get("tab");
  const tab: Tab = isValidTab(tabParam, isMain) ? tabParam : "frames";

  const tabs = useMemo(
    () => (isMain ? [...COMMON_TABS, ...MAIN_ONLY_TABS] : COMMON_TABS),
    [isMain],
  );

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    if (next !== "punish") params.delete("mode");
    setSearchParams(params, { replace: false });
  };

  if (bundle === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="text-sm text-ink-muted">読み込み中…</p>
      </div>
    );
  }

  if (bundle === null) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="text-sm text-ink-muted">キャラが見つかりません。</p>
        <Link to="/" className="mt-2 inline-block text-sm text-action-strong">
          一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Link to="/" className="text-xs text-ink-muted hover:text-ink-primary">
        ← キャラ一覧
      </Link>
      <h1 className="mt-1 text-xl font-bold text-ink-primary">
        {bundle.character.name_ja}
        <span className="ml-2 text-sm font-normal text-ink-secondary">{bundle.character.name_en}</span>
        {isMain ? (
          <span className="ml-2 align-middle rounded bg-action/20 px-2 py-0.5 text-xs font-normal text-action-strong">
            使用キャラ
          </span>
        ) : null}
      </h1>

      <div className="mt-4">
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
      </div>

      <div className="mt-4">
        {tab === "frames" ? (
          <FrameDataTable moves={bundle.moves} />
        ) : tab === "punish" ? (
          // key でキャラ切替時に選択状態をリセット（技選択の持ち越し防止）
          <PunishPanel key={bundle.character.id} opponent={bundle} main={main ?? null} />
        ) : tab === "notes" ? (
          <MatchupNotesTab
            key={bundle.character.id}
            characterId={bundle.character.id}
            characterNameJa={bundle.character.name_ja}
            characterSlug={bundle.character.slug}
          />
        ) : tab === "own" ? (
          <OwnPlayTab />
        ) : tab === "moves" ? (
          <OwnMoveTab moves={bundle.moves} />
        ) : (
          <OwnMatchTab />
        )}
      </div>
    </div>
  );
}
