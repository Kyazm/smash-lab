// player-study 設定。パス規約・収集・フレーム抽出・アンカー・グリッド・バーストの定数を一元管理する。
// review-match / restructure-notes の config.ts 踏襲（MAIN_REPO_ENV_PATH 規約 / .context 出力）。ADR-0020 / docs/14。
// 各しきい値は「調整前提」の暫定値（pilot-then-freeze）。過検出は許容し、Claude セッションが検証する設計。
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// pipelines/player-study/src → リポジトリ直下（このworktree）
export const REPO_ROOT = join(__dirname, "..", "..", "..");

// メインリポジトリ（worktreeには .env / 共有 .context が無いため絶対パスで参照する）。
// 処理フローは常にメインリポジトリで Claude Code を開いて行うため、作業ディレクトリも MAIN_REPO_ROOT 基準にする。
export const MAIN_REPO_ROOT = "/Users/matsumotokazuki/Desktop/work/smash-lab";
export const MAIN_REPO_ENV_PATH = `${MAIN_REPO_ROOT}/.env`;

// 作業ルート: <repo>/.context/player-study/
//   collect のHTMLキャッシュ → <root>/catalog-cache/<hash>.html
//   collect --dry の出力      → <root>/catalog-dry-<player>-<char>.json
//   prep の作業Dir           → <root>/<video_id>/ （video.mp4 / scan/ / bursts/ / MANIFEST.json）
export const WORK_ROOT = join(MAIN_REPO_ROOT, ".context", "player-study");
export const CATALOG_CACHE_DIR = join(WORK_ROOT, "catalog-cache");

// ---- smash-tube 収集 ----
export const SMASH_TUBE_BASE = "https://smash-tube.com/result";
export const SMASH_TUBE_REFERER = "https://smash-tube.com/";
// 素の fetch は 403。ブラウザ相当の UA を必須にする（調査済み: この UA + Referer で 200）。
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
export const REQUEST_DELAY_MS = 2000; // 1リクエスト2秒以上あける

// ---- ダウンロード ----
export const MAX_HEIGHT = 480; // yt-dlp: bv*[height<=480]+ba/b[height<=480]/best

// ---- スキャンリール（場面窓の位置特定専用。技の判別はしない）----
export const SCAN_FPS = 1;
export const GRID_ROWS = 3;
export const GRID_COLS = 3;
export const CELL_WIDTH = 480; // グリッド各セル幅（アスペクト維持）
// dedup（review-match の frames.ts 流用。scan は緩め設定にして場面の取り逃しを防ぐ）
export const DEDUP_PIXEL_DIFF = 25; // 1画素が変化と判定されるチャネル差
export const DEDUP_THUMB_SIZE = 16; // 16x16 RGB = 768byte/枚
export const DEDUP_WINDOW = 4; // 直近何枚の採用フレームと比較するか
export const SCAN_DEDUP_RATIO = 0.05; // 採用に必要な変化画素率の下限（緩め=5%）

// ---- ストック変化アンカー（撃墜の決定論検出。過検出許容）----
// 各1fpsフレームのHUD帯（下部中央: 幅20〜80%・高さ76〜96%）を 32x8 に縮小し、隣接秒との差分率で変化秒を拾う。
// ROIを中央帯に絞る理由: %表示・ストックは下部中央寄りの左右パネルにあり、全幅帯だと
// 両端のフェイスカム・観客席の動きが差分を支配して過検出になる（下記実測）。
// [W1 実測] Marss VS SKZohar (e76F_fDNjf8, 14分) では下端25%全幅帯の隣接差分の
// 中央値が ~0.55 と高く、閾値をどこに置いても秒の 5〜80% が反応する（撃墜と分離できない）。原因は
// 全幅帯が観客席・ステージ・選手フェイスカムの動きを大量に含むため。実 HUD（名前/%/ストック）は
// [W1 実測v3・結論] ストックアンカーは**既定OFF**（ANCHOR_ENABLED=false）。
// 経緯: 全幅帯→中央帯→ストックアイコン極小ROI(P1: x0.235-0.335 / P2: x0.615-0.715, y0.945-0.995)と
// 絞り込んだが、アイコン周囲の背景（ステージ床）がカメラパンで毎秒変化し、隣接秒差分の中央値が0.70に達する
// （e76F_fDNjf8 実測: p50=0.70 p90=0.95）。閾値でKO（アイコン消失）を分離するのは不可能と判断。
// KO特定はスキャングリッドのClaude目視（撃墜エフェクト・リスポーン演出は数秒映るため1fpsで確実に写る）に委ねる。
// 将来の再挑戦の方向: 隣接差分でなく「時間的に持続する変化」（前後N秒の窓平均の比較）または
// アイコンのテンプレートマッチ。W2以降に必要性が確認されてから（docs/14参照）。
export interface AnchorRoi {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
export const ANCHOR_ENABLED = false; // 上記実測により既定OFF（グリッド目視で代替）
export const ANCHOR_ROIS: AnchorRoi[] = [
  { x0: 0.235, x1: 0.335, y0: 0.945, y1: 0.995 }, // P1 ストックアイコン行
  { x0: 0.615, x1: 0.715, y0: 0.945, y1: 0.995 }, // P2 ストックアイコン行
];
export const ANCHOR_THUMB_W = 32;
export const ANCHOR_THUMB_H = 8;
export const ANCHOR_PIXEL_TOL = 24; // 変化と判定するチャネル差（%表示のちらつきに耐える）
export const ANCHOR_DIFF_THRESHOLD = 0.18; // 隣接秒で変化した画素の割合がこれ超で候補（調整前提）

// ---- 密バースト（ラベリング用。実時刻保持）----
export const BURST_FPS = 10;
export const BURST_SPAN = 4; // 秒
export const BURST_BEFORE = 2; // t-before から開始

// ---- Storage（ADR-0012 / ADR-0020: note-media を public-read で流用、study/ プレフィックス）----
export const STORAGE_BUCKET = "note-media";
export const STORAGE_PREFIX = "study";

// docs 参照（MANIFEST / output_contract に埋め込む）
export const METHODOLOGY_REF = "docs/14_player-study.md";
