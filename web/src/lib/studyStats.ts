// プレイヤー研究の集計（docs/14_player-study.md ⑤分母規則・⑪統計表示）。全て純関数。
// 分母規則（凍結・docs/14 ⑤）: confidence>=0.6 かつ action!=='unknown' のみを統計の分母にする。
// 除外分は件数だけ別バケット（「判別不能・低確度」）として見せ、統計には混ぜない。
import type {
  StudyInteractionWithVideo,
  StudySituation,
} from "../data/study/types";
import { STUDY_SITUATIONS } from "../data/study/types";

// ---------------------------------------------------------------------------
// Wilson score interval
// ---------------------------------------------------------------------------

/** 95%信頼区間の z 値（標準正規分布の 97.5 パーセンタイル）。 */
export const Z_95 = 1.959963984540054;

export interface WilsonInterval {
  /** 区間下限 0..1 */
  lower: number;
  /** 区間上限 0..1 */
  upper: number;
  /** Wilson の中心（標本比率をnで正則化した値。p̂ とは一致しない） */
  center: number;
  /** 標本比率 successes/n（n=0 は 0） */
  point: number;
}

/**
 * Wilson score interval（95%既定）。
 * 「サンプルが少なくても当てになる幅で割合を見積もる統計手法」。単純な正規近似と違い、
 * successes=0 や n が小さい時でも区間が [0,1] を飛び出さず、極端な値で破綻しない。
 *
 * n=0 は情報ゼロなので [0,1]（＝何も言えない）を返す。
 */
export function wilsonInterval(successes: number, n: number, z: number = Z_95): WilsonInterval {
  if (n <= 0) return { lower: 0, upper: 1, center: 0, point: 0 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    center,
    point: p,
  };
}

// ---------------------------------------------------------------------------
// 分母規則（docs/14 ⑤）
// ---------------------------------------------------------------------------

/** 統計の分母に入れる最小confidence（docs/14 ⑤で凍結）。 */
export const MIN_CONFIDENCE = 0.6;

/** docs/14 ⑤: confidence>=0.6 かつ action!=='unknown' なら統計の分母に入れる。confidence未記録は除外側。 */
export function isCountable(row: StudyInteractionWithVideo): boolean {
  if (row.action === "unknown") return false;
  if (row.confidence == null) return false;
  return row.confidence >= MIN_CONFIDENCE;
}

export interface CountableSplit {
  /** 統計の分母に入る行。 */
  counted: StudyInteractionWithVideo[];
  /** 判別不能（action='unknown'）・低確度（confidence<0.6）で除外された行。 */
  excluded: StudyInteractionWithVideo[];
}

/** 分母規則で2バケットに分ける。UI は excluded.length を「判別不能・低確度 N件」として別表示する。 */
export function splitByCountable(rows: StudyInteractionWithVideo[]): CountableSplit {
  const counted: StudyInteractionWithVideo[] = [];
  const excluded: StudyInteractionWithVideo[] = [];
  for (const r of rows) (isCountable(r) ? counted : excluded).push(r);
  return { counted, excluded };
}

// ---------------------------------------------------------------------------
// フィルタ
// ---------------------------------------------------------------------------

export interface StudyFilter {
  /** null=全場面 */
  situation: StudySituation | null;
  /** null=全キャラ（study_interactions.opp_char の正準日本語名） */
  oppChar: string | null;
  /** null=全プレイヤー（study_videos.studied_player） */
  player: string | null;
}

export const EMPTY_STUDY_FILTER: StudyFilter = { situation: null, oppChar: null, player: null };

/** situation/oppChar/player の絞り込み（分母規則は別関数。順序は入力のまま保持）。 */
export function applyStudyFilter(
  rows: StudyInteractionWithVideo[],
  filter: StudyFilter,
): StudyInteractionWithVideo[] {
  return rows.filter((r) => {
    if (filter.situation && r.situation !== filter.situation) return false;
    if (filter.oppChar && r.opp_char !== filter.oppChar) return false;
    if (filter.player && r.video.studied_player !== filter.player) return false;
    return true;
  });
}

/** 件数付きの選択肢（フィルタチップのバッジ用）。件数降順→値の昇順。 */
export interface FacetOption {
  value: string;
  count: number;
}

function toFacet(counts: Map<string, number>): FacetOption[] {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "ja"));
}

/** 相手キャラ別の件数（opp_char が null の行は数えない）。 */
export function oppCharFacets(rows: StudyInteractionWithVideo[]): FacetOption[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.opp_char) continue;
    counts.set(r.opp_char, (counts.get(r.opp_char) ?? 0) + 1);
  }
  return toFacet(counts);
}

/** 研究対象プレイヤー別の件数（現状Marssのみだが将来増える）。 */
export function playerFacets(rows: StudyInteractionWithVideo[]): FacetOption[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const p = r.video.studied_player;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return toFacet(counts);
}

