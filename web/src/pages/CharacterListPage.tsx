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
import { useIsGuest } from "../lib/guestContext";
import { BrandMark } from "../components/BrandMark";
import { CharacterIcon } from "../components/shared/CharacterIcon";
import { ModeSelector } from "../components/match/ModeSelector";
import { WinLoseControl } from "../components/match/WinLoseControl";
import { MatchDigest } from "../components/match/MatchDigest";
import { PracticeCard } from "../components/practice/PracticeCard";
import { groupForSlug, isMiiSlug, makeGroupResolver, type CharacterGroup } from "../lib/characterGroups";
import type { Character } from "../types";

// 一覧の1行。ポケトレ/ホムヒカは代表ファイターを character に、group に定義を持つ（キャラ選択画面と同じ1枠）。
interface DisplayEntry {
  character: Character;
  displayName: string;
  group?: CharacterGroup;
  searchText: string;
}

interface CharRecord {
  wins: number;
  losses: number;
  current: number;
}

export function CharacterListPage() {
  const { mainCharacterId } = useMainCharacter();
  const { mode } = useMatchMode();
  const isGuest = useIsGuest();
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [query, setQuery] = useState("");
  // 承認待ち(pending+stale)件数バッジ（docs/07 F-A）。
  const [pendingCount, setPendingCount] = useState<number | null>(null);
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
        out.push({
          character: c,
          displayName: g.displayName,
          group: g,
          // 検索は表示名+全メンバー名（ゼニガメ等）+英名を対象にする。
          searchText: `${g.displayName} ${g.members.map((m) => m.label).join(" ")} ${c.name_en}`.toLowerCase(),
        });
      } else {
        out.push({
          character: c,
          displayName: c.name_ja,
          searchText: `${c.name_ja} ${c.name_en}`.toLowerCase(),
        });
      }
    }
    return out;
  }, [characters]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.searchText.includes(q));
  }, [entries, query]);

  return (
    // 12行×列流しグリッド（下記）が横に伸びるため、このページはコンテナを広めに取る。
    <div className="mx-auto max-w-6xl p-4">
      {/* ヘッダーは1行に（BrandMark左・ナビ右）。右上の空きを解消。 */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <BrandMark size="sm" />
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
          {/* 承認待ち提案はオーナー個人のレビューキュー（migration 0006でRLSもオーナー限定）。ゲストには出さない。 */}
          {!isGuest ? (
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
          ) : null}
          {/* AIレビューもオーナー個人のレビューキュー（Macパイプライン依存・ADR-0019）。ゲストには出さない。 */}
          {!isGuest ? (
            <Link
              to="/review"
              className="flex min-h-11 items-center rounded bg-surface-2 px-3 py-1.5 font-medium text-ink-secondary hover:text-ink-primary"
            >
              AIレビュー
            </Link>
          ) : null}
          {/* 戦績ダッシュボードはゲストにも表示（自分のローカル戦績を試せる。個人情報漏洩はない）。 */}
          <Link
            to="/stats"
            className="flex min-h-11 items-center rounded bg-surface-2 px-3 py-1.5 font-medium text-ink-secondary hover:text-ink-primary"
          >
            戦績
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
        className="mt-3 w-full max-w-xl min-h-11 rounded border border-border bg-surface-1 p-2 text-sm text-ink-primary"
      />

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

      {characters === null ? (
        <p className="mt-4 text-sm text-ink-muted">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 py-3 text-sm text-ink-muted">該当するキャラが見つかりません。</p>
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
