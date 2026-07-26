// クリーンアップ対象パス算出（純関数）。submit 成功時に workdir を丸ごと削除する（動画・scan・
// bursts・MANIFEST 全部。ユーザーのストレージ要件 / ADR-0020）。
// 誤って WORK_ROOT 自身や外側を消さないための安全ガードを内包する。
import { join, resolve } from "node:path";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * <workRoot>/<videoId> を返す（純関数）。videoId が YouTube 11桁ID の書式でない、または
 * パス区切り/親参照を含む場合は例外（安全ガード）。返り値は必ず workRoot 配下。
 */
export function computeCleanupPath(workRoot: string, videoId: string): string {
  if (!VIDEO_ID_RE.test(videoId)) {
    throw new Error(`computeCleanupPath: 不正な video_id "${videoId}"（11桁の YouTube ID のみ許可）`);
  }
  const target = resolve(join(workRoot, videoId));
  const rootResolved = resolve(workRoot);
  // target は必ず rootResolved の真下でなければならない
  if (target === rootResolved || !target.startsWith(rootResolved + "/")) {
    throw new Error(`computeCleanupPath: 算出パスが workRoot 配下でない: ${target}`);
  }
  return target;
}
