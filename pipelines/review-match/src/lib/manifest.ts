// MANIFEST.json の型・組み立て・出力契約の埋め込み。docs/13 のスキーマ契約が正。
import { METHODOLOGY_REF } from "../config.js";
import { MISTAKE_TYPES, SITUATIONS, VERDICTS } from "./schema.js";
import type { PlannedScene } from "./scenes.js";

export interface HabitTag {
  slug: string;
  label: string;
}

// docs/13 の 15語（既存12語 + ADR-0019で追加した3語）。env未設定の dry-run で DB を読めない時のフォールバック。
export const HABIT_TAGS_FALLBACK: HabitTag[] = [
  { slug: "ledge_getup", label: "崖上がり" },
  { slug: "jump", label: "飛び" },
  { slug: "shield", label: "ガード" },
  { slug: "spacing_move", label: "置き技" },
  { slug: "edgeguard", label: "復帰阻止" },
  { slug: "landing", label: "着地" },
  { slug: "throw_mixup", label: "投げ択" },
  { slug: "op_management", label: "OP管理" },
  { slug: "recovery", label: "復帰" },
  { slug: "neutral", label: "ニュートラル" },
  { slug: "dash_dance", label: "ダッシュ管理" },
  { slug: "tech_chase", label: "受け身狩り" },
  { slug: "combo_escape", label: "コンボ抜け" },
  { slug: "self_destruct", label: "暴発・自滅" },
  { slug: "percent_management", label: "%管理" },
];

export interface FocusPoint {
  id: string;
  body: string;
  category: string;
}

export interface ManifestSceneFrame {
  path: string; // MANIFEST からの相対パス（frames/scene_<i>/frame_<n>.jpg）
  t_sec: number; // 実時刻
}

export interface ManifestScene {
  index: number;
  t_sec: number;
  label?: string;
  window: { start_sec: number; end_sec: number } | null;
  skipped?: string;
  frames: ManifestSceneFrame[];
}

export interface Manifest {
  review_id: string;
  video: { url: string; videoId: string; duration_sec: number };
  request: {
    opponent_character: { id: string | null; name: string | null };
    mode: string | null;
    result: string | null;
    memo: string | null;
  };
  scenes: ManifestScene[];
  focus_points: FocusPoint[];
  habit_tags: HabitTag[];
  output_contract: unknown;
  methodology_ref: string;
}

/**
 * result.json の期待形状と enum 値を MANIFEST に埋め込む（Claude Code がこれを見て result.json を書く）。
 * docs/13 の JSONスキーマ契約と一致させること。
 */
export function buildOutputContract(): unknown {
  return {
    description:
      "各場面(frames を時刻順に Read)ごとに findings を作り、全体で summary_md / one_mistake / focus_evaluations を書く。作業ディレクトリに result.json として保存する。",
    shape: {
      scenes: [
        {
          t_sec: "number（MANIFEST の該当 scene.t_sec に一致させる）",
          findings: [
            {
              t_sec: "number（その気づきが起きた実時刻。場面 window 内）",
              situation: SITUATIONS.join(" | "),
              observation: "string（何が起きたか）",
              suggestion: "string（次はどうするか）",
              habit_tag: "habit_tags の slug または null（語彙外は submit が null 化）",
              mistake_type: MISTAKE_TYPES.join(" | "),
              confidence: "number 0.0〜1.0",
              death: {
                _optional: "撃墜シーンのみ。それ以外は省略",
                stock: "number",
                kill_move: "string",
                initiating_action: "string（撃墜1〜3手前の起点行動）",
              },
            },
          ],
          scene_summary: "string（その場面のまとめ）",
        },
      ],
      summary_md: "string（全場面まとめ Markdown）",
      one_mistake: "string（One-Mistake Rule。直すべき最頻・最高インパクトのミス1文）",
      focus_evaluations: [
        {
          focus_point_id: "string（MANIFEST.focus_points[].id のいずれか。外れる要素は submit が除外）",
          verdict: VERDICTS.join(" | "),
          evidence: "string",
        },
      ],
    },
    submit_notes:
      "submit が id を採番('f1','f2'…)し、t_sec を場面 window に clamp し、review_status='pending' を付与する。手で採番しないこと。",
  };
}

export interface BuildManifestInput {
  review_id: string;
  video: { url: string; videoId: string; duration_sec: number };
  request: Manifest["request"];
  scenes: PlannedScene[];
  framesByScene: Map<number, ManifestSceneFrame[]>;
  focus_points: FocusPoint[];
  habit_tags: HabitTag[];
}

/** PlannedScene + 割当済みフレームから MANIFEST を組み立てる（純関数）。 */
export function buildManifest(input: BuildManifestInput): Manifest {
  const scenes: ManifestScene[] = input.scenes.map((s) => ({
    index: s.index,
    t_sec: s.t_sec,
    ...(s.label !== undefined ? { label: s.label } : {}),
    window: s.window,
    ...(s.skipped !== undefined ? { skipped: s.skipped } : {}),
    frames: input.framesByScene.get(s.index) ?? [],
  }));

  return {
    review_id: input.review_id,
    video: input.video,
    request: input.request,
    scenes,
    focus_points: input.focus_points,
    habit_tags: input.habit_tags,
    output_contract: buildOutputContract(),
    methodology_ref: METHODOLOGY_REF,
  };
}
