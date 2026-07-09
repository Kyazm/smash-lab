// 「今日の練習」カード（ADR-0018 / docs/05 #5: 自己調整サイクル d=1.53）。トップに常時表示。
// 構成: 意識ポイント（chips+管理）/ セッション（目的→進行中W-L→振り返り）/ ティルトバナー。
// 戦績はモード横断で自前fetch（記録先モードに縛られない。refreshKeyで勝敗記録に追従）。
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { matchProvider } from "../../data/match";
import type { MatchResult } from "../../data/match/types";
import { focusProvider } from "../../data/focus";
import type { FocusPoint } from "../../data/focus/types";
import { FOCUS_CATEGORY_LABELS, MAX_ACTIVE_FOCUS } from "../../data/focus/types";
import { sessionProvider } from "../../data/session";
import type { PracticeSession } from "../../data/session/types";
import {
  composeRetroMd,
  detectResultGoal,
  detectTilt,
  sessionResults,
} from "../../lib/practiceLoop";
import { computeSummary } from "../../lib/matchStats";
import { FOCUS_PRESETS } from "../../lib/focusPresets";

export function PracticeCard({ refreshKey }: { refreshKey: number }) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [points, setPoints] = useState<FocusPoint[]>([]);
  const [active, setActive] = useState<PracticeSession | null>(null);
  const [lastUnreviewed, setLastUnreviewed] = useState<PracticeSession | null>(null);
  const [reload, setReload] = useState(0);
  const [tiltDismissed, setTiltDismissed] = useState(false);

  // 戦績（全モード）。ティルト検知とセッションW-Lに使う。
  useEffect(() => {
    let cancelled = false;
    matchProvider
      .listResults()
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // 意識ポイント + セッション状態。
  useEffect(() => {
    let cancelled = false;
    focusProvider
      .list()
      .then((p) => {
        if (!cancelled) setPoints(p);
      })
      .catch((e) => console.error("[PracticeCard] focus list 失敗", e));
    sessionProvider
      .getActive()
      .then(async (s) => {
        if (cancelled) return;
        setActive(s);
        // 進行中が無いときだけ「直近の振り返り未記入」を出す（閉じ忘れの回収導線）。
        if (!s) {
          const recent = await sessionProvider.listRecent(1);
          if (!cancelled) {
            setLastUnreviewed(recent[0] && recent[0].retroMd == null && recent[0].endedAt != null ? recent[0] : null);
          }
        } else {
          setLastUnreviewed(null);
        }
      })
      .catch((e) => console.error("[PracticeCard] session 取得失敗", e));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const activePoints = points.filter((p) => p.active);
  const tilt = useMemo(
    () => !tiltDismissed && detectTilt(results, new Date()),
    [results, tiltDismissed],
  );
  const refresh = () => setReload((x) => x + 1);

  return (
    <div className="mt-3 max-w-4xl space-y-2">
      {tilt ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-action/40 bg-action/10 px-4 py-2.5 text-sm text-ink-primary">
          <span>
            直近で3連敗しています。<strong>一旦離れて別のことを</strong>
            ——ティルト（連敗などで感情的になり判断が乱れた状態）に効くと実証されている対策は距離置きだけです（
            <Link to="/library/mental-game" className="text-action-strong underline decoration-action/40">
              対戦メンタルの科学
            </Link>
            ）
          </span>
          <button
            type="button"
            onClick={() => setTiltDismissed(true)}
            className="min-h-9 rounded px-2 text-xs text-ink-muted hover:text-ink-primary"
          >
            閉じる
          </button>
        </div>
      ) : null}

      <section className="rounded-xl border border-border-subtle bg-surface-0 px-4 py-3">
        <FocusRow points={points} onChanged={refresh} />
        <div className="mt-3 border-t border-border-subtle pt-3">
          <SessionRow
            active={active}
            lastUnreviewed={lastUnreviewed}
            activePoints={activePoints}
            results={results}
            onChanged={refresh}
          />
        </div>
      </section>
    </div>
  );
}

/** 意識ポイント行: activeチップ + 管理パネル開閉。 */
function FocusRow({ points, onChanged }: { points: FocusPoint[]; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState<"technical" | "mental">("technical");
  const [error, setError] = useState<string | null>(null);
  const activePoints = points.filter((p) => p.active);

  const toggle = async (p: FocusPoint) => {
    setError(null);
    if (!p.active && activePoints.length >= MAX_ACTIVE_FOCUS) {
      setError(`アクティブは${MAX_ACTIVE_FOCUS}個まで（1つに集中する方が実戦に転移します）。先にどれかをOFFに。`);
      return;
    }
    await focusProvider.update(p.id, { active: !p.active });
    onChanged();
  };

  const add = async (body: string, category: "technical" | "mental") => {
    setError(null);
    if (!body.trim()) return;
    if (activePoints.length >= MAX_ACTIVE_FOCUS) {
      setError(`アクティブは${MAX_ACTIVE_FOCUS}個まで。先にどれかをOFFにしてから追加してください。`);
      return;
    }
    await focusProvider.add(body.trim(), category);
    setNewBody("");
    onChanged();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">意識ポイント</span>
        {activePoints.length === 0 ? (
          <span className="text-xs text-ink-muted">未設定（1〜3個に絞ると効果的）</span>
        ) : (
          activePoints.map((p) => (
            <span
              key={p.id}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                p.category === "mental"
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-border bg-surface-2 text-ink-primary"
              }`}
            >
              {p.body}
            </span>
          ))
        )}
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="ml-auto min-h-9 rounded px-2 text-xs text-ink-secondary hover:text-ink-primary"
        >
          {editing ? "閉じる" : "編集"}
        </button>
      </div>

      {error ? <p className="mt-1 text-xs text-warning">{error}</p> : null}

      {editing ? (
        <div className="mt-2 space-y-2 rounded-lg border border-border-subtle bg-surface-1 p-3">
          <ul className="space-y-1">
            {points.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => void toggle(p)}
                  className={`min-h-8 shrink-0 rounded px-2 text-xs font-medium ${
                    p.active ? "bg-action text-white" : "border border-border text-ink-muted hover:text-ink-primary"
                  }`}
                >
                  {p.active ? "ON" : "OFF"}
                </button>
                <span className="shrink-0 rounded border border-border-subtle px-1 text-[10px] text-ink-muted">
                  {FOCUS_CATEGORY_LABELS[p.category]}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-primary">{p.body}</span>
                <button
                  type="button"
                  onClick={async () => {
                    await focusProvider.remove(p.id);
                    onChanged();
                  }}
                  aria-label="削除"
                  className="shrink-0 px-1.5 text-ink-muted hover:text-action-strong"
                >
                  ×
                </button>
              </li>
            ))}
            {points.length === 0 ? <li className="text-xs text-ink-muted">まだありません。</li> : null}
          </ul>

          <div className="flex flex-wrap gap-2">
            <input
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="自由入力（例: 崖狩りで2択を通す）"
              className="min-h-9 min-w-0 flex-1 rounded border border-border bg-surface-0 px-2 text-sm text-ink-primary focus:border-action focus:outline-none"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as "technical" | "mental")}
              className="min-h-9 rounded border border-border bg-surface-0 px-2 text-xs text-ink-primary"
            >
              <option value="technical">技術</option>
              <option value="mental">メンタル</option>
            </select>
            <button
              type="button"
              onClick={() => void add(newBody, newCategory)}
              className="min-h-9 rounded bg-action px-3 text-xs font-semibold text-white hover:bg-action-strong"
            >
              追加
            </button>
          </div>

          <details>
            <summary className="cursor-pointer text-xs text-ink-secondary hover:text-ink-primary">
              プリセットから選ぶ（エビデンス由来のドリル）
            </summary>
            <ul className="mt-1 space-y-1">
              {FOCUS_PRESETS.filter((pr) => !points.some((p) => p.body === pr.body)).map((pr) => (
                <li key={pr.body} className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => void add(pr.body, pr.category)}
                    className="min-h-8 shrink-0 rounded border border-border px-2 text-ink-secondary hover:border-action hover:text-ink-primary"
                  >
                    ＋
                  </button>
                  <span className="shrink-0 rounded border border-border-subtle px-1 text-[10px] text-ink-muted">
                    {FOCUS_CATEGORY_LABELS[pr.category]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-primary">{pr.body}</span>
                  <Link
                    to={`/library/${pr.sourceSlug}`}
                    className="shrink-0 text-[10px] text-ink-muted underline hover:text-action-strong"
                  >
                    出典
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </div>
  );
}

/** セッション行: 未開始→目標入力 / 進行中→W-L+終了 / 振り返りフォーム。 */
function SessionRow({
  active,
  lastUnreviewed,
  activePoints,
  results,
  onChanged,
}: {
  active: PracticeSession | null;
  lastUnreviewed: PracticeSession | null;
  activePoints: FocusPoint[];
  results: MatchResult[];
  onChanged: () => void;
}) {
  const [goal, setGoal] = useState("");
  const [retroTarget, setRetroTarget] = useState<PracticeSession | null>(null);
  const [focusExec, setFocusExec] = useState("");
  const [selfCheck, setSelfCheck] = useState<"ok" | "blaming" | "">("");
  const [free, setFree] = useState("");
  const [busy, setBusy] = useState(false);

  const resultGoalWarn = goal.trim() !== "" && detectResultGoal(goal);
  const inSession = active ? computeSummary(sessionResults(results, active)) : null;

  const startSession = async () => {
    if (!goal.trim() || busy) return;
    setBusy(true);
    try {
      await sessionProvider.start(goal.trim());
      setGoal("");
      onChanged();
    } catch (e) {
      console.error("[PracticeCard] session start 失敗", e);
    } finally {
      setBusy(false);
    }
  };

  const submitRetro = async () => {
    if (!retroTarget || busy) return;
    setBusy(true);
    try {
      const selfCheckText =
        selfCheck === "ok" ? "責めていない" : selfCheck === "blaming" ? "すこし責めている（切り替える）" : "";
      await sessionProvider.finish(retroTarget.id, composeRetroMd({ focusExec, selfCheck: selfCheckText, free }));
      setRetroTarget(null);
      setFocusExec("");
      setSelfCheck("");
      setFree("");
      onChanged();
    } catch (e) {
      console.error("[PracticeCard] retro 保存失敗", e);
    } finally {
      setBusy(false);
    }
  };

  // 振り返りフォーム（進行中の終了 or 未記入セッションの後書き）
  if (retroTarget) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink-primary">振り返り: {retroTarget.goal || "（目標未設定）"}</p>
        <label className="block text-xs text-ink-secondary">
          意識ポイント（{activePoints.map((p) => p.body).join(" / ") || "未設定"}）はどれだけ実行できた？
          <input
            value={focusExec}
            onChange={(e) => setFocusExec(e.target.value)}
            placeholder="例: 崖2択は5回中3回通せた"
            className="mt-1 w-full min-h-9 rounded border border-border bg-surface-0 px-2 text-sm text-ink-primary focus:border-action focus:outline-none"
          />
        </label>
        <div className="text-xs text-ink-secondary">
          自分を過度に責めていない？
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setSelfCheck("ok")}
              className={`min-h-9 rounded px-3 text-xs ${selfCheck === "ok" ? "bg-action text-white" : "border border-border text-ink-secondary"}`}
            >
              責めていない
            </button>
            <button
              type="button"
              onClick={() => setSelfCheck("blaming")}
              className={`min-h-9 rounded px-3 text-xs ${selfCheck === "blaming" ? "bg-warning text-surface-0" : "border border-border text-ink-secondary"}`}
            >
              すこし責めてる
            </button>
          </div>
        </div>
        <input
          value={free}
          onChange={(e) => setFree(e.target.value)}
          placeholder="ほかに気づいたこと（任意）"
          className="w-full min-h-9 rounded border border-border bg-surface-0 px-2 text-sm text-ink-primary focus:border-action focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void submitRetro()}
            disabled={busy}
            className="min-h-9 rounded bg-action px-3 text-xs font-semibold text-white hover:bg-action-strong disabled:opacity-50"
          >
            保存して終了
          </button>
          <button
            type="button"
            onClick={() => setRetroTarget(null)}
            className="min-h-9 rounded px-2 text-xs text-ink-muted hover:text-ink-primary"
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-frame text-[10px] uppercase tracking-[0.18em] text-action">セッション中</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-primary">{active.goal}</span>
        {inSession ? (
          <span className="shrink-0 font-frame text-xs tabular-nums text-ink-secondary">
            {inSession.wins}-{inSession.losses}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setRetroTarget(active)}
          className="min-h-9 shrink-0 rounded border border-border px-3 text-xs font-medium text-ink-secondary hover:border-action hover:text-ink-primary"
        >
          終了して振り返り
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">セッション</span>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void startSession();
          }}
          placeholder="今日のプロセス目標（例: 崖狩りで2択を通す）"
          className="min-h-9 min-w-0 flex-1 rounded border border-border bg-surface-1 px-2 text-sm text-ink-primary focus:border-action focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void startSession()}
          disabled={!goal.trim() || busy}
          className="min-h-9 shrink-0 rounded bg-action px-3 text-xs font-semibold text-white hover:bg-action-strong disabled:opacity-50"
        >
          開始
        </button>
      </div>
      {resultGoalWarn ? (
        <p className="text-xs text-warning">
          結果目標っぽいです。「今日の行動」に言い換えると効果的（プロセス目標 d=1.36 vs 結果目標 d=0.09）。例:
          「崖狩りで2択を通す」「先行時に攻め急がない」
        </p>
      ) : null}
      {lastUnreviewed ? (
        <p className="text-xs text-ink-muted">
          前回のセッション（{lastUnreviewed.goal || "目標未設定"}）が振り返り未記入です。
          <button
            type="button"
            onClick={() => setRetroTarget(lastUnreviewed)}
            className="ml-1 text-action-strong underline decoration-action/40 hover:decoration-action-strong"
          >
            書く
          </button>
        </p>
      ) : null}
    </div>
  );
}
