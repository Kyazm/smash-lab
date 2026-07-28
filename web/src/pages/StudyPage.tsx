// プレイヤー研究の統計ページ「/study」（docs/14_player-study.md ⑪統計表示）。
// トッププレイヤー（初期対象: Marss/ZSS）の場面別行動分布を、Wilson 95%信頼区間付きで閲覧する。
// オーナー専用: 0011_player_study.sql の RLS が select も is_writer() 限定のため、ゲストは読めない。
// ReviewListPage と同じく、ゲストはガード文言のみ表示しフックを一切マウントしない
//（条件付きフック呼び出しを避けるためオーナー側を別コンポーネントに分離する）。
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useIsGuest } from "../lib/guestContext";
import { useStudy } from "../hooks/useStudy";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { dataProvider } from "../data";
import {
  STUDY_SITUATIONS,
  STUDY_SITUATION_HINTS,
  STUDY_SITUATION_LABELS,
  studyActionLabel,
} from "../data/study/types";
import {
  actionDistribution,
  applyStudyFilter,
  EMPTY_STUDY_FILTER,
  MIN_CONFIDENCE,
  oppCharFacets,
  playerFacets,
  REFERENCE_N_THRESHOLD,
  situationCounts,
  situationSummaries,
  splitByCountable,
  type StudyFilter,
} from "../lib/studyStats";
import { StudyFilterBar } from "../components/study/StudyFilterBar";
import { ActionDistributionBars, SituationSummaryList } from "../components/study/StudyCharts";
import { StudyGallery } from "../components/study/StudyGallery";
import type { Character } from "../types";

const PLAYER_ELEMENT_ID = "yt-study-player";

function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl p-4">{children}</div>;
}

export function StudyPage() {
  const isGuest = useIsGuest();
  return isGuest ? <StudyGuestNotice /> : <StudyPageOwner />;
}

function StudyGuestNotice() {
  return (
    <PageShell>
      <h1 className="font-display text-2xl tracking-wide text-ink-primary">研究</h1>
      <p className="mt-2 text-sm text-ink-secondary">オーナー専用機能。ゲストでは利用できません。</p>
      <p className="mt-1 text-sm text-ink-muted">
        トッププレイヤーの試合動画を場面ごとにラベリングし、「この場面ではどの択を選んでいるか」を
        スクショ根拠付きで集計するページです。
      </p>
    </PageShell>
  );
}

