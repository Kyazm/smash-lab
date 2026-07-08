// 動画取得〜フレーム抽出〜dedup〜MANIFEST 生成の決定論オーケストレーション（prep / dry-run 共通）。
// LLM 呼び出しは含まない。純関数（scenes/frames）と IO（video）を結線する薄い層。
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  FRAME_FLOOR_SEC,
  MAX_FRAMES_PER_SCENE,
} from "../config.js";
import { dedupFrames, thinUniform } from "./frames.js";
import {
  buildManifest,
  type FocusPoint,
  type HabitTag,
  type Manifest,
  type ManifestSceneFrame,
} from "./manifest.js";
import {
  assignFramesToScenes,
  planScenes,
  type FrameRef,
  type TimestampInput,
} from "./scenes.js";
import {
  computeEveryN,
  downloadSection,
  extractFrames,
  getFps,
  thumbnailSequence,
} from "./video.js";

export interface BuildWorkspaceInput {
  review_id: string;
  workDir: string; // <root>/<review_id> または <root>/dry-run-<videoId>
  video: { url: string; videoId: string; duration_sec: number };
  timestamps: TimestampInput[];
  request: Manifest["request"];
  focus_points: FocusPoint[];
  habit_tags: HabitTag[];
}

export interface BuildWorkspaceResult {
  manifestPath: string;
  totalFrames: number;
  perScene: Array<{ index: number; t_sec: number; frameCount: number; skipped?: string; sampleTSecs: number[] }>;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** yt-dlp が拡張子を変えても拾えるよう、セグメントディレクトリの動画ファイルを解決する。 */
async function resolveSegmentFile(segDir: string, preferred: string): Promise<string> {
  const files = await readdir(segDir);
  const base = "segment.";
  const hit = files.find((f) => f.startsWith(base));
  if (hit) return join(segDir, hit);
  return preferred; // 存在しなければ後続の extract で例外化
}

export async function buildWorkspace(input: BuildWorkspaceInput): Promise<BuildWorkspaceResult> {
  const framesDir = join(input.workDir, "frames");
  const tmpDir = join(input.workDir, "_work");
  await mkdir(framesDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });

  const plan = planScenes(input.timestamps, input.video.duration_sec);

  // ---- 各セグメント: 区間DL → 抽出 → サムネイル。フレームは実時刻付きで集約 ----
  const allRefs: FrameRef[] = [];
  const thumbByPath = new Map<string, Uint8Array>();

  for (let k = 0; k < plan.segments.length; k++) {
    const seg = plan.segments[k];
    const segDir = join(tmpDir, `seg_${k}`);
    const rawDir = join(segDir, "raw");
    await mkdir(rawDir, { recursive: true });

    const preferred = join(segDir, "segment.mp4");
    await downloadSection(input.video.url, seg.start_sec, seg.end_sec, preferred);
    const segFile = await resolveSegmentFile(segDir, preferred);

    const fps = await getFps(segFile);
    const everyN = computeEveryN(fps, FRAME_FLOOR_SEC);
    const extracted = await extractFrames(segFile, rawDir, everyN, seg.end_sec - seg.start_sec);
    const thumbs = await thumbnailSequence(rawDir, extracted.length);

    extracted.forEach((ef, i) => {
      const tSec = seg.start_sec + ef.ptsTime;
      allRefs.push({ path: ef.path, tSec });
      thumbByPath.set(ef.path, thumbs[i]);
    });
  }

  // ---- フレームを場面へ割当（重複窓は複数場面に再配分）----
  const byScene = assignFramesToScenes(plan.scenes, allRefs);

  // ---- 場面ごとに dedup → 上限間引き → frames/scene_<i>/ へ配置 ----
  const framesByScene = new Map<number, ManifestSceneFrame[]>();
  const perScene: BuildWorkspaceResult["perScene"] = [];
  let totalFrames = 0;

  for (const scene of plan.scenes) {
    if (!scene.window) {
      perScene.push({
        index: scene.index,
        t_sec: scene.t_sec,
        frameCount: 0,
        skipped: scene.skipped,
        sampleTSecs: [],
      });
      framesByScene.set(scene.index, []);
      continue;
    }
    const refs = byScene.get(scene.index) ?? [];
    const manifestFrames: ManifestSceneFrame[] = [];

    if (refs.length > 0) {
      const thumbs = refs.map((r) => thumbByPath.get(r.path)!);
      const keepIdx = dedupFrames(thumbs, refs.map((r) => ({ tSec: r.tSec })));
      const keptRefs = keepIdx.map((i) => refs[i]);
      const cappedRefs = thinUniform(keptRefs, MAX_FRAMES_PER_SCENE);

      const sceneDir = join(framesDir, `scene_${scene.index}`);
      await mkdir(sceneDir, { recursive: true });
      for (let n = 0; n < cappedRefs.length; n++) {
        const rel = `frames/scene_${scene.index}/frame_${n + 1}.jpg`;
        await copyFile(cappedRefs[n].path, join(input.workDir, rel));
        manifestFrames.push({ path: rel, t_sec: round2(cappedRefs[n].tSec) });
      }
    }

    framesByScene.set(scene.index, manifestFrames);
    totalFrames += manifestFrames.length;
    perScene.push({
      index: scene.index,
      t_sec: scene.t_sec,
      frameCount: manifestFrames.length,
      sampleTSecs: manifestFrames.slice(0, 5).map((f) => f.t_sec),
    });
  }

  // ---- MANIFEST 書き出し ----
  const manifest = buildManifest({
    review_id: input.review_id,
    video: input.video,
    request: input.request,
    scenes: plan.scenes,
    framesByScene,
    focus_points: input.focus_points,
    habit_tags: input.habit_tags,
  });
  const manifestPath = join(input.workDir, "MANIFEST.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  // ---- 中間ファイル掃除（frames/ と MANIFEST.json のみ残す）----
  await rm(tmpDir, { recursive: true, force: true });

  return { manifestPath, totalFrames, perScene };
}
