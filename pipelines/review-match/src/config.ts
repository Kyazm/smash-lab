// review-match 設定。パス規約・場面窓・フレーム抽出・dedup の定数を一元管理する。
// restructure-notes の config.ts 踏襲（MAIN_REPO_ENV_PATH 規約 / .context 出力）。ADR-0019 / docs/13。
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// pipelines/review-match/src → リポジトリ直下（このworktree）
export const REPO_ROOT = join(__dirname, "..", "..", "..");

// メインリポジトリ（worktreeには .env / 共有 .context が無いため絶対パスで参照する）。
// 処理フローは常にメインリポジトリで Claude Code を開いて行う（plan §4）ため、
// 作業ディレクトリ（Claude がフレームを Read する場所）も MAIN_REPO_ROOT 基準にして取り違いを防ぐ。
export const MAIN_REPO_ROOT = "/Users/matsumotokazuki/Desktop/work/smash-lab";
export const MAIN_REPO_ENV_PATH = `${MAIN_REPO_ROOT}/.env`;

// 作業ディレクトリのルート: <repo>/.context/review-match/
//   prep    → <root>/<review_id>/
//   dry-run → <root>/dry-run-<videoId>/
export const WORK_DIR = join(MAIN_REPO_ROOT, ".context", "review-match");

// ai_reviews.model に書く値（intel_requests の 'running' 語彙とは合わせず 'processing' を採用：ADR-0019）
export const REVIEW_MODEL = "claude-code";

// MANIFEST.json の methodology_ref に埋める参照
export const METHODOLOGY_REF = "docs/13_match-review.md";

// ---- 場面窓（death review は撃墜の −25s〜+5s に集中）----
export const SCENE_PRE_SEC = 25;
export const SCENE_POST_SEC = 5;

// ---- フレーム抽出（crv 既定値）----
export const SCENE_THRESHOLD = 0.3; // ffmpeg select gt(scene,X)
export const FRAME_WIDTH = 640; // scale=640:-1（≈307tok/枚）
export const FRAME_FLOOR_SEC = 1.0; // 密度フロア: 最低1枚/秒（EVERY_N=round(fps*これ)）

// ---- dedup（crv 手法移植。%表示等の小面積変化が落ちすぎる場合は dry-run で調整）----
export const MAX_FRAMES_PER_SCENE = 24; // 超過は時間軸均等間引き
export const DEDUP_RATIO = 0.08; // 採用に必要な「変化画素率」の下限（8%）
export const DEDUP_PIXEL_DIFF = 25; // 1画素が変化と判定されるチャネル差
export const DEDUP_WINDOW = 4; // 直近何枚の採用フレームと比較するか
export const DEDUP_THUMB_SIZE = 16; // 16x16 RGB = 768byte/枚

// ---- 冪等性 ----
export const STALE_PROCESSING_MIN = 60; // --retry-stale が対象にする processing 経過分
