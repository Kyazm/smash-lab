import { describe, expect, it } from "vitest";
import { buildExternalLinks, pheasantzeldaCharacterLink, ufdCharacterUrl } from "./externalLinks";

describe("ufdCharacterUrl", () => {
  it("builds a direct URL from the slug (import source, always exact match)", () => {
    expect(ufdCharacterUrl({ slug: "zero_suit_samus" })).toBe(
      "https://ultimateframedata.com/zero_suit_samus",
    );
  });
});

describe("pheasantzeldaCharacterLink", () => {
  it("returns a verified mapped URL for known characters", () => {
    const link = pheasantzeldaCharacterLink({ slug: "zero_suit_samus" });
    expect(link.url).toBe("https://pheasantzelda.github.io/chara/34.zero_suit_samus.html");
    expect(link.fallback).toBeUndefined();
  });

  it("falls back to the site top for unmapped characters (avoids guessing wrong slugs)", () => {
    const link = pheasantzeldaCharacterLink({ slug: "totally_unmapped_character" });
    expect(link.url).toBe("https://pheasantzelda.github.io/");
    expect(link.fallback).toBe(true);
  });
});

describe("buildExternalLinks", () => {
  it("returns both UFD and pheasantzelda links", () => {
    const links = buildExternalLinks({ slug: "fox" });
    expect(links).toHaveLength(2);
    expect(links[0].url).toContain("ultimateframedata.com");
    expect(links[1].fallback).toBe(true);
  });
});
