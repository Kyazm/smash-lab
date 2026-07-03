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
import type { Character } from "../types";

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

  useEffect(() => {
    let cancelled = false;
    matchProvider
      .listResults({ mode })
      .then((results) => {
        if (cancelled) return;
        const byChar = new Map<string, typeof results>();
        for (const r of results) {
          const list = byChar.get(r.characterId);
          if (list) list.push(r);
          else byChar.set(r.characterId, [r]);
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
  }, [mode, recordRefresh]);

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
      <BrandMark size="sm" className="block" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-ink-secondary">キャラ一覧</h1>
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
        className="mt-3 w-full min-h-11 rounded border border-border bg-surface-1 p-2 text-sm text-ink-primary"
      />

      {/* 勝敗記録のモード切替。各行の勝/負ボタンはこのモードに記録される（ADR-0015）。 */}
      <div className="mt-3 flex items-center gap-2">
        <span className="font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">記録先</span>
        <ModeSelector />
      </div>

      {characters === null ? (
        <p className="mt-4 text-sm text-ink-muted">読み込み中…</p>
      ) : (
        <ul className="mt-4 divide-y divide-border-subtle">
          {filtered.map((c) => {
            const rec = recordsByChar.get(c.id) ?? { wins: 0, losses: 0, current: 0 };
            return (
              // hover背景・タップ領域は行(li)全体に。Link(左)とWinLoseControl(右)のネスト不正を回避（ADR-0015）。
              <li key={c.id} className="flex items-center gap-2 rounded pr-1 hover:bg-surface-2/50">
                <Link
                  to={`/c/${c.slug}`}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-3 text-ink-primary"
                >
                  <CharacterIcon character={c} size="sm" />
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{c.name_ja}</span>
                    <span className="ml-2 font-frame text-xs uppercase tracking-[0.18em] text-ink-muted">
                      {c.name_en}
                    </span>
                  </span>
                  {c.is_main ? (
                    <span className="ml-1 shrink-0 rounded-full border border-accent-red px-1.5 py-0.5 text-[10px] font-bold text-accent-red">
                      ★
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
                />
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="py-3 text-sm text-ink-muted">該当するキャラが見つかりません。</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
