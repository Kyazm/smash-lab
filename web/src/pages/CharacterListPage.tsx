// キャラ一覧（"/"）。日本語名/英語名の部分一致検索。モバイルファースト。
// ADR-0013 (G-2): is_main バッジは自キャラ切替で更新されるよう mainCharacterId を依存に含めて再取得する。
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dataProvider } from "../data";
import { notesProvider } from "../data/notes";
import { matchProvider } from "../data/match";
import { computeStreaks, computeSummary } from "../lib/matchStats";
import { useMainCharacter } from "../lib/mainCharacterContext";
import { useMatchMode } from "../lib/matchModeContext";
import { CharacterIcon } from "../components/shared/CharacterIcon";
import { ModeSelector } from "../components/match/ModeSelector";
import { WinLoseControl } from "../components/match/WinLoseControl";
import { MatchDigest } from "../components/match/MatchDigest";
import { PracticeCard } from "../components/practice/PracticeCard";
import { groupForSlug, isMiiSlug, makeGroupResolver, type CharacterGroup } from "../lib/characterGroups";
import { filterCharacters } from "../lib/characterSearch";
import type { Character } from "../types";

// 一覧の1行。ポケトレ/ホムヒカは代表ファイターを character に、group に定義を持つ（キャラ選択画面と同じ1枠）。
interface DisplayEntry {
  character: Character;
  displayName: string;
  group?: CharacterGroup;
}

interface CharRecord {
  wins: number;
  losses: number;
  current: number;
}

