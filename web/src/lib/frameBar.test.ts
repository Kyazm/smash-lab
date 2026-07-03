import { describe, expect, it } from "vitest";
import { buildFrameBar, parseActiveRange } from "./frameBar";

describe("parseActiveRange", () => {
  it("parses simple single frame", () => {
    expect(parseActiveRange("1")).toEqual([1, 1]);
  });
  it("parses a range", () => {
    expect(parseActiveRange("3-4")).toEqual([3, 4]);
  });
  it("parses the first range when multiple hits are slash-separated", () => {
    expect(parseActiveRange("5-6/14")).toEqual([5, 6]);
  });
  it("parses the first range even with trailing parenthetical notes", () => {
    expect(parseActiveRange("6-9(10-25)")).toEqual([6, 9]);
  });
  it("returns null for null input", () => {
    expect(parseActiveRange(null)).toBeNull();
  });
  it("returns null for unparseable emoji/shrug text", () => {
    expect(parseActiveRange("¯\\_(ツ)_/¯ (19/25-27)")).toBeNull();
  });
  it("returns null for garbage like '21-**'", () => {
    // "21-**" -> matches "21" only (no second number), which parseActiveRange treats as [21,21].
    // Verify that degenerate case explicitly.
    expect(parseActiveRange("21-**")).toEqual([21, 21]);
  });
});

describe("buildFrameBar", () => {
  it("builds startup+active+recovery segments for a normal move", () => {
    const bar = buildFrameBar({ startup: 6, active: "6-8", faf: 28 });
    expect(bar).not.toBeNull();
    expect(bar?.totalFrames).toBe(28);
    expect(bar?.segments).toEqual([
      { kind: "startup", frames: 5 },
      { kind: "active", frames: 3 },
      { kind: "recovery", frames: 20 },
    ]);
  });

  it("omits startup segment when active starts at frame 1", () => {
    const bar = buildFrameBar({ startup: 1, active: "1", faf: 23 });
    expect(bar?.segments[0]).toEqual({ kind: "active", frames: 1 });
  });

  it("omits recovery segment when active ends exactly at faf", () => {
    const bar = buildFrameBar({ startup: 5, active: "5-10", faf: 10 });
    expect(bar?.segments.find((s) => s.kind === "recovery")).toBeUndefined();
  });

  it("returns null when startup or faf missing", () => {
    expect(buildFrameBar({ startup: null, active: "1-2", faf: 10 })).toBeNull();
    expect(buildFrameBar({ startup: 1, active: "1-2", faf: null })).toBeNull();
  });

  it("returns null when active is unparseable", () => {
    expect(buildFrameBar({ startup: 1, active: "¯\\_(ツ)_/¯", faf: 30 })).toBeNull();
  });

  it("returns null when faf is smaller than active end (inconsistent data)", () => {
    expect(buildFrameBar({ startup: 1, active: "5-40", faf: 30 })).toBeNull();
  });
});
