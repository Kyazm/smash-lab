import { describe, expect, it } from "vitest";
import { parseMatchTitle, resolveMatchup } from "../src/lib/title-parse.js";

describe("parseMatchTitle 正常系", () => {
  it("Tournament - Round - A (CharA) VS B (CharB) - SSBU", () => {
    const p = parseMatchTitle(
      "Comicpalooza Fight Club 2026 - Pools - Marss (Zero Suit Samus) VS SKZohar (Shulk) - SSBU",
    );
    expect(p.ok).toBe(true);
    expect(p.tournament).toBe("Comicpalooza Fight Club 2026");
    expect(p.round).toBe("Pools");
    expect(p.suffix).toBe("SSBU");
    expect(p.p1).toEqual({ player: "Marss", charRaw: "Zero Suit Samus" });
    expect(p.p2).toEqual({ player: "SKZohar", charRaw: "Shulk" });
  });

  it("Round 省略でも対戦カードを取れる", () => {
    const p = parseMatchTitle(
      "Comicpalooza Fight Club 2026 - Marss (Zero Suit Samus) VS Maister (Mr. Game and Watch) - SSBU",
    );
    expect(p.ok).toBe(true);
    expect(p.round).toBeNull();
    expect(p.p2?.charRaw).toBe("Mr. Game and Watch");
  });

  it("suffix が Ultimate Singles / ハイフン付き Round も可", () => {
    const p = parseMatchTitle(
      "Mash Harder 13 - Winners Quarter-Final - Marss (Zero Suit Samus) VS Vidad (R.O.B) - Ultimate Singles",
    );
    expect(p.ok).toBe(true);
    expect(p.round).toBe("Winners Quarter-Final");
    expect(p.suffix).toBe("Ultimate Singles");
    expect(p.p2?.charRaw).toBe("R.O.B");
  });

  it("日本語タイトル（Japanese）も対応", () => {
    const p = parseMatchTitle("篝火 #35 - 準決勝 - あcola (ゼロスーツサムス) VS ザクレイ (むらびと) - SSBU");
    expect(p.ok).toBe(true);
    expect(p.tournament).toBe("篝火 #35");
    expect(p.round).toBe("準決勝");
    expect(p.p1).toEqual({ player: "あcola", charRaw: "ゼロスーツサムス" });
    expect(p.p2?.charRaw).toBe("むらびと");
  });

  it("対戦カードが無い文字列は ok=false", () => {
    const p = parseMatchTitle("just some random uploaded clip title");
    expect(p.ok).toBe(false);
    expect(p.p1).toBeNull();
  });

  it("空文字は ok=false", () => {
    expect(parseMatchTitle("").ok).toBe(false);
  });
});

describe("resolveMatchup 側判定と相手抽出", () => {
  it("studied が P1 のとき side=p1, 相手を抽出", () => {
    const p = parseMatchTitle(
      "Comicpalooza Fight Club 2026 - Pools - Marss (Zero Suit Samus) VS SKZohar (Shulk) - SSBU",
    );
    const r = resolveMatchup(p, "Marss");
    expect(r.side).toBe("p1");
    expect(r.oppPlayer).toBe("SKZohar");
    expect(r.oppCharsHint).toEqual(["シュルク"]);
    expect(r.needsReview).toBe(false);
    expect(r.multiOppChars).toBe(false);
  });

  it("studied が P2 のとき side=p2（大小文字無視）", () => {
    const p = parseMatchTitle(
      "Comicpalooza Fight Club 2026 - Top 8 - Lima (Bayonetta) VS Marss (Zero Suit Samus) - SSBU",
    );
    const r = resolveMatchup(p, "marss");
    expect(r.side).toBe("p2");
    expect(r.oppPlayer).toBe("Lima");
    expect(r.oppCharsHint).toEqual(["ベヨネッタ"]);
  });

  it("相手が複数キャラ (K. Rool, Kazuya) は hint 複数 + needs_review", () => {
    const p = parseMatchTitle(
      "Mash Harder 13 - Losers Final - Marss (ZSS) VS Bruho (K. Rool, Kazuya) - Smash Ultimate Singles",
    );
    const r = resolveMatchup(p, "Marss");
    expect(r.side).toBe("p1");
    expect(r.multiOppChars).toBe(true);
    expect(r.needsReview).toBe(true);
    expect(r.oppCharsHint).toEqual(["キングクルール", "カズヤ"]);
  });

  it("studied プレイヤーがどちらにも一致しない → 側判定不能 + needs_review", () => {
    const p = parseMatchTitle("Some Major - Top 8 - Sonix (Sonic) VS Tea (Pac-Man) - SSBU");
    const r = resolveMatchup(p, "Marss");
    expect(r.side).toBeNull();
    expect(r.needsReview).toBe(true);
    expect(r.oppCharsHint).toEqual([]);
  });

  it("パース失敗タイトルは side=null + needs_review", () => {
    const p = parseMatchTitle("no matchup here");
    const r = resolveMatchup(p, "Marss");
    expect(r.side).toBeNull();
    expect(r.needsReview).toBe(true);
  });
});
