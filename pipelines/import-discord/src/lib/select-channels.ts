// カテゴリ構造から対象テキストチャンネルを選別する（純関数）。
import type { DiscordChannel } from "./types.js";
import { classifyCategory, type CategoryKind, type TargetConfig } from "../config.js";

const TYPE_CATEGORY = 4;
const TYPE_TEXT = 0;
const TYPE_ANNOUNCEMENT = 5;

export interface SelectedChannel {
  channel: DiscordChannel;
  categoryName: string;
  categoryKind: CategoryKind;
}

/**
 * ギルドの全チャンネルから、対象カテゴリ配下のテキストチャンネルを選ぶ。
 * @returns 対象チャンネル一覧（カテゴリ名・種別付き）
 */
export function selectTargetChannels(
  channels: DiscordChannel[],
  cfg?: TargetConfig,
): SelectedChannel[] {
  // カテゴリID → {name, kind}
  const categories = new Map<string, { name: string; kind: CategoryKind }>();
  for (const c of channels) {
    if (c.type !== TYPE_CATEGORY) continue;
    const kind = classifyCategory(c.name, cfg);
    if (kind) categories.set(c.id, { name: c.name, kind });
  }

  const out: SelectedChannel[] = [];
  for (const c of channels) {
    if (c.type !== TYPE_TEXT && c.type !== TYPE_ANNOUNCEMENT) continue;
    if (!c.parent_id) continue;
    const cat = categories.get(c.parent_id);
    if (!cat) continue;
    out.push({ channel: c, categoryName: cat.name, categoryKind: cat.kind });
  }
  // 安定した順序（カテゴリ→position→名前）
  out.sort(
    (a, b) =>
      a.categoryName.localeCompare(b.categoryName) ||
      (a.channel.position ?? 0) - (b.channel.position ?? 0) ||
      a.channel.name.localeCompare(b.channel.name),
  );
  return out;
}
