import { describe, expect, it } from "vitest";
import {
  buildCatalogUrl,
  parseCatalogHtml,
  parsePagination,
} from "../src/lib/catalog.js";

// 実 smash-tube DOM を模したフィクスチャ（各 rsg に img + Vtitle の2つの data-video、Pdate に日付）。
const FIXTURE = `
<div class="resultmsg-content">185件の動画が見つかりました（1 / 19）</div>
<div class="result-content">
  <div class="rsg">
    <div class="result-youtube">
      <img class="v-modal" data-video="e76F_fDNjf8"
        data-title="Comicpalooza Fight Club 2026 - Pools - Marss (Zero Suit Samus) VS SKZohar (Shulk) - SSBU">
    </div>
    <div class="Vtitle v-modal" data-video="e76F_fDNjf8"
        data-title="Comicpalooza Fight Club 2026 - Pools - Marss (Zero Suit Samus) VS SKZohar (Shulk) - SSBU"
        data-fulltitle="Comicpalooza Fight Club 2026 - Pools - Marss (Zero Suit Samus) VS SKZohar (Shulk) - SSBU">
    </div>
    <div class="Pdate"><p>2026-05-28 </p></div>
  </div>
  <div class="rsg">
    <div class="result-youtube">
      <img class="v-modal" data-video="6K3Cxvw_2qQ"
        data-title="Mash Harder 13 - Losers Final - Marss (ZSS) VS Bruho (K. Rool, Kazuya) - Smash Ultimate Singles">
    </div>
    <div class="Vtitle v-modal" data-video="6K3Cxvw_2qQ"
        data-fulltitle="Mash Harder 13 - Losers Final - Marss (ZSS) VS Bruho (K. Rool, Kazuya) - Smash Ultimate Singles">
    </div>
    <div class="Pdate"><p>2025-10-29 </p></div>
  </div>
  <div class="rsg">
    <div class="result-youtube">
      <img class="v-modal" data-video="ONLYtitle01"
        data-title="Some Major 2025 - Marss (Zero Suit Samus) VS Sonix (Sonic) - SSBU">
    </div>
    <div class="Pdate"><p>2025-01-02 </p></div>
  </div>
</div>
`;

describe("parseCatalogHtml", () => {
  it("rsg ブロックから video_id / title / played_on を抽出", () => {
    const rows = parseCatalogHtml(FIXTURE);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      video_id: "e76F_fDNjf8",
      title: "Comicpalooza Fight Club 2026 - Pools - Marss (Zero Suit Samus) VS SKZohar (Shulk) - SSBU",
      played_on: "2026-05-28",
    });
  });

  it("data-fulltitle が無ければ data-title へフォールバック", () => {
    const rows = parseCatalogHtml(FIXTURE);
    expect(rows[2].video_id).toBe("ONLYtitle01");
    expect(rows[2].title).toContain("Some Major 2025");
    expect(rows[2].played_on).toBe("2025-01-02");
  });

  it("ブロック内に data-video が重複しても1件（初出優先）", () => {
    const rows = parseCatalogHtml(FIXTURE);
    const ids = rows.map((r) => r.video_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("HTMLエンティティをデコード", () => {
    const html = `<div class="rsg"><div data-video="abcdefghij1"
      data-fulltitle="Big House - R1 - A (Peach &amp; Daisy?) VS B (Steve) - SSBU"></div>
      <div class="Pdate"><p>2024-12-01 </p></div></div>`;
    const rows = parseCatalogHtml(html);
    expect(rows[0].title).toContain("&");
    expect(rows[0].title).not.toContain("&amp;");
  });

  it("マッチ無しHTMLは空配列", () => {
    expect(parseCatalogHtml("<html><body>nothing</body></html>")).toEqual([]);
  });
});

describe("parsePagination", () => {
  it("総件数 / 現在ページ / 総ページ を抽出", () => {
    expect(parsePagination(FIXTURE)).toEqual({ total: 185, page: 1, totalPages: 19 });
  });
  it("カンマ区切りの総数も可", () => {
    expect(parsePagination("1,234件の動画が見つかりました（2 / 124）")).toEqual({
      total: 1234,
      page: 2,
      totalPages: 124,
    });
  });
  it("無ければ null", () => {
    expect(parsePagination("no pagination")).toBeNull();
  });
});

describe("buildCatalogUrl", () => {
  it("player / character / page をURLエンコードして組む", () => {
    const url = buildCatalogUrl("Marss", "ゼロスーツサムス", 2);
    expect(url).toContain("player1=Marss");
    expect(url).toContain("page_id=2");
    expect(url).toContain("character1=%E3%82%BC%E3%83%AD"); // ゼロ… のエンコード先頭
  });
});
