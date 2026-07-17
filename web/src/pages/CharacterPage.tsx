// 統一キャラページ（"/c/:slug"）。ADR-0009: 全キャラ共通 frames|punish|notes、is_mainのみ own|moves を追加。
// タブ状態は `?tab=` に、確反タブの守り/攻めは `&mode=defend|attack` に持つ（共有・戻る対応、docs/06）。
// ADR-0013 (G-2): is_main の実効値は useMainCharacter() （Context、Supabase実値+ランタイム上書き）で判定する。
// bundle.character.is_main（静的JSON由来）はフォールバックに留める。
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { dataProvider } from "../data";
import { groupForSlug } from "../lib/characterGroups";
import { FrameDataTable } from "../components/FrameDataTable";
import { PunishPanel } from "../components/PunishPanel";
import { MatchupNotesTab } from "../components/notes/MatchupNotesTab";
import { OwnPlayTab } from "../components/notes/OwnPlayTab";
import { OwnMoveTab } from "../components/notes/OwnMoveTab";
import { OwnMatchTab } from "../components/notes/OwnMatchTab";
import { CharacterStatsTab } from "../components/match/CharacterStatsTab";
import { TabBar } from "../components/shared/TabBar";
import { BrandMark } from "../components/BrandMark";
import { CharacterIcon } from "../components/shared/CharacterIcon";
import { useMainCharacter } from "../lib/mainCharacterContext";
import type { CharacterBundle } from "../types";

type CommonTab = "frames" | "punish" | "notes";
type MainOnlyTab = "own" | "moves" | "matches";
type Tab = CommonTab | MainOnlyTab;

// 戦績はタブでなくキャラ名下の常設ブロック（CharacterStatsTab）で表示する（旧「戦績」タブは廃止）。
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
  // 旧 ?tab=record リンクは isValidTab を通らず既定（notes）へフォールバックする。
  if (v === "frames" || v === "punish" || v === "notes") return true;
  if (isMain && (v === "own" || v === "moves" || v === "matches")) return true;
  return false;
}

export function CharacterPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bundle, setBundle] = useState<CharacterBundle | null | undefined>(undefined);
  const [main, setMain] = useState<CharacterBundle | null | undefined>(undefined);
  const { mainCharacterId, setMainCharacter } = useMainCharacter();
  const [settingMain, setSettingMain] = useState(false);
  const [settingMainError, setSettingMainError] = useState<string | null>(null);
  // グループ（ポケトレ/ホムヒカ）の代表情報。戦績・メモを「1キャラ」に集約するために代表idへ寄せる。
  const [repInfo, setRepInfo] = useState<{ id: string; slug: string; name: string } | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setBundle(undefined);
    dataProvider
      .getCharacterBySlug(slug)
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("[CharacterPage] getCharacterBySlug 失敗", e);
          setBundle(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // mainCharacterId が変わったら（自キャラ切替、初期同期）確反タブ用の main バンドルを再取得する。
  useEffect(() => {
    let cancelled = false;
    dataProvider
      .getMainCharacter()
      .then((m) => {
        if (!cancelled) setMain(m);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("[CharacterPage] getMainCharacter 失敗", e);
          setMain(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mainCharacterId]);

  // グループメンバーのページなら、代表ファイターのid/slug/表示名を解決する（戦績・メモの集約先）。
  const group = bundle ? groupForSlug(bundle.character.slug) : undefined;
  useEffect(() => {
    if (!group) {
      setRepInfo(null);
      return;
    }
    let cancelled = false;
    dataProvider
      .listCharacters()
      .then((list) => {
        if (cancelled) return;
        const rep = list.find((c) => c.slug === group.representativeSlug);
        if (rep) setRepInfo({ id: rep.id, slug: rep.slug, name: group.displayName });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [group?.key]);

  const isMain = bundle != null && mainCharacterId != null && bundle.character.id === mainCharacterId;
  const tabParam = searchParams.get("tab");
  // 既定タブはキャラ対メモ（対策を最初に見たい）。?tab= 指定時はそれを優先。
  const tab: Tab = isValidTab(tabParam, isMain) ? tabParam : "notes";

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

  const onSetMain = async () => {
    setSettingMain(true);
    setSettingMainError(null);
    try {
      await setMainCharacter(bundle.character.id);
    } catch (e) {
      setSettingMainError(e instanceof Error ? e.message : String(e));
    } finally {
      setSettingMain(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className="text-xs text-ink-muted hover:text-ink-primary">
          ← キャラ一覧
        </Link>
        <BrandMark size="sm" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <CharacterIcon character={bundle.character} size="lg" />
        <div className="min-w-0">
          <h1 className="font-display text-4xl leading-none tracking-wide text-ink-primary sm:text-5xl">
            {bundle.character.name_ja}
          </h1>
          <p className="mt-1 font-frame text-xs uppercase tracking-[0.18em] text-ink-muted">
            {bundle.character.name_en}
          </p>
        </div>
        {isMain ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent-red px-2.5 py-0.5 text-xs font-bold text-accent-red">
            ★ 自キャラ
          </span>
        ) : (
          <button
            type="button"
            onClick={onSetMain}
            disabled={settingMain}
            className="min-h-9 rounded-full border border-border-subtle px-3 py-1 text-xs font-medium text-ink-secondary hover:border-accent-red hover:text-accent-red disabled:opacity-50"
          >
            {settingMain ? "設定中…" : "⭐ 自キャラに設定"}
          </button>
        )}
      </div>
      {settingMainError ? (
        <p className="mt-1 text-xs text-danger">自キャラの設定に失敗しました: {settingMainError}</p>
      ) : null}

      {/* ポケトレ/ホムヒカのサブキャラ切替（キャラ選択画面と同じ1枠。フレーム表・確反は各ファイター個別）。 */}
      {group ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            {group.displayName}
          </span>
          <div className="inline-flex rounded-md border border-border-subtle bg-surface-1 p-0.5">
            {group.members.map((m) => (
              <button
                key={m.slug}
                type="button"
                onClick={() => navigate(`/c/${m.slug}?${searchParams.toString()}`)}
                className={`min-h-9 rounded px-3 text-xs font-medium transition-colors ${
                  m.slug === bundle.character.slug
                    ? "bg-action text-white"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* 戦績ブロック常設（旧「戦績」タブを廃止しキャラ名下へ、ADR-0015）。
          モード選択+勝/負は常時表示、詳細（連勝・推移・モード別）は折りたたみ可。記録先はグループ代表に集約。 */}
      <div className="mt-3">
        <CharacterStatsTab
          key={repInfo?.id ?? bundle.character.id}
          characterId={repInfo?.id ?? bundle.character.id}
          noteHref={`/c/${repInfo?.slug ?? bundle.character.slug}?tab=notes`}
        />
      </div>

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
          // メモはグループを1キャラ扱いにするため代表(ポケモントレーナー等)に集約する。
          <MatchupNotesTab
            key={repInfo?.id ?? bundle.character.id}
            characterId={repInfo?.id ?? bundle.character.id}
            characterNameJa={repInfo?.name ?? bundle.character.name_ja}
            characterSlug={repInfo?.slug ?? bundle.character.slug}
          />
        ) : tab === "own" ? (
          <OwnPlayTab mainCharacterId={bundle.character.id} />
        ) : tab === "moves" ? (
          <OwnMoveTab moves={bundle.moves} mainCharacterId={bundle.character.id} />
        ) : (
          <OwnMatchTab mainCharacterId={bundle.character.id} />
        )}
      </div>
    </div>
  );
}
