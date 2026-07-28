import { describe, expect, it } from "vitest";
import type {
  StudyInteractionWithVideo,
  StudyOutcome,
  StudySituation,
  StudyVideo,
} from "../data/study/types";
import {
  actionDistribution,
  applyStudyFilter,
  isCountable,
  isReferenceOnly,
  oppCharFacets,
  playerFacets,
  situationCounts,
  situationSummaries,
  sortForGallery,
  splitByCountable,
  tallyOutcomes,
  wilsonInterval,
} from "./studyStats";

// --- fixtures ---------------------------------------------------------------

function video(overrides: Partial<StudyVideo> = {}): StudyVideo {
  return {
    id: "v-uuid-1",
    video_id: "aaaaaaaaaaa",
    title: "Marss vs X",
    tournament: "Test Major",
    round: "Winners",
    studied_player: "Marss",
    studied_char: "ゼロスーツサムス",
    opp_player: "X",
    played_on: "2026-07-01",
    status: "done",
    needs_review: false,
    ...overrides,
  };
}

let seq = 0;
interface RowOverrides {
  situation?: StudySituation;
  action?: string;
  outcome?: StudyOutcome;
  confidence?: number | null;
  kill?: boolean;
  oppChar?: string | null;
  tSec?: number;
  gameIndex?: number;
  video?: StudyVideo;
}

function row(o: RowOverrides = {}): StudyInteractionWithVideo {
  seq += 1;
  const v = o.video ?? video();
  return {
    id: `i-${seq}`,
    video_ref: v.id,
    game_index: o.gameIndex ?? 1,
    t_sec: o.tSec ?? seq,
    opp_char: o.oppChar === undefined ? "スネーク" : o.oppChar,
    situation: o.situation ?? "neutral",
    sub_situation: null,
    action: o.action ?? "aerial",
    action_detail: null,
    outcome: o.outcome ?? "won",
    kill: o.kill ?? false,
    confidence: o.confidence === undefined ? 0.8 : o.confidence,
    frame_path: `study/${v.video_id}/${seq}.jpg`,
    line: null,
    note: null,
    created_at: "2026-07-01T00:00:00Z",
    video: v,
  };
}

// --- wilsonInterval ---------------------------------------------------------

describe("wilsonInterval", () => {
  // 既知値: Wilson score interval の公表値（95%、小数4桁）と突き合わせる。
  it("1/10 は (0.0179, 0.4042)", () => {
    const ci = wilsonInterval(1, 10);
    expect(ci.lower).toBeCloseTo(0.0179, 4);
    expect(ci.upper).toBeCloseTo(0.4042, 4);
    expect(ci.point).toBeCloseTo(0.1, 10);
  });

  it("5/10 は (0.2366, 0.7634) で中心=0.5（対称）", () => {
    const ci = wilsonInterval(5, 10);
    expect(ci.lower).toBeCloseTo(0.2366, 4);
    expect(ci.upper).toBeCloseTo(0.7634, 4);
    expect(ci.center).toBeCloseTo(0.5, 10);
  });

  it("0/10 は下限0にクランプされ上限は0.2775（正規近似の幅0とは違い潰れない）", () => {
    const ci = wilsonInterval(0, 10);
    expect(ci.lower).toBe(0);
    expect(ci.upper).toBeCloseTo(0.2775, 4);
  });

  it("10/10 は上限1（超えない）で下限は0.7225", () => {
    const ci = wilsonInterval(10, 10);
    expect(ci.lower).toBeCloseTo(0.7225, 4);
    expect(ci.upper).toBeCloseTo(1, 10);
    expect(ci.upper).toBeLessThanOrEqual(1);
  });

  it("50/100 は 10/100 より幅が広い（同じ比率でもnが増えると幅は狭まる）", () => {
    const small = wilsonInterval(5, 10);
    const large = wilsonInterval(50, 100);
    expect(large.upper - large.lower).toBeLessThan(small.upper - small.lower);
  });

  it("n=0 は情報ゼロなので [0,1] を返す（ゼロ除算しない）", () => {
    const ci = wilsonInterval(0, 0);
    expect(ci).toEqual({ lower: 0, upper: 1, center: 0, point: 0 });
  });

  it("区間は常に [0,1] に収まる", () => {
    for (const [s, n] of [
      [0, 1],
      [1, 1],
      [1, 2],
      [3, 4],
      [99, 100],
    ] as const) {
      const ci = wilsonInterval(s, n);
      expect(ci.lower).toBeGreaterThanOrEqual(0);
      expect(ci.upper).toBeLessThanOrEqual(1);
      expect(ci.lower).toBeLessThanOrEqual(ci.upper);
    }
  });
});

