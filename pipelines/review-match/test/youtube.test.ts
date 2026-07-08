import { describe, expect, it } from "vitest";
import { parseTimestampList, parseTimeToken, parseVideoId } from "../src/lib/youtube.js";

describe("parseVideoId", () => {
  it("youtu.be 短縮URL", () => {
    expect(parseVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("watch?v=", () => {
    expect(parseVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s")).toBe("dQw4w9WgXcQ");
  });
  it("shorts / embed / live", () => {
    expect(parseVideoId("https://www.youtube.com/shorts/abc123DEF45")).toBe("abc123DEF45");
    expect(parseVideoId("https://www.youtube.com/embed/abc123DEF45")).toBe("abc123DEF45");
    expect(parseVideoId("https://www.youtube.com/live/abc123DEF45")).toBe("abc123DEF45");
  });
  it("解析不能でも非空の代替IDを返す", () => {
    expect(parseVideoId("https://example.com/foo").length).toBeGreaterThan(0);
  });
});

describe("parseTimeToken", () => {
  it("秒数", () => {
    expect(parseTimeToken("93")).toBe(93);
    expect(parseTimeToken("93.5")).toBe(93.5);
  });
  it("mm:ss", () => {
    expect(parseTimeToken("1:33")).toBe(93);
  });
  it("h:mm:ss", () => {
    expect(parseTimeToken("1:02:03")).toBe(3723);
  });
  it("不正は null", () => {
    expect(parseTimeToken("abc")).toBeNull();
    expect(parseTimeToken("1:2:3:4")).toBeNull();
    expect(parseTimeToken("1:x")).toBeNull();
  });
});

describe("parseTimestampList", () => {
  it("カンマ区切りの秒", () => {
    expect(parseTimestampList("93,210")).toEqual([93, 210]);
  });
  it("mm:ss 混在", () => {
    expect(parseTimestampList("1:33, 3:30")).toEqual([93, 210]);
  });
  it("空要素を無視する", () => {
    expect(parseTimestampList("93, ,210")).toEqual([93, 210]);
  });
  it("全部空はエラー", () => {
    expect(() => parseTimestampList(" , ")).toThrow();
  });
  it("不正トークンはエラー", () => {
    expect(() => parseTimestampList("93,foo")).toThrow();
  });
});
