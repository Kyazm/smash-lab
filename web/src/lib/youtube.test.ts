import { describe, it, expect } from "vitest";
import { parseYouTube, parseTimeParam, toEmbedUrl, youtubeInputToEmbedUrl } from "./youtube";

describe("parseTimeParam", () => {
  it("数値のみは秒として解釈", () => {
    expect(parseTimeParam("90")).toBe(90);
  });
  it("末尾sの秒表記", () => {
    expect(parseTimeParam("90s")).toBe(90);
  });
  it("分秒表記 1m30s", () => {
    expect(parseTimeParam("1m30s")).toBe(90);
  });
  it("時分秒表記 1h2m3s", () => {
    expect(parseTimeParam("1h2m3s")).toBe(3723);
  });
  it("空/null は null", () => {
    expect(parseTimeParam("")).toBeNull();
    expect(parseTimeParam(null)).toBeNull();
    expect(parseTimeParam(undefined)).toBeNull();
  });
  it("不正表記は null", () => {
    expect(parseTimeParam("abc")).toBeNull();
  });
});

describe("parseYouTube", () => {
  it("watch?v= 形式", () => {
    const r = parseYouTube("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(r).toEqual({ videoId: "dQw4w9WgXcQ", startSeconds: null });
  });

  it("watch?v= に t= 秒付き", () => {
    const r = parseYouTube("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s");
    expect(r).toEqual({ videoId: "dQw4w9WgXcQ", startSeconds: 90 });
  });

  it("youtu.be 短縮形式 + t=", () => {
    const r = parseYouTube("https://youtu.be/dQw4w9WgXcQ?t=45");
    expect(r).toEqual({ videoId: "dQw4w9WgXcQ", startSeconds: 45 });
  });

  it("embed 形式 + start=", () => {
    const r = parseYouTube("https://www.youtube.com/embed/dQw4w9WgXcQ?start=12");
    expect(r).toEqual({ videoId: "dQw4w9WgXcQ", startSeconds: 12 });
  });

  it("shorts 形式", () => {
    const r = parseYouTube("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    expect(r?.videoId).toBe("dQw4w9WgXcQ");
  });

  it("11文字のID直指定", () => {
    const r = parseYouTube("dQw4w9WgXcQ");
    expect(r).toEqual({ videoId: "dQw4w9WgXcQ", startSeconds: null });
  });

  it("nocookie ホストも受理", () => {
    const r = parseYouTube("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=5");
    expect(r).toEqual({ videoId: "dQw4w9WgXcQ", startSeconds: 5 });
  });

  it("YouTube でないURLは null", () => {
    expect(parseYouTube("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("空文字/不正入力は null", () => {
    expect(parseYouTube("")).toBeNull();
    expect(parseYouTube("not a url")).toBeNull();
  });

  it("v= が11文字でない場合は null", () => {
    expect(parseYouTube("https://www.youtube.com/watch?v=short")).toBeNull();
  });
});

describe("toEmbedUrl", () => {
  it("開始秒なしは nocookie embed", () => {
    expect(toEmbedUrl({ videoId: "dQw4w9WgXcQ", startSeconds: null })).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
  it("開始秒ありは start= 付与", () => {
    expect(toEmbedUrl({ videoId: "dQw4w9WgXcQ", startSeconds: 90 })).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90",
    );
  });
  it("開始秒0は付与しない", () => {
    expect(toEmbedUrl({ videoId: "dQw4w9WgXcQ", startSeconds: 0 })).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
});

describe("youtubeInputToEmbedUrl", () => {
  it("URL入力から直接埋込URL", () => {
    expect(youtubeInputToEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=30")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30",
    );
  });
  it("不正入力は null", () => {
    expect(youtubeInputToEmbedUrl("https://example.com")).toBeNull();
  });
});