export function CharacterListPage() {
  const { mainCharacterId } = useMainCharacter();
  const { mode } = useMatchMode();
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [query, setQuery] = useState("");
  // 現モードの対戦相手キャラ別戦績（ADR-0015）。勝敗記録・undo後に再取得する。
  const [recordsByChar, setRecordsByChar] = useState<Map<string, CharRecord>>(new Map());
  const [recordRefresh, setRecordRefresh] = useState(0);
  // キャラ対メモが存在する対戦相手（代表idに正規化済み）。「負け越し×メモなし」の注意ドット用（ADR-0018）。
  const [notedCharIds, setNotedCharIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!characters) return;
    let cancelled = false;
    const { normalizeId } = makeGroupResolver(characters);
    notesProvider
      .listNotes({ kind: "matchup" })
      .then((notes) => {
        if (cancelled) return;
        const ids = new Set<string>();
        for (const n of notes) {
          if (n.character_id) ids.add(normalizeId(n.character_id));
        }
        setNotedCharIds(ids);
      })
      .catch(() => {}); // 補助表示。失敗しても致命的でない
    return () => {
      cancelled = true;
    };
  }, [characters, recordRefresh]);

  useEffect(() => {
    if (!characters) return;
    let cancelled = false;
    // 対戦相手idをグループ代表に正規化してから集計（ポケトレ/ホムヒカは1枠に集約）。
    const { normalizeId } = makeGroupResolver(characters);
    matchProvider
      .listResults({ mode })
      .then((results) => {
        if (cancelled) return;
        const byChar = new Map<string, typeof results>();
        for (const r of results) {
          const cid = normalizeId(r.characterId);
          const list = byChar.get(cid);
          if (list) list.push(r);
          else byChar.set(cid, [r]);
        }
        const next = new Map<string, CharRecord>();
        for (const [cid, list] of byChar) {
          const s = computeSummary(list);
          next.set(cid, { wins: s.wins, losses: s.losses, current: computeStreaks(list).current });
        }
        setRecordsByChar(next);
      })
      .catch((e) => {
        if (!cancelled) console.error("[CharacterListPage] listResults 失敗", e);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, recordRefresh, characters]);

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

  // グループ（ポケトレ/ホムヒカ）を代表位置の1枠に畳み込む。メンバー個別は一覧から除外する。
  const entries = useMemo<DisplayEntry[]>(() => {
    if (!characters) return [];
    // Mii系（格闘/剣術/射撃）を末尾へ。安定ソートなので他キャラの並び（fighter_number順）は保持する。
    const ordered = [...characters].sort(
      (a, b) => (isMiiSlug(a.slug) ? 1 : 0) - (isMiiSlug(b.slug) ? 1 : 0),
    );
    const out: DisplayEntry[] = [];
    for (const c of ordered) {
      const g = groupForSlug(c.slug);
      if (g) {
        if (c.slug !== g.representativeSlug) continue; // 代表以外は畳む
        out.push({ character: c, displayName: g.displayName, group: g });
      } else {
        out.push({ character: c, displayName: c.name_ja });
      }
    }
    return out;
  }, [characters]);

  // 曖昧検索（characterSearch.ts）。グループ枠は表示名に加えメンバー名・メンバーslugも対象に含める
  // （「リザードン」「mythra」等でポケトレ/ホムヒカ枠がヒットするように。連結後の部分一致で拾う）。
  const filtered = useMemo(() => {
    const searchable = entries.map((e) => ({
      entry: e,
      name_ja: e.group
        ? `${e.displayName} ${e.group.members.map((m) => m.label).join(" ")}`
        : e.displayName,
      name_en: e.character.name_en,
      slug: e.group
        ? `${e.character.slug} ${e.group.members.map((m) => m.slug).join(" ")}`
        : e.character.slug,
      fighter_number: e.character.fighter_number,
    }));
    return filterCharacters(query, searchable).map((s) => s.entry);
  }, [entries, query]);

  return (
    // 12行×列流しグリッド（下記）が横に伸びるため、このページはコンテナを広めに取る。
    // ヘッダー（BrandMark・ナビ）は共通AppHeader（App.tsx）に統一済み。
    <div className="mx-auto max-w-6xl p-4">
      {/* モード選択（記録先＝戦績サマリ表示で共通・連動）。勝/負ボタンはこのモードに記録される（ADR-0015）。 */}
      <div className="mt-3 flex items-center gap-2">
        <span className="font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">モード</span>
        <ModeSelector />
      </div>

      {/* 今日の練習（意識ポイント・セッション・ティルト検知）。ADR-0018。 */}
      <PracticeCard refreshKey={recordRefresh} />

      {/* 戦績ダイジェスト（選択モードのサマリ＋モード別サマリ＋VIPランク）。上のモードに連動。折りたたみ可・既定は展開。 */}
      <details open className="mt-3 max-w-4xl rounded-xl border border-border-subtle bg-surface-0">
        <summary className="min-h-11 cursor-pointer list-none px-4 py-2.5 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-secondary [&::-webkit-details-marker]:hidden">
          ▾ 戦績サマリ
        </summary>
        <div className="px-3 pb-3">
          <MatchDigest refreshKey={recordRefresh} />
        </div>
      </details>

      {/* キャラ検索（一覧の直上に置く。リアルタイム曖昧一致、characterSearch.ts） */}
      <div className="relative mt-4 w-full max-w-xl">
        <input
          type="text"
          placeholder="キャラ検索（例: がのん / zss）"
          aria-label="キャラ検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-11 w-full rounded-md border border-border-subtle bg-surface-1 p-2 pr-9 text-sm text-ink-primary"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="検索をクリア"
            className="absolute right-1 top-1/2 min-h-8 min-w-8 -translate-y-1/2 rounded px-2 text-base text-ink-muted hover:text-action-strong"
          >
            ×
          </button>
        ) : null}
      </div>

      {characters === null ? (
        <p className="mt-4 text-sm text-ink-muted">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 py-3 text-sm text-ink-muted">該当キャラなし</p>
      ) : (
        // 12キャラずつ縦に並べ、13キャラ目から右の列へ流す（grid-flow-col + 12行固定）。
        // 89キャラなら 12×7列+5。窮屈回避のため英語名は非表示（詳細ページで見られる）。
        // 列が画面幅を超える場合は横スクロール（wrapperにoverflow-x-auto、ulはw-maxで内容幅）。
        <div className="mt-4 overflow-x-auto pb-2">
          <ul className="grid w-max grid-flow-col grid-rows-[repeat(12,auto)] gap-x-6 gap-y-0.5">
            {filtered.map((e) => {
              const c = e.character;
              // ポケトレ/ホムヒカは代表id（=グループ集約先）に勝敗を記録する。
              const rec = recordsByChar.get(c.id) ?? { wins: 0, losses: 0, current: 0 };
              // 負け越しているのに対策メモが無い相手＝次の学習対象として注意ドット（ADR-0018）。
              const needsNote = rec.losses > rec.wins && !notedCharIds.has(c.id);
              return (
                // hover背景・タップ領域は行(li)全体に。Link(左)とWinLoseControl(右)のネスト不正を回避（ADR-0015）。
                <li key={c.id} className="flex items-center gap-1 rounded pr-1 hover:bg-surface-2/50">
                  <Link
                    to={`/c/${c.slug}`}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1.5 text-ink-primary"
                  >
                    <CharacterIcon character={c} size="sm" />
                    <span className="min-w-0 max-w-[10em] truncate font-medium">{e.displayName}</span>
                    {e.group ? (
                      <span className="shrink-0 rounded border border-border-subtle px-1 text-[10px] text-ink-muted">
                        {e.group.members.length}体
                      </span>
                    ) : null}
                    {c.is_main ? (
                      <span className="shrink-0 rounded-full border border-accent-red px-1.5 py-0.5 text-[10px] font-bold text-accent-red">
                        ★
                      </span>
                    ) : null}
                    {needsNote ? (
                      <span
                        title="負け越し中・対策メモなし"
                        className="shrink-0 rounded-full bg-warning px-1.5 text-[10px] font-bold text-surface-0"
                      >
                        !
                      </span>
                    ) : null}
                  </Link>
                  <WinLoseControl
                    characterId={c.id}
                    mode={mode}
                    wins={rec.wins}
                    losses={rec.losses}
                    current={rec.current}
                    onChanged={() => setRecordRefresh((x) => x + 1)}
                    showRecord={false}
                    noteHref={`/c/${c.slug}?tab=notes`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