/** 初出の専門用語の1行説明（ユーザー標準要求）。既定は畳んでおき、必要な時だけ開く。 */
function Glossary() {
  return (
    <details className="rounded border border-border-subtle bg-surface-1 p-3">
      <summary className="min-h-11 cursor-pointer list-none text-xs font-medium text-ink-secondary hover:text-ink-primary">
        用語の説明（初めて見るときはここから）
      </summary>
      <dl className="mt-2 space-y-2 text-xs">
        <div>
          <dt className="font-medium text-ink-primary">使用率</dt>
          <dd className="text-ink-muted">
            その場面で数えた全記録のうち、その行動が選ばれた割合。バーの長さがこれ。
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink-primary">Wilson 95%信頼区間（CI）</dt>
          <dd className="text-ink-muted">
            サンプルが少なくても当てになる幅で割合を見積もる統計手法。幅が狭いほど信頼できる。
            バー下の細い帯が範囲で、「本当の割合はこの範囲に入っていそう」を表す。
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink-primary">参考値（n&lt;{REFERENCE_N_THRESHOLD}）</dt>
          <dd className="text-ink-muted">
            記録が{REFERENCE_N_THRESHOLD}件未満。傾向の目安にとどめ、断定には使わない（薄く表示）。
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink-primary">判別不能・低確度</dt>
          <dd className="text-ink-muted">
            動画から行動を特定できなかった記録（判別不能）と、確度が{MIN_CONFIDENCE}
            未満の記録。統計の分母から外し、件数だけ別に出す。
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink-primary">勝敗（勝ち／負け／五分）</dt>
          <dd className="text-ink-muted">
            <span className="font-medium text-ink-secondary">
              セットや試合の勝敗ではなく、読み合い1回ごとの勝敗
            </span>
            。研究対象プレイヤー視点で、
            その読み合いの直後にダメージか位置の優位を取ったら「勝ち」、取られたら「負け」、互角なら「五分」。
            撃墜したかどうかは別バッジ（不利な状況からの一発逆転は「負け＋撃墜」もありうる）。
          </dd>
        </div>
        <div>
          <dt className="font-medium text-ink-primary">場面（9種）</dt>
          <dd className="text-ink-muted">
            <ul className="mt-1 space-y-1">
              {STUDY_SITUATIONS.map((s) => (
                <li key={s}>
                  <span className="font-medium text-ink-secondary">
                    {STUDY_SITUATION_LABELS[s]}
                  </span>
                  ＝{STUDY_SITUATION_HINTS[s]}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </details>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-1 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">{title}</p>
        {aside}
      </div>
      {children}
    </section>
  );
}

function StudyPageOwner() {
  const { data, error, reload } = useStudy();
  const [filter, setFilter] = useState<StudyFilter>(EMPTY_STUDY_FILTER);
  /** true=分母規則を外して全件を統計に入れる（docs/14 ⑤のトグル）。 */
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [active, setActive] = useState<{ videoId: string; tSec: number } | null>(null);
  const [charByName, setCharByName] = useState<Map<string, Character>>(new Map());

  useEffect(() => {
    let cancelled = false;
    dataProvider
      .listCharacters()
      .then((list) => {
        // opp_char は正準日本語名で入る（pipelines/player-study の char-normalize）。名前でアイコンを引く。
        if (!cancelled) setCharByName(new Map(list.map((c) => [c.name_ja, c])));
      })
      .catch((e) => {
        console.error("[StudyPage] listCharacters 失敗", e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const all = useMemo(() => data?.interactions ?? [], [data]);

  // 場面サマリ・場面チップの件数は「場面フィルタを外した母集合」で出す
  // （場面を選んでも他の場面へ切り替えられるようにするため）。
  const scoped = useMemo(() => applyStudyFilter(all, { ...filter, situation: null }), [all, filter]);
  const scopedSplit = useMemo(() => splitByCountable(scoped), [scoped]);
  const summaries = useMemo(
    () =>
      includeExcluded
        ? situationSummaries(scoped, [])
        : situationSummaries(scopedSplit.counted, scopedSplit.excluded),
    [includeExcluded, scoped, scopedSplit],
  );

  // 行動分布・ギャラリーは場面フィルタも効かせた母集合。
  const filtered = useMemo(() => applyStudyFilter(all, filter), [all, filter]);
  const { counted, excluded } = useMemo(() => splitByCountable(filtered), [filtered]);
  const statRows = includeExcluded ? filtered : counted;
  const distribution = useMemo(() => actionDistribution(statRows), [statRows]);

  const situationChipCounts = useMemo(() => situationCounts(scoped), [scoped]);
  const oppFacets = useMemo(
    () => oppCharFacets(applyStudyFilter(all, { ...filter, oppChar: null })),
    [all, filter],
  );
  const players = useMemo(
    () => playerFacets(applyStudyFilter(all, { ...filter, player: null })),
    [all, filter],
  );

  // フィルタや分母規則が変わったら選択中の行動を解除（存在しない行動が選ばれたままになるのを防ぐ）。
  useEffect(() => {
    setSelectedAction(null);
  }, [filter, includeExcluded]);

  const galleryRows = useMemo(
    () => distribution.actions.find((a) => a.action === selectedAction)?.rows ?? [],
    [distribution, selectedAction],
  );

  // --- YouTube プレイヤー（動画をまたいで貼り替える） ---
  // useYouTubePlayer は videoId 変更時に destroy → 再生成するが、YT API は対象divをiframeに置換するため
  // Reactが管理する要素をそのまま使い回せない。Reactが子を持たないホストdivを用意し、
  // マウント先divだけを毎回自前で作り直す（この effect は useYouTubePlayer より先に宣言する必要がある。
  // React は「全effectのcleanup → 全effectのsetup」の順に走るので、destroy 後・Player生成前にdivが用意される）。
  const hostRef = useRef<HTMLDivElement>(null);
  const activeVideoId = active?.videoId ?? null;
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !activeVideoId) return;
    host.replaceChildren();
    const el = document.createElement("div");
    el.id = PLAYER_ELEMENT_ID;
    host.appendChild(el);
  }, [activeVideoId]);

  const player = useYouTubePlayer(PLAYER_ELEMENT_ID, activeVideoId);

  useEffect(() => {
    if (!player || !active) return;
    player.seekTo(active.tSec, true);
    player.playVideo();
  }, [player, active]);

  const totalRaw = filtered.length;

  return (
    <PageShell>
      {/* 動画ジャンプ用プレイヤー。カードをタップするまでは場所を取らない。
          ギャラリーを深くスクロールした位置からタップしても必ず画面の上に見えるよう、
          sticky でなく fixed で画面上部に固定する（スクロール位置・マウント順に依存しない）。 */}
      {active ? (
        <div className="fixed inset-x-0 top-0 z-40 border-b border-border-subtle bg-surface-0 shadow-lg">
          <div className="mx-auto max-w-5xl px-4 pb-2 pt-2">
            {/* YT API はマウント先divをiframeに置換しclassNameを引き継がないため、
                生成されたiframeを親の aspect-video に合わせる（子セレクタで上書き）。
                高さは画面を占有しすぎないよう 40vh を上限にする。 */}
            <div
              ref={hostRef}
              className="mx-auto aspect-video max-h-[40vh] w-full max-w-2xl [&>iframe]:h-full [&>iframe]:w-full"
            />
            <button
              type="button"
              onClick={() => setActive(null)}
              className="mt-1 min-h-9 text-xs text-ink-muted hover:text-ink-primary"
            >
              プレイヤーを閉じる
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl tracking-wide text-ink-primary">研究</h1>
        <button
          type="button"
          onClick={reload}
          className="min-h-9 rounded bg-surface-2 px-3 text-xs font-medium text-ink-secondary hover:text-ink-primary"
        >
          再取得
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        トッププレイヤーの試合から「この場面で何を選んでいるか」を数えたもの。
        {data ? `　${data.videos.length}セット / ${all.length}件の記録` : null}
      </p>

      {error ? <p className="mt-3 text-sm text-danger">読み込みエラー: {error}</p> : null}

      {data === null ? (
        <p className="mt-4 text-sm text-ink-muted">読み込み中…</p>
      ) : all.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">
          まだ研究データがありません。Mac側の player-study パイプラインでラベリング済みのセットを投入すると
          ここに集計が出ます。
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <Glossary />

          <Section title="絞り込み">
            <StudyFilterBar
              filter={filter}
              onChange={setFilter}
              situationCounts={situationChipCounts}
              oppFacets={oppFacets}
              playerFacets={players}
              charByName={charByName}
            />
          </Section>

          {/* 分母規則の可視化（docs/14 ⑤）。除外件数を必ず見せ、全件表示にも切り替えられるようにする。 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-xs">
            <span className="text-ink-secondary">
              統計対象{" "}
              <span className="font-frame tabular-nums text-ink-primary">
                {includeExcluded ? totalRaw : counted.length}
              </span>
              件
            </span>
            <span className="text-ink-muted">
              除外{" "}
              <span className="font-frame tabular-nums">{excluded.length}</span>件（内訳:
              行動を特定できず{" "}
              <span className="font-frame tabular-nums">
                {excluded.filter((it) => it.action === "unknown").length}
              </span>
              件・確度&lt;{MIN_CONFIDENCE}{" "}
              <span className="font-frame tabular-nums">
                {excluded.filter((it) => it.action !== "unknown").length}
              </span>
              件）{includeExcluded ? "→ いま分母に含めて表示中" : ""}
            </span>
            <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 text-ink-secondary">
              <input
                type="checkbox"
                checked={includeExcluded}
                onChange={(e) => setIncludeExcluded(e.target.checked)}
                className="h-4 w-4 accent-[rgb(var(--color-action))]"
              />
              全件を分母に含める
            </label>
          </div>

          {/* 場面別サマリ（目次）と行動分布（選択場面の内訳）は親子関係。
              縦長対策で lg 以上は横並び2カラムにする（モバイルは従来どおり縦積み）。 */}
          <div className="grid items-start gap-3 lg:grid-cols-2">
            <Section
              title="場面別サマリ"
              aside={
                <span className="text-[10px] text-ink-muted">
                  行をタップで右の行動分布を絞り込み（{REFERENCE_N_THRESHOLD}件未満は参考値）
                </span>
              }
            >
              <SituationSummaryList
                summaries={summaries}
                selected={filter.situation}
                onSelect={(s) => setFilter((f) => ({ ...f, situation: s }))}
              />
            </Section>

            <Section
              title={`行動分布 — ${
                filter.situation ? STUDY_SITUATION_LABELS[filter.situation] : "全場面"
              }（分母 ${distribution.total}件）`}
              aside={
                <span className="text-[10px] text-ink-muted">行動をタップでスクショと動画へ</span>
              }
            >
              <ActionDistributionBars
                distribution={distribution}
                selectedAction={selectedAction}
                onSelect={setSelectedAction}
              />
            </Section>
          </div>

          {selectedAction ? (
            <Section
              title={`場面ギャラリー — ${studyActionLabel(selectedAction)}（${galleryRows.length}件）`}
              aside={
                <button
                  type="button"
                  onClick={() => setSelectedAction(null)}
                  className="min-h-9 rounded bg-surface-2 px-2 text-[10px] font-medium text-ink-secondary hover:text-ink-primary"
                >
                  閉じる
                </button>
              }
            >
              <StudyGallery
                rows={galleryRows}
                charByName={charByName}
                onSeek={(videoId, tSec) => setActive({ videoId, tSec })}
              />
            </Section>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
