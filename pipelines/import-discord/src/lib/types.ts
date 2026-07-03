// import-discord 中間型。
// Discord REST API v10 のレスポンス形（必要なフィールドのみ）と、
// パイプライン内で受け渡す正規化済み型を定義する。

// ---- Discord REST API v10（部分型） ----

/** GET /guilds/{id}/channels の1要素。type=4 がカテゴリ、type=0 がテキストチャンネル。 */
export interface DiscordChannel {
  id: string;
  type: number; // 0=GUILD_TEXT, 4=GUILD_CATEGORY, 5=ANNOUNCEMENT, ...
  name: string;
  parent_id: string | null; // 所属カテゴリのID（カテゴリ自身は null）
  position?: number;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url?: string;
  content_type?: string;
}

/** GET /channels/{id}/messages の1要素（部分）。 */
export interface DiscordMessage {
  id: string; // snowflake（時刻順にソート可能）
  channel_id?: string;
  content: string;
  timestamp: string; // ISO8601
  edited_timestamp: string | null;
  author: { id: string; username: string; bot?: boolean };
  attachments: DiscordAttachment[];
  type?: number; // 0/19 が通常メッセージ。6=PIN, 7=JOIN 等のシステムは無視
}

// ---- 正規化型（transform で使う） ----

export const CHANNEL_KIND = ["matchup", "own_move", "own_play"] as const;
export type ChannelKind = (typeof CHANNEL_KIND)[number];

/** discord-mapping.csv の1行（チャンネル→ノート属性）。 */
export interface MappingRow {
  channel: string; // チャンネル名（生。⭐等の装飾込み）
  channel_id: string;
  category: string; // 所属カテゴリ名
  kind: ChannelKind;
  character_slug: string; // matchup 時のみ。未解決は空
  move_slug: string; // own_move 時のみ。未解決は空
  starred: string; // "true" | "false"
  note: string; // 未解決理由など（人間向けメモ）
}

// ---- 出力型（notes.json / load.sql 用） ----

export interface OutNoteMedia {
  id: string;
  note_id: string;
  type: "image" | "youtube" | "local_video";
  storage_path: string | null;
  url: string | null;
  caption: string | null;
}

export interface OutNote {
  id: string;
  kind: "own_play" | "own_move" | "matchup" | "player";
  character_id: string | null;
  move_id: string | null;
  player_name: string | null;
  title: string | null;
  body_md: string;
  section: string | null;
  starred: boolean;
  pinned: boolean;
  tags: string[];
  source: "discord_import";
  media: OutNoteMedia[];
  // 由来メタ（監査用。DB列ではない。load 時は落とす）
  _channel: string;
  _channel_id: string;
}
