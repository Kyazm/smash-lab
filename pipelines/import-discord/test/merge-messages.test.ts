import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeChannelMessages, isImageAttachment } from "../src/lib/merge-messages.js";
import type { DiscordMessage } from "../src/lib/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const foxMessages: DiscordMessage[] = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "messages-fox.json"), "utf8"),
);

describe("isImageAttachment", () => {
  it("content_type / 拡張子で画像判定", () => {
    expect(isImageAttachment("a.png", "image/png")).toBe(true);
    expect(isImageAttachment("a.PNG")).toBe(true);
    expect(isImageAttachment("combo.mp4", "video/mp4")).toBe(false);
    expect(isImageAttachment("clip.webm")).toBe(false);
  });
});

describe("mergeChannelMessages", () => {
  const merged = mergeChannelMessages(foxMessages);

  it("bot 投稿とシステムメッセージを除外する", () => {
    expect(merged.messageCount).toBe(3); // 通常3件（bot=除外, type6=除外）
    expect(merged.bodyMd).not.toContain("botの自動投稿");
  });

  it("id 昇順（時刻順）で並ぶ: 05-02 が 05-03 より前", () => {
    const idx0502 = merged.bodyMd.indexOf("2024-05-02");
    const idx0503 = merged.bodyMd.indexOf("2024-05-03");
    expect(idx0502).toBeGreaterThanOrEqual(0);
    expect(idx0503).toBeGreaterThan(idx0502);
  });

  it("日付が変わるたびに日付見出しが入る", () => {
    expect(merged.bodyMd).toContain("## 2024-05-02");
    expect(merged.bodyMd).toContain("## 2024-05-03");
    // 同一日は見出し1回のみ
    const count0503 = (merged.bodyMd.match(/## 2024-05-03/g) ?? []).length;
    expect(count0503).toBe(1);
  });

  it("編集済みメッセージは content（最終版）を採用", () => {
    expect(merged.bodyMd).toContain("パラライザーは根本狙い");
  });

  it("画像添付はマークダウン画像プレースホルダ、動画はリンク", () => {
    expect(merged.bodyMd).toContain("![ledge_setup.png](attachment://att777/ledge_setup.png)");
    expect(merged.bodyMd).toContain("[combo.mp4](attachment://att888/combo.mp4)");
    expect(merged.bodyMd).not.toContain("![combo.mp4]");
  });

  it("添付は2件収集される（画像1・動画1）", () => {
    expect(merged.attachments).toHaveLength(2);
  });

  it("空チャンネルは messageCount 0", () => {
    const empty = mergeChannelMessages([]);
    expect(empty.messageCount).toBe(0);
    expect(empty.bodyMd).toBe("");
  });
});
