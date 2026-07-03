// exporter: Discord REST API v10 から対象カテゴリ配下の全テキストチャンネルの
// メッセージ+添付をエクスポートする。
//
// 出力:
//   .context/discord-export/_channels.json      … 対象チャンネル一覧（カテゴリ・種別付き）
//   .context/discord-export/<channel-id>.json    … チャンネルごとの生メッセージ配列
//   .context/discord-export/attachments/<id>_<filename> … 添付ファイル実体
//
// フラグ:
//   --dry-run   ネットワークはチャンネル一覧取得のみ。メッセージ/添付は取得せず、
//               対象チャンネルと想定件数だけ表示（トークンありでの下見用）。
//   --no-attachments  添付ダウンロードをスキップ（メッセージJSONのみ）。
//
// 認証は DISCORD_TOKEN（既定 Bot トークン）。README 参照。
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { GUILD_ID, EXPORT_DIR, ATTACHMENTS_DIR, RAW_META_PATH } from "./config.js";
import { DiscordClient } from "./lib/discord-api.js";
import { selectTargetChannels, type SelectedChannel } from "./lib/select-channels.js";
import { writeJson } from "./lib/io.js";
import type { DiscordMessage } from "./lib/types.js";

interface ChannelMeta {
  channel_id: string;
  channel: string;
  category: string;
  kind: string;
  message_count: number;
  attachment_count: number;
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const skipAttachments = args.has("--no-attachments");

  const client = DiscordClient.fromEnv();

  console.log(`[export] guild=${GUILD_ID} 対象カテゴリ構造を取得中...`);
  const channels = await client.listGuildChannels(GUILD_ID);
  const targets = selectTargetChannels(channels);
  console.log(`[export] 対象テキストチャンネル: ${targets.length} 件`);
  for (const t of targets) {
    console.log(`  - [${t.categoryKind}] ${t.categoryName} / ${t.channel.name} (${t.channel.id})`);
  }

  if (dryRun) {
    console.log("[export] --dry-run: メッセージ・添付は取得しません。");
    // dry-run でも対象一覧は書き出す（後続のマッピング生成を offline で試せる）
    await writeChannelMeta(targets, []);
    return;
  }

  await mkdir(EXPORT_DIR, { recursive: true });
  if (!skipAttachments) await mkdir(ATTACHMENTS_DIR, { recursive: true });

  const metas: ChannelMeta[] = [];
  for (const t of targets) {
    const { channel } = t;
    console.log(`[export] #${channel.name} メッセージ取得中...`);
    const messages = await client.fetchAllMessages(channel.id);
    await writeJson(join(EXPORT_DIR, `${channel.id}.json`), messages);

    let attachmentCount = 0;
    for (const m of messages) {
      attachmentCount += m.attachments?.length ?? 0;
    }
    if (!skipAttachments) {
      await downloadAttachments(messages);
    }

    metas.push({
      channel_id: channel.id,
      channel: channel.name,
      category: t.categoryName,
      kind: t.categoryKind,
      message_count: messages.length,
      attachment_count: attachmentCount,
    });
    console.log(`  → ${messages.length} messages, ${attachmentCount} attachments`);
  }

  await writeChannelMeta(targets, metas);
  console.log(`[export] 完了。生JSON: ${EXPORT_DIR}`);
}

async function writeChannelMeta(
  targets: SelectedChannel[],
  metas: ChannelMeta[],
): Promise<void> {
  const byId = new Map(metas.map((m) => [m.channel_id, m]));
  const rows: ChannelMeta[] = targets.map((t) => {
    const m = byId.get(t.channel.id);
    return (
      m ?? {
        channel_id: t.channel.id,
        channel: t.channel.name,
        category: t.categoryName,
        kind: t.categoryKind,
        message_count: 0,
        attachment_count: 0,
      }
    );
  });
  await writeJson(RAW_META_PATH, rows);
}

async function downloadAttachments(messages: DiscordMessage[]): Promise<void> {
  for (const m of messages) {
    for (const a of m.attachments ?? []) {
      const dest = join(ATTACHMENTS_DIR, `${a.id}_${sanitize(a.filename)}`);
      try {
        const res = await fetch(a.url);
        if (!res.ok) {
          console.warn(`  ! 添付DL失敗 ${a.filename}: ${res.status}`);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        await writeFile(dest, buf);
      } catch (e) {
        console.warn(`  ! 添付DL例外 ${a.filename}: ${(e as Error).message}`);
      }
    }
  }
}

function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