/** 場面別の件数。9種すべてのキーを必ず持つ（該当なしは0）。 */
export function situationCounts(
  rows: StudyInteractionWithVideo[],
): Record<StudySituation, number> {
  const out = {} as Record<StudySituation, number>;
  for (const s of STUDY_SITUATIONS) out[s] = 0;
  for (const r of rows) {
    if (r.situation in out) out[r.situation] += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 集計
// ---------------------------------------------------------------------------

/** n<10 は参考値扱い（docs/14 ⑪「n<10の場面は参考値表示にとどめる」）。 */
export const REFERENCE_N_THRESHOLD = 10;

/** n が参考値水準（<10）かどうか。 */
export function isReferenceOnly(n: number): boolean {
  return n < REFERENCE_N_THRESHOLD;
}

export interface OutcomeTally {
  won: number;
  lost: number;
  even: number;
  /** won+lost+even（=対象件数）。 */
  total: number;
  /** 勝率 won/(won+lost+even)。total=0 は 0。 */
  winRate: number;
  /** 勝率のWilson 95%信頼区間。 */
  winRateCi: WilsonInterval;
  /** kill=true の件数。 */
  kills: number;
}

/** outcome/kill を数え、勝率とその信頼区間を付ける。 */
export function tallyOutcomes(rows: StudyInteractionWithVideo[]): OutcomeTally {
  let won = 0;
  let lost = 0;
  let even = 0;
  let kills = 0;
  for (const r of rows) {
    if (r.outcome === "won") won += 1;
    else if (r.outcome === "lost") lost += 1;
    else even += 1;
    if (r.kill) kills += 1;
  }
  const total = won + lost + even;
  return {
    won,
    lost,
    even,
    total,
    winRate: total === 0 ? 0 : won / total,
    winRateCi: wilsonInterval(won, total),
    kills,
  };
}

export interface ActionStat extends OutcomeTally {
  action: string;
  /** この行動の件数（= total）。 */
  n: number;
  /** 使用率 n/（同一分母の総件数）。 */
  share: number;
  /** 使用率のWilson 95%信頼区間。 */
  shareCi: WilsonInterval;
  /** 表示用の実データ（タップでギャラリーに渡す）。t_sec昇順で保持。 */
  rows: StudyInteractionWithVideo[];
}

export interface ActionDistribution {
  /** 分母（分母規則を通した件数）。 */
  total: number;
  /** 使用率降順→件数降順→slug昇順。 */
  actions: ActionStat[];
}

/**
 * action別の分布。渡す rows は分母規則（splitByCountable の counted）を通した後のものを想定する。
 * share の信頼区間は「この分母の中でその行動が選ばれる割合」に対する Wilson 95%CI。
 */
export function actionDistribution(rows: StudyInteractionWithVideo[]): ActionDistribution {
  const byAction = new Map<string, StudyInteractionWithVideo[]>();
  for (const r of rows) {
    const list = byAction.get(r.action);
    if (list) list.push(r);
    else byAction.set(r.action, [r]);
  }
  const total = rows.length;
  const actions: ActionStat[] = [];
  for (const [action, list] of byAction) {
    const tally = tallyOutcomes(list);
    const n = list.length;
    actions.push({
      ...tally,
      action,
      n,
      share: total === 0 ? 0 : n / total,
      shareCi: wilsonInterval(n, total),
      rows: sortForGallery(list),
    });
  }
  actions.sort((a, b) => b.share - a.share || b.n - a.n || a.action.localeCompare(b.action));
  return { total, actions };
}

export interface SituationStat extends OutcomeTally {
  situation: StudySituation;
  /** 分母に入った件数（= total）。 */
  n: number;
  /** 分母規則で除外された件数（判別不能・低確度）。 */
  excluded: number;
  /** n<10 なら参考値（docs/14 ⑪）。 */
  reference: boolean;
}

/**
 * 場面別サマリ。counted/excluded は同じフィルタを通した同じ母集合から作った2バケットを渡す。
 * 9種すべてを返す（該当0の場面もUI上で「まだデータなし」と分かるようにするため）。
 */
export function situationSummaries(
  counted: StudyInteractionWithVideo[],
  excluded: StudyInteractionWithVideo[],
): SituationStat[] {
  const countedBy = new Map<StudySituation, StudyInteractionWithVideo[]>();
  for (const r of counted) {
    const list = countedBy.get(r.situation);
    if (list) list.push(r);
    else countedBy.set(r.situation, [r]);
  }
  const excludedCounts = situationCounts(excluded);
  return STUDY_SITUATIONS.map((situation) => {
    const list = countedBy.get(situation) ?? [];
    const tally = tallyOutcomes(list);
    return {
      ...tally,
      situation,
      n: list.length,
      excluded: excludedCounts[situation],
      reference: isReferenceOnly(list.length),
    };
  });
}

/**
 * ギャラリー表示順（docs/14 ⑪「t_sec昇順」）。
 * 複数動画が混ざるため、動画→ゲーム→t_sec の複合キーにして「1セット内で時系列」になるようにする。
 */
export function sortForGallery(rows: StudyInteractionWithVideo[]): StudyInteractionWithVideo[] {
  return [...rows].sort(
    (a, b) =>
      a.video.video_id.localeCompare(b.video.video_id) ||
      a.game_index - b.game_index ||
      a.t_sec - b.t_sec,
  );
}

/** 0..1 を「42%」形式に整形（表示専用ヘルパ）。 */
export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
