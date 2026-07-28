// zoom: prep 済み動画から指定時刻の密バーストを抽出する（ラベリング用。実時刻保持）。
//   npm run zoom -- <video_id> --t <sec> [--fps 10 --span 4 --before 2]
// 出力: <workdir>/bursts/t<sec>/frame_NNN.jpg + index.json。動画が削除済み(submit後)ならエラー案内。
import { access, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BURST_BEFORE, BURST_FPS, BURST_SPAN, WORK_ROOT } from "./config.js";
import { extractBurst } from "./lib/video.js";

interface ZoomArgs {
  videoId: string;
  t: number;
  fps: number;
  span: number;
  before: number;
}

function parseArgs(argv: string[]): ZoomArgs {
  function num(flag: string, def: number): number {
    const i = argv.indexOf(flag);
    if (i === -1) return def;
    const v = Number.parseFloat(argv[i + 1] ?? "");
    if (!Number.isFinite(v)) throw new Error(`${flag} は数値で指定してください`);
    return v;
  }
  const videoId = argv.find((a) => !a.startsWith("--"));
  if (!videoId) throw new Error("使い方: zoom -- <video_id> --t <sec> [--fps 10 --span 4 --before 2]");
  const tIdx = argv.indexOf("--t");
  if (tIdx === -1) throw new Error("--t <sec> は必須です");
  const t = Number.parseFloat(argv[tIdx + 1] ?? "");
  if (!Number.isFinite(t) || t < 0) throw new Error("--t は 0 以上の秒数で指定してください");
  return {
    videoId,
    t,
    fps: num("--fps", BURST_FPS),
    span: num("--span", BURST_SPAN),
    before: num("--before", BURST_BEFORE),
  };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const workdir = join(WORK_ROOT, args.videoId);
  const videoPath = join(workdir, "video.mp4");

  if (!(await fileExists(videoPath))) {
    throw new Error(
      `動画が見つかりません（${videoPath}）。submit 後に削除された可能性があります。` +
        `再ラベリングするには先に prep を再実行してください: npm run prep -- ${args.videoId} --local`,
    );
  }

  const start = Math.max(0, args.t - args.before);
  const label = `t${String(args.t).replace(".", "_")}`;
  const burstDir = join(workdir, "bursts", label);
  console.log(
    `[zoom] ${args.videoId} t=${args.t}s → [${start}, ${start + args.span}]s @${args.fps}fps → bursts/${label}/`,
  );

  // 同一 --t の再実行時に前回の残骸フレームが index.json と食い違うのを防ぐ（W4実測の誤読事例あり）
  await rm(burstDir, { recursive: true, force: true });
  const frames = await extractBurst(videoPath, start, args.span, args.fps, burstDir);
  const index = {
    video_id: args.videoId,
    t_target: args.t,
    start_sec: start,
    span_sec: args.span,
    before_sec: args.before,
    fps: args.fps,
    frames: frames.map((f) => ({
      index: f.index,
      t_sec: f.t_sec,
      path: `bursts/${label}/frame_${String(f.index).padStart(3, "0")}.jpg`,
    })),
  };
  await writeFile(join(burstDir, "index.json"), JSON.stringify(index, null, 2), "utf-8");
  console.log(
    `[zoom] ${frames.length} 枚（t_sec ${frames[0]?.t_sec}〜${frames[frames.length - 1]?.t_sec}）→ ${burstDir}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