// --- 分母規則（docs/14 ⑤） --------------------------------------------------

describe("isCountable / splitByCountable", () => {
  it("confidence>=0.6 かつ action!=='unknown' のみ分母に入る", () => {
    expect(isCountable(row({ confidence: 0.6 }))).toBe(true);
    expect(isCountable(row({ confidence: 0.59 }))).toBe(false);
    expect(isCountable(row({ action: "unknown", confidence: 0.9 }))).toBe(false);
    expect(isCountable(row({ confidence: null }))).toBe(false);
  });

  it("2バケットに分割し、合計は元件数と一致する", () => {
    const rows = [
      row({ confidence: 0.9 }),
      row({ confidence: 0.3 }),
      row({ action: "unknown", confidence: 0.95 }),
      row({ confidence: 0.6 }),
    ];
    const { counted, excluded } = splitByCountable(rows);
    expect(counted).toHaveLength(2);
    expect(excluded).toHaveLength(2);
    expect(counted.length + excluded.length).toBe(rows.length);
  });
});

// --- フィルタ ---------------------------------------------------------------

describe("applyStudyFilter", () => {
  const marss = video({ id: "v1", video_id: "vidvidvid1", studied_player: "Marss" });
  const other = video({ id: "v2", video_id: "vidvidvid2", studied_player: "Zackray" });
  const rows = [
    row({ video: marss, situation: "neutral", oppChar: "スネーク" }),
    row({ video: marss, situation: "edgeguard", oppChar: "スネーク" }),
    row({ video: marss, situation: "neutral", oppChar: "シュルク" }),
    row({ video: other, situation: "neutral", oppChar: "スネーク" }),
  ];

  it("全nullなら素通し", () => {
    expect(applyStudyFilter(rows, { situation: null, oppChar: null, player: null })).toHaveLength(4);
  });

  it("situation で絞る", () => {
    const r = applyStudyFilter(rows, { situation: "edgeguard", oppChar: null, player: null });
    expect(r).toHaveLength(1);
    expect(r[0].situation).toBe("edgeguard");
  });

  it("相手キャラとプレイヤーの複合条件はAND", () => {
    const r = applyStudyFilter(rows, { situation: null, oppChar: "スネーク", player: "Marss" });
    expect(r).toHaveLength(2);
  });
});

describe("facets", () => {
  it("相手キャラ別件数は降順、opp_char=null は数えない", () => {
    const rows = [
      row({ oppChar: "スネーク" }),
      row({ oppChar: "スネーク" }),
      row({ oppChar: "シュルク" }),
      row({ oppChar: null }),
    ];
    expect(oppCharFacets(rows)).toEqual([
      { value: "スネーク", count: 2 },
      { value: "シュルク", count: 1 },
    ]);
  });

  it("プレイヤー別件数は動画メタから数える", () => {
    const a = video({ id: "v1", studied_player: "Marss" });
    const b = video({ id: "v2", studied_player: "Zackray" });
    expect(playerFacets([row({ video: a }), row({ video: a }), row({ video: b })])).toEqual([
      { value: "Marss", count: 2 },
      { value: "Zackray", count: 1 },
    ]);
  });

  it("場面別件数は10種すべてのキーを持つ", () => {
    const counts = situationCounts([row({ situation: "landing" }), row({ situation: "landing" })]);
    expect(counts.landing).toBe(2);
    expect(counts.neutral).toBe(0);
    expect(Object.keys(counts)).toHaveLength(10);
  });
});

// --- 集計 -------------------------------------------------------------------

describe("tallyOutcomes", () => {
  it("勝率は won/(won+lost+even)、kill は独立に数える", () => {
    const rows = [
      row({ outcome: "won", kill: true }),
      row({ outcome: "won" }),
      row({ outcome: "lost", kill: true }),
      row({ outcome: "even" }),
    ];
    const t = tallyOutcomes(rows);
    expect(t).toMatchObject({ won: 2, lost: 1, even: 1, total: 4, kills: 2 });
    expect(t.winRate).toBeCloseTo(0.5, 10);
  });

  it("空配列は total=0 / winRate=0（ゼロ除算しない）", () => {
    const t = tallyOutcomes([]);
    expect(t.total).toBe(0);
    expect(t.winRate).toBe(0);
    expect(t.winRateCi).toEqual({ lower: 0, upper: 1, center: 0, point: 0 });
  });
});

