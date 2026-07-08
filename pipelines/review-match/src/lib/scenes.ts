// 場面窓の計算・重複窓のマージ・抽出フレームの場面再割当（すべて純関数）。
// death review は撃墜の −25s〜+5s に集中する（docs/13）。
import { SCENE_POST_SEC, SCENE_PRE_SEC } from "../config.js";

export interface TimestampInput {
  t_sec: number;
  label?: string;
}

export interface SceneWindow {
  start_sec: number;
  end_sec: number;
}

export interface PlannedScene {
  index: number; // リクエスト順（0始まり）
  t_sec: number;
  label?: string;
  window: SceneWindow | null; // t>duration 等でスキップ時は null
  skipped?: string; // スキップ理由
}

export interface Segment {
  start_sec: number;
  end_sec: number;
  sceneIndices: number[]; // このセグメントに含まれる場面 index
}

export interface ScenePlan {
  scenes: PlannedScene[];
  segments: Segment[];
}

/** 単一タイムスタンプの窓を計算する。t>duration はスキップ（理由付き）。 */
export function computeWindow(tSec: number, duration: number): SceneWindow | { skipped: string } {
  if (!Number.isFinite(tSec) || tSec < 0) {
    return { skipped: `不正なタイムスタンプ (${tSec})` };
  }
  if (duration > 0 && tSec > duration) {
    return { skipped: `t=${tSec}s は動画長 ${duration}s を超過` };
  }
  const start = Math.max(0, tSec - SCENE_PRE_SEC);
  const end = duration > 0 ? Math.min(duration, tSec + SCENE_POST_SEC) : tSec + SCENE_POST_SEC;
  return { start_sec: start, end_sec: end };
}

/**
 * タイムスタンプ群から場面窓とダウンロード用セグメント（重複窓をマージ）を計画する。
 * scenes はリクエスト順を保つ。segments は start_sec 昇順、重複/隣接窓を1つに統合。
 */
export function planScenes(timestamps: TimestampInput[], duration: number): ScenePlan {
  const scenes: PlannedScene[] = timestamps.map((ts, index) => {
    const w = computeWindow(ts.t_sec, duration);
    if ("skipped" in w) {
      return { index, t_sec: ts.t_sec, label: ts.label, window: null, skipped: w.skipped };
    }
    return { index, t_sec: ts.t_sec, label: ts.label, window: w };
  });

  const valid = scenes
    .filter((s): s is PlannedScene & { window: SceneWindow } => s.window !== null)
    .slice()
    .sort((a, b) => a.window.start_sec - b.window.start_sec);

  const segments: Segment[] = [];
  for (const s of valid) {
    const last = segments[segments.length - 1];
    if (last && s.window.start_sec <= last.end_sec) {
      // 重複または隣接 → マージ
      last.end_sec = Math.max(last.end_sec, s.window.end_sec);
      last.sceneIndices.push(s.index);
    } else {
      segments.push({
        start_sec: s.window.start_sec,
        end_sec: s.window.end_sec,
        sceneIndices: [s.index],
      });
    }
  }

  return { scenes, segments };
}

export interface FrameRef {
  path: string;
  tSec: number;
}

/**
 * 抽出フレームを、window に tSec が含まれる場面すべてへ割り当てる（純関数）。
 * 重複窓のマージで1回だけDLしたセグメントのフレームを、各場面へ tSec で再配分する。
 * 返り値: sceneIndex → その場面に属するフレーム（tSec 昇順）。
 */
export function assignFramesToScenes(
  scenes: PlannedScene[],
  frames: FrameRef[],
): Map<number, FrameRef[]> {
  const byScene = new Map<number, FrameRef[]>();
  for (const scene of scenes) {
    if (!scene.window) continue;
    const w = scene.window;
    const hit = frames
      .filter((f) => f.tSec >= w.start_sec && f.tSec <= w.end_sec)
      .sort((a, b) => a.tSec - b.tSec);
    byScene.set(scene.index, hit);
  }
  return byScene;
}
