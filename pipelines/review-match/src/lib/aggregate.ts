// 検証済み result.json を ai_reviews へ書く形へ集約する（純関数）。
// - scenes[].findings を flatten → id 採番("f1","f2"…)
// - finding.t_sec を該当場面 window に clamp
// - review_status='pending' 付与
// - 語彙外 habit_tag は null 化 + needsReview:true（from-file.ts の流儀）
// - focus_evaluations は focus_point_id が MANIFEST 外なら要素ごと落として警告
import type { RawFocusEvaluation, ResultJson, Situation, MistakeType, Death } from "./schema.js";

export interface AggregateSceneWindow {
  t_sec: number;
  window: { start_sec: number; end_sec: number } | null;
}

export interface AggregateContext {
  sceneWindows: AggregateSceneWindow[]; // MANIFEST の scenes（t_sec と window）
  habitSlugs: Set<string>; // 有効な habit_tag 語彙
  focusPointIds: Set<string>; // MANIFEST の focus_points[].id
}

export interface AggregatedFinding {
  id: string;
  t_sec: number;
  situation: Situation;
  observation: string;
  suggestion: string;
  habit_tag: string | null;
  mistake_type: MistakeType;
  confidence: number;
  review_status: "pending";
  death?: Death;
  needsReview?: true;
}

export interface AggregateOutput {
  findings: AggregatedFinding[];
  summary_md: string;
  one_mistake: string;
  focus_evaluations: RawFocusEvaluation[];
  warnings: string[];
}

function clampToWindow(t: number, window: { start_sec: number; end_sec: number }): number {
  return Math.min(Math.max(t, window.start_sec), window.end_sec);
}

/** result のシーン t_sec に対応する MANIFEST 場面の window を引く。exact→包含→null の順。 */
function findWindow(
  sceneTSec: number,
  ctx: AggregateContext,
): { start_sec: number; end_sec: number } | null {
  const exact = ctx.sceneWindows.find((s) => s.t_sec === sceneTSec && s.window);
  if (exact && exact.window) return exact.window;
  const containing = ctx.sceneWindows.find(
    (s) => s.window && sceneTSec >= s.window.start_sec && sceneTSec <= s.window.end_sec,
  );
  return containing?.window ?? null;
}

export function aggregate(result: ResultJson, ctx: AggregateContext): AggregateOutput {
  const warnings: string[] = [];
  const findings: AggregatedFinding[] = [];
  let counter = 0;

  for (const scene of result.scenes) {
    const window = findWindow(scene.t_sec, ctx);
    if (!window) {
      warnings.push(
        `scene t_sec=${scene.t_sec} に対応する MANIFEST 場面窓が見つからず、findings の t_sec を clamp できません`,
      );
    }
    for (const f of scene.findings) {
      counter++;
      const id = `f${counter}`;
      const tSec = window ? clampToWindow(f.t_sec, window) : f.t_sec;

      let habitTag = f.habit_tag;
      let needsReview: true | undefined;
      if (habitTag !== null && !ctx.habitSlugs.has(habitTag)) {
        warnings.push(`finding ${id}: 語彙外 habit_tag "${habitTag}" を null 化（needsReview）`);
        habitTag = null;
        needsReview = true;
      }

      const finding: AggregatedFinding = {
        id,
        t_sec: tSec,
        situation: f.situation,
        observation: f.observation,
        suggestion: f.suggestion,
        habit_tag: habitTag,
        mistake_type: f.mistake_type,
        confidence: f.confidence,
        review_status: "pending",
        ...(f.death !== undefined ? { death: f.death } : {}),
        ...(needsReview ? { needsReview } : {}),
      };
      findings.push(finding);
    }
  }

  const focus_evaluations: RawFocusEvaluation[] = [];
  for (const e of result.focus_evaluations) {
    if (ctx.focusPointIds.has(e.focus_point_id)) {
      focus_evaluations.push(e);
    } else {
      warnings.push(
        `focus_evaluation focus_point_id=${e.focus_point_id} は MANIFEST の focus_points に無いため除外`,
      );
    }
  }

  return {
    findings,
    summary_md: result.summary_md,
    one_mistake: result.one_mistake,
    focus_evaluations,
    warnings,
  };
}