describe("actionDistribution", () => {
  const rows = [
    row({ action: "aerial", outcome: "won" }),
    row({ action: "aerial", outcome: "lost" }),
    row({ action: "aerial", outcome: "won", kill: true }),
    row({ action: "grab", outcome: "even" }),
  ];

  it("使用率降順で並び、share の合計は1", () => {
    const d = actionDistribution(rows);
    expect(d.total).toBe(4);
    expect(d.actions.map((a) => a.action)).toEqual(["aerial", "grab"]);
    expect(d.actions[0].share).toBeCloseTo(0.75, 10);
    expect(d.actions.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1, 10);
  });

  it("行動ごとに勝率・撃墜数・信頼区間を持つ", () => {
    const aerial = actionDistribution(rows).actions[0];
    expect(aerial.n).toBe(3);
    expect(aerial.kills).toBe(1);
    expect(aerial.winRate).toBeCloseTo(2 / 3, 10);
    expect(aerial.shareCi.lower).toBeLessThan(aerial.share);
    expect(aerial.shareCi.upper).toBeGreaterThan(aerial.share);
  });

  it("空配列は total=0・actions空（分母0でも壊れない）", () => {
    expect(actionDistribution([])).toEqual({ total: 0, actions: [] });
  });

  it("各行動の rows はギャラリー順（動画→ゲーム→t_sec）で保持される", () => {
    const v1 = video({ id: "v1", video_id: "aaaaaaaaaaa" });
    const v2 = video({ id: "v2", video_id: "bbbbbbbbbbb" });
    const d = actionDistribution([
      row({ action: "smash", video: v2, gameIndex: 1, tSec: 10 }),
      row({ action: "smash", video: v1, gameIndex: 2, tSec: 5 }),
      row({ action: "smash", video: v1, gameIndex: 1, tSec: 99 }),
    ]);
    expect(d.actions[0].rows.map((r) => [r.video.video_id, r.game_index, r.t_sec])).toEqual([
      ["aaaaaaaaaaa", 1, 99],
      ["aaaaaaaaaaa", 2, 5],
      ["bbbbbbbbbbb", 1, 10],
    ]);
  });
});

describe("situationSummaries", () => {
  it("10種すべて返し、除外件数を場面別に持つ", () => {
    const counted = [
      row({ situation: "edgeguard", outcome: "won" }),
      row({ situation: "edgeguard", outcome: "lost" }),
    ];
    const excluded = [row({ situation: "edgeguard", action: "unknown", confidence: 0.4 })];
    const summaries = situationSummaries(counted, excluded);
    expect(summaries).toHaveLength(10);
    const eg = summaries.find((s) => s.situation === "edgeguard")!;
    expect(eg.n).toBe(2);
    expect(eg.excluded).toBe(1);
    expect(eg.winRate).toBeCloseTo(0.5, 10);
    const neutral = summaries.find((s) => s.situation === "neutral")!;
    expect(neutral.n).toBe(0);
    expect(neutral.excluded).toBe(0);
  });

  it("n<10 は参考値フラグが立つ（docs/14 ⑪）", () => {
    const nine = Array.from({ length: 9 }, () => row({ situation: "neutral" }));
    const ten = Array.from({ length: 10 }, () => row({ situation: "landing" }));
    const summaries = situationSummaries([...nine, ...ten], []);
    expect(summaries.find((s) => s.situation === "neutral")!.reference).toBe(true);
    expect(summaries.find((s) => s.situation === "landing")!.reference).toBe(false);
  });
});

describe("isReferenceOnly", () => {
  it("閾値は10件（9=参考値 / 10=通常）", () => {
    expect(isReferenceOnly(9)).toBe(true);
    expect(isReferenceOnly(10)).toBe(false);
  });
});

describe("sortForGallery", () => {
  it("入力配列を破壊しない", () => {
    const rows = [row({ tSec: 30 }), row({ tSec: 10 })];
    const before = rows.map((r) => r.id);
    sortForGallery(rows);
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});
