// メモ機能のDB行型（supabase/migrations/0001_schema.sql の notes / note_media に対応）。
// フレームデータ側の型（../../types.ts）とは独立。snake_case 列で定義する。

export type NoteKind = "own_play" | "own_move" | "matchup" | "player";

// キャラ対テンプレートのセクション分類（任意）。docs/02 データモデル notes.section。
export type NoteSection =
  | "neutral"
  | "disadvantage"
  | "edgeguard"
  | "projectile"
  | "stage"
  | "tldr";

export type NoteSource = "discord_import" | "manual" | "intel_adopted";

export type NoteMediaType = "image" | "youtube" | "local_video";

export interface Note {
  id: string;
  kind: NoteKind;
  /** matchup/player時=相手キャラID, own_play/own_move時=null */
  character_id: string | null;
  /** own_move時=対象技ID */
  move_id: string | null;
  /** player時=プレイヤー名 */
  player_name: string | null;
  title: string | null;
  body_md: string | null;
  section: NoteSection | null;
  starred: boolean;
  /** TL;DR用。true はキャラ対ページ冒頭に固定表示 */
  pinned: boolean;
  tags: string[];
  source: NoteSource;
  created_at: string;
  updated_at: string;
}

export interface NoteMedia {
  id: string;
  note_id: string;
  type: NoteMediaType;
  /** image（Supabase Storage）用。モック時は DataURL を格納 */
  storage_path: string | null;
  /** youtube / local_video 用 */
  url: string | null;
  caption: string | null;
}

/** ノート本体 + 紐づくメディア（UI表示単位） */
export interface NoteWithMedia extends Note {
  media: NoteMedia[];
}

/** ノート新規作成の入力。id/timestamps は provider が採番。source は manual 固定（手動作成）。 */
export type NoteCreateInput = Omit<
  Note,
  "id" | "created_at" | "updated_at" | "source"
> & {
  source?: NoteSource;
};

/** ノート更新の入力（部分更新）。id 以外は任意。 */
export type NoteUpdateInput = Partial<
  Omit<Note, "id" | "created_at" | "updated_at">
>;

/** メディア追加の入力。id は provider が採番。 */
export type NoteMediaCreateInput = Omit<NoteMedia, "id">;

/** notes 一覧のフィルタ条件。指定した項目のみ AND で絞り込む。 */
export interface NoteQuery {
  kind?: NoteKind;
  character_id?: string | null;
  move_id?: string | null;
  starred?: boolean;
  pinned?: boolean;
}
