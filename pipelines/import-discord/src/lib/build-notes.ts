// マッピング行 + チャンネルメッセージ → OutNote[]（純関数）。
// docs/02 移行手順に従う:
//   - 同一チャンネル = 1 ノート（連続メッセージを日付見出しで統合）
//   - matchup: character_id=相手キャラ, move_id=NULL
//   - own_move: character_id=NULL, move_id=ZSS の技（未解決なら own_play にフォールバック）
//   - own_play: character_id=NULL, move_id=NULL
//   - ⭐ → starred=true
//   - 添付画像 → note_media(type=image), 動画 → note_media(type=local_video)
//   - source=discord_import（notes への「一度きり移行」。intel の自動書込禁止(ADR-0004)とは別物）
import type { MappingRow, OutNote, OutNoteMedia, DiscordMessage } from "./types.js";
import { mergeChannelMessages, isImageAttachment } from "./merge-messages.js";
import { uuidv5 } from "./uuid.js";

export interface CharacterRef {
  id: string;
  slug: string;
  name_ja: string;
  name_en?: string;
}
export interface MoveRef {
  id: string;
  slug: string;
  character_id: string;
}

export interface BuildNotesInput {
  mapping: MappingRow[];
  /** channel_id → その channel の生メッセージ配列 */
  messagesByChannel: Map<string, DiscordMessage[]>;
  characters: CharacterRef[];
  /** ZSS の技（slug → id 解決用） */
  zssMoves: MoveRef[];
}

export interface BuildNotesResult {
  notes: OutNote[];
  warnings: string[];
}

export function buildNotes(input: BuildNotesInput): BuildNotesResult {
  const { mapping, messagesByChannel, characters, zssMoves } = input;
  const charBySlug = new Map(characters.map((c) => [c.slug, c]));
  const moveBySlug = new Map(zssMoves.map((m) => [m.slug, m]));
  const warnings: string[] = [];
  const notes: OutNote[] = [];

  for (const row of mapping) {
    const messages = messagesByChannel.get(row.channel_id) ?? [];
    const merged = mergeChannelMessages(messages);
    if (merged.messageCount === 0) {
      warnings.push(`#${row.channel} は投稿0件のためスキップ`);
      continue;
    }

    let kind: OutNote["kind"] = "own_play";
    let character_id: string | null = null;
    let move_id: string | null = null;

    if (row.kind === "matchup") {
      kind = "matchup";
      if (row.character_slug) {
        const c = charBySlug.get(row.character_slug);
        if (c) character_id = c.id;
        else warnings.push(`#${row.channel}: character_slug '${row.character_slug}' が characters に無い`);
      } else {
        warnings.push(`#${row.channel}: matchup だが character_slug 未記入。character_id=NULL で投入`);
      }
    } else if (row.kind === "own_move") {
      if (row.move_slug) {
        const m = moveBySlug.get(row.move_slug);
        if (m) {
          kind = "own_move";
          move_id = m.id;
        } else {
          warnings.push(`#${row.channel}: move_slug '${row.move_slug}' が ZSS の技に無い → own_play 扱い`);
          kind = "own_play";
        }
      } else {
        // 技未解決 → own_play フォールバック（docs: 技カテゴリ配下でも技特定不能なものは立ち回りメモ）
        kind = "own_play";
      }
    } else {
      kind = "own_play";
    }

    const noteId = uuidv5(`note:${row.channel_id}`);
    const media: OutNoteMedia[] = merged.attachments.map((a) => {
      const isImg = isImageAttachment(a.filename, a.contentType);
      return {
        id: uuidv5(`media:${a.attachmentId}`),
        note_id: noteId,
        // 画像 → Supabase Storage(image)、それ以外(動画等) → ローカル保管(local_video)
        type: isImg ? "image" : "local_video",
        // 実パスは load.ts が確定（Storage アップロード後 / ローカルディレクトリ）。
        // ここでは attachment 参照キーをプレースホルダとして持たせる。
        storage_path: isImg ? `discord/${a.attachmentId}_${a.filename}` : null,
        url: isImg ? null : `attachment://${a.attachmentId}/${a.filename}`,
        caption: a.filename,
      };
    });

    const title = deriveTitle(row, character_id ? charBySlug.get(row.character_slug) : undefined);

    notes.push({
      id: noteId,
      kind,
      character_id,
      move_id,
      player_name: null,
      title,
      body_md: merged.bodyMd,
      section: null,
      starred: row.starred.toLowerCase() === "true",
      pinned: false,
      tags: [],
      source: "discord_import",
      media,
      _channel: row.channel,
      _channel_id: row.channel_id,
    });
  }

  return { notes, warnings };
}

/** ノートタイトルを決める。matchup はキャラ名、その他はチャンネル名（装飾除去なしの生名）。 */
function deriveTitle(row: MappingRow, character?: { name_ja: string }): string {
  if (row.kind === "matchup" && character) return `${character.name_ja}対策`;
  return row.channel;
}
