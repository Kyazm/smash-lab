// AI試合レビュー一覧ページ「/review」（docs/13_match-review.md ②画面仕様）。
// オーナー専用（Macパイプライン依存・ADR-0019）。ゲストはガード文言のみ表示し、
// データ取得・フォームは一切マウントしない（フックの条件付き呼び出しを避けるため別コンポーネントに分離）。
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useIsGuest } from "../lib/guestContext";
import { useReviews } from "../hooks/useReviews";
import { dataProvider } from "../data";
import { CharacterIcon } from "../components/shared/CharacterIcon";
import { ReviewRequestForm } from "../components/review/ReviewRequestForm";
import { ReviewStatusBadge } from "../components/review/ReviewStatusBadge";
import { MATCH_MODE_LABELS } from "../data/match/types";
import type { Character } from "../types";

export function ReviewListPage() {
  const isGuest = useIsGuest();
  return isGuest ? <ReviewGuestNotice /> : <ReviewListPageOwner />;
}

function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl p-4">{children}</div>;
}

function ReviewGuestNotice() {
  return (
    <PageShell>
      <h1 className="font-display text-2xl tracking-wide text-ink-primary">AIレビュー</h1>
      <p className="mt-2 text-sm text-ink-secondary">オーナー専用機能。ゲストでは利用できません。</p>
      <p className="mt-1 text-sm text-ink-muted">
        YouTubeの試合動画とタイムスタンプを送信すると、Mac側のClaude
        Codeが方法論チェックリストに沿って場面ごとに分析し、findings（気づき）として返します。
      </p>
    </PageShell>
  );
}

function ReviewListPageOwner() {
  const { reviews, error, reload } = useReviews();
  const [characters, setCharacters] = useState<Character[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    dataProvider
      .listCharacters()
      .then((list) => {
        if (!cancelled) setCharacters(list);
      })
      .catch((e) => {
        console.error("[ReviewListPage] listCharacters 失敗", e);
        if (!cancelled) setCharacters([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const charMap = useMemo(() => {
    const map = new Map<string, Character>();
    for (const c of characters ?? []) map.set(c.id, c);
    return map;
  }, [characters]);

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl tracking-wide text-ink-primary">AIレビュー</h1>
        <button
          type="button"
          onClick={reload}
          className="min-h-9 rounded bg-surface-2 px-3 text-xs font-medium text-ink-secondary hover:text-ink-primary"
        >
          再取得
        </button>
      </div>

      <div className="mt-3">
        <ReviewRequestForm onCreated={reload} />
      </div>

      {error ? <p className="mt-3 text-sm text-danger">読み込みエラー: {error}</p> : null}

      <div className="mt-4 space-y-2">
        {reviews === null ? (
          <p className="text-sm text-ink-muted">読み込み中…</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-ink-muted">レビュー依頼はまだありません。</p>
        ) : (
          reviews.map((r) => {
            const opponent = r.match.opponent_character_id
              ? charMap.get(r.match.opponent_character_id)
              : undefined;
            const row = (
              <div className="flex items-center gap-3 rounded border border-border-subtle bg-surface-1 p-3">
                {opponent ? <CharacterIcon character={opponent} size="sm" /> : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-ink-primary">
                      {opponent?.name_ja ?? "対戦相手不明"}
                    </span>
                    {r.match.mode ? (
                      <span className="text-xs text-ink-muted">{MATCH_MODE_LABELS[r.match.mode]}</span>
                    ) : null}
                    <span className="text-xs text-ink-muted">
                      タイムスタンプ {r.requested_timestamps.length}件
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">
                    {new Date(r.created_at).toLocaleString("ja-JP")}
                  </div>
                </div>
                <ReviewStatusBadge status={r.status} updatedAt={r.updated_at} />
              </div>
            );
            return r.status === "done" ? (
              <Link key={r.id} to={`/review/${r.id}`} className="block">
                {row}
              </Link>
            ) : (
              <div key={r.id}>{row}</div>
            );
          })
        )}
      </div>
    </PageShell>
  );
}
