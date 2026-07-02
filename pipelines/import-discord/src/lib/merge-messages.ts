// 同一チャンネル内メッセージ → 1ノート統合ロジック（純関数）。
// docs/02 移行手順 3:「同一チャンネル内の連続メッセージは日付見出し付きで1ノートに統合。
// 編集済みは最終版を採用」。
//
// 方針:
// - メッセージは snowflake(id) の昇順（=時刻順）で処理する
// - 本文は content を採用（Discord の content は編集後の最終版。edited_timestamp は無視）
// - 日付が変わるたびに「## YYYY-MM-DD」見出しを差し込む
// - 添付ファイルはメッセージ順に収集し、本文中に画像はプレースホルダを残す
// - 空 content かつ添付なしのシステム的メッセージはスキップ
import type { DiscordMessage } from "./types.js";

export interface MergedAttachmentRef {
  attachmentId: string;
  filename: string;
  url: string;
  contentType: string | undefined;
  messageId: string;
}

export interface MergedNote {
  bodyMd: string;
  attachments: MergedAttachmentRef[];
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  messageCount: number;
}

/** ISO8601 → "YYYY-MM-DD"（UTC基準で安定させる）。 */
export function isoToDate(iso: string): string {
  return iso.slice(0, 10);
}

// 画像とみなす拡張子/コンテンツタイプ
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp)$/i;
export function isImageAttachment(filename: string, contentType?: string): boolean {
  if (contentType && contentType.startsWith("image/")) return true;
  return IMAGE_EXT_RE.test(filename);
}

// snowflake は 64bit 整数。時刻順ソートに BigInt を使う（Number 精度落ち回避）。
function compareSnowflake(a: string, b: string): number {
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * チャンネルの全メッセージを 1 ノート本文へ統合する。
 * @param messages 同一チャンネルのメッセージ（順不同でよい。内部でid昇順ソート）
 */
export function mergeChannelMessages(messages: DiscordMessage[]): MergedNote {
  // システムメッセージ（type が通常メッセージ 0/19 以外）を除外
  const usable = messages.filter((m) => {
    const t = m.type ?? 0;
    if (t !== 0 && t !== 19) return false;
    if (m.author?.bot) return false; // bot 投稿は除外（自分のメモ移行のため）
    const hasContent = (m.content ?? "").trim().length > 0;
    const hasAttach = (m.attachments ?? []).length > 0;
    return hasContent || hasAttach;
  });

  usable.sort((a, b) => compareSnowflake(a.id, b.id));

  const attachments: MergedAttachmentRef[] = [];
  const parts: string[] = [];
  let currentDate: string | null = null;

  for (const m of usable) {
    const date = isoToDate(m.timestamp);
    if (date !== currentDate) {
      parts.push(`## ${date}`);
      currentDate = date;
    }

    const content = (m.content ?? "").trim();
    if (content) parts.push(content);

    for (const a of m.attachments ?? []) {
      const isImg = isImageAttachment(a.filename, a.content_type);
      attachments.push({
        attachmentId: a.id,
        filename: a.filename,
        url: a.url,
        contentType: a.content_type,
        messageId: m.id,
      });
      // 本文に参照プレースホルダを残す（loader が storage_path/url に置換）
      if (isImg) {
        parts.push(`![${a.filename}](attachment://${a.id}/${a.filename})`);
      } else {
        parts.push(`[${a.filename}](attachment://${a.id}/${a.filename})`);
      }
    }
  }

  return {
    bodyMd: parts.join("\n\n").trim(),
    attachments,
    firstTimestamp: usable.length ? usable[0].timestamp : null,
    lastTimestamp: usable.length ? usable[usable.length - 1].timestamp : null,
    messageCount: usable.length,
  };
}
