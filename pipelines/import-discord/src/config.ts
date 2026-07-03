// import-discord 設定。対象カテゴリ・ギルドID・出力パスを一元管理する。
// docs/02「Discord移行」/ docs/01 F8 に対応。
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// pipelines/import-discord/src → リポジトリ直下
export const REPO_ROOT = join(__dirname, "..", "..", "..");

// 出力先（すべて .context/ 以下。gitignore 済み）
export const EXPORT_DIR = join(REPO_ROOT, ".context", "discord-export");
export const ATTACHMENTS_DIR = join(EXPORT_DIR, "attachments");
export const RAW_META_PATH = join(EXPORT_DIR, "_channels.json"); // カテゴリ構造+対象チャンネル一覧
export const MAPPING_CSV = join(REPO_ROOT, ".context", "discord-mapping.csv");
export const IMPORT_DIR = join(REPO_ROOT, ".context", "discord-import");
export const NOTES_JSON = join(IMPORT_DIR, "notes.json");
export const LOAD_SQL = join(IMPORT_DIR, "load.sql");

// 参照データ（import-framedata の出力）
export const CHARACTERS_JSON = join(REPO_ROOT, "data", "imported", "characters.json");
export const MOVES_JSON = join(REPO_ROOT, "data", "imported", "moves.json");

// 対象ギルド（ユーザーの Discord サーバー）
export const GUILD_ID = "958661372592418838";

// ZSS（自キャラ）の slug。own_move / own_play ノートの character_id は NULL、
// own_move ノートは move_id（ZSS の技）を持つ。
export const ZSS_SLUG = "zero_suit_samus";

// 対象カテゴリの判定ルール（設定で変更可能）。
// - matchupPattern: このパターンにマッチするカテゴリ名は「キャラ対策」カテゴリとして扱い、
//   配下チャンネルは kind=matchup（チャンネル名からキャラ突合）。
// - ownMoveCategories: 配下チャンネルは kind=own_move（チャンネル名から ZSS の技を突合）。
// - ownPlayCategories: 配下チャンネルは kind=own_play。
export interface TargetConfig {
  matchupPattern: RegExp;
  ownMoveCategories: string[];
  ownPlayCategories: string[];
}

export const TARGET_CONFIG: TargetConfig = {
  // 「64キャラ対策」「DXキャラ対策」等、末尾が「キャラ対策」のカテゴリすべて
  matchupPattern: /キャラ対策$/,
  ownMoveCategories: ["ゼロサム技"],
  ownPlayCategories: ["ゼロサムについて", "スマブラ基本"],
};

// カテゴリ分類の結果種別
export type CategoryKind = "matchup" | "own_move" | "own_play";

/** カテゴリ名から種別を判定する。対象外なら null。 */
export function classifyCategory(
  categoryName: string,
  cfg: TargetConfig = TARGET_CONFIG,
): CategoryKind | null {
  const name = categoryName.trim();
  if (cfg.matchupPattern.test(name)) return "matchup";
  if (cfg.ownMoveCategories.includes(name)) return "own_move";
  if (cfg.ownPlayCategories.includes(name)) return "own_play";
  return null;
}
