// メモ機能のDB行型（supabase/migrations/0001_schema.sql の notes / note_media に対応）。
// フレームデータ側の型（../../types.ts）とは独立。snake_case 列で定義する。

export type NoteKind = "own_play" | "own_move" | "matchup" | "player" | "own_match";

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

// ── AI整頓の提案・承認（ADR-0010 / supabase/migrations/0002_note_proposals.sql）──

export type NoteProposalStatus = "pending" | "accepted" | "rejected" | "stale";

export interface NoteProposal {
  id: string;
  note_id: string;
  proposed_body_md: string;
  change_summary: string | null;
  engine: string | null;
  /** 生成時点の notes.updated_at。承認時にこれと現在値を照合する楽観ロック用 */
  base_updated_at: string;
  status: NoteProposalStatus;
  created_at: string;
}

/** apply_note_proposal RPC の返り値。stale の場合は元メモが編集されたため再生成が必要。 */
export type ApplyProposalResult = "accepted" | "stale";

// ── 承認待ち一覧（docs/07 F-A）: note_proposals を notes/characters にJOINした表示用行 ──

/** /proposals 一覧の1行。pending/stale の提案を、対象メモ・対象キャラの表示情報と一緒に返す。 */
export interface PendingProposalItem {
  proposal: NoteProposal;
  noteTitle: string | null;
  kind: NoteKind;
  /** matchup/player等 character_id を持つノートのみ非null。own系(own_play/own_move/own_match)はnull */
  characterName: string | null;
  characterSlug: string | null;
}
