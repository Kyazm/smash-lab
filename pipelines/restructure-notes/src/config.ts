// restructure-notes 設定。対象・出力パス・モデル名を一元管理する。
// docs/06_ui-redesign.md「キャラ対メモのAI整頓（ADR-0010）」/ ADR-0010 に対応。
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// pipelines/restructure-notes/src → リポジトリ直下（このworktree）
export const REPO_ROOT = join(__dirname, "..", "..", "..");

// メインリポジトリ（worktreeには .env / 共有 .context が存在しないため絶対パスで参照する）
export const MAIN_REPO_ROOT = "/Users/matsumotokazuki/Desktop/work/smash-lab";
export const MAIN_REPO_ENV_PATH = `${MAIN_REPO_ROOT}/.env`;

// 対象ノートのエクスポート先（生成素材。Claudeエージェント等が読む。メインリポジトリ側 .context）
export const NOTES_EXPORT_PATH = `${MAIN_REPO_ROOT}/.context/restructure-src/notes-export.json`;

// --from-file モードで note_proposals.engine に入れる値
export const FROM_FILE_ENGINE = "claude-manual";

// dry-run 出力先（.context/ 以下。gitignore 済み想定）
export const DRY_RUN_DIR = join(REPO_ROOT, ".context", "restructure-notes-dry-run");

// 対象ノートの kind（own系はチャンネル由来の構造が保たれているため対象外：ADR-0010）
export const TARGET_KIND = "matchup";

// Gemini モデル（利用可能な最新 flash 系）
export const GEMINI_MODEL = "gemini-2.5-flash";
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

// dry-run で生成する件数
export const DRY_RUN_SAMPLE_SIZE = 3;
