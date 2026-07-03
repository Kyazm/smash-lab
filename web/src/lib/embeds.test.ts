import { describe, it, expect } from "vitest";
import {
  classifyUrl,
  matchBareUrlLine,
  parseAttachmentPlaceholder,
  attachmentToStoragePath,
  matchMarkdownImageAttachmentLine,
  matchBareAttachmentLine,
  extractLineMedia,
  INLINE_URL_RE,
} from "./embeds";

describe("classifyUrl", () => {
  it("youtube.com/watch を youtube と判定する", () => {
    expect(classifyUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ").kind).toBe("youtube");
  });
  it("youtu.be を youtube と判定する", () => {
    expect(classifyUrl("https://youtu.be/dQw4w9WgXcQ?t=30").kind).toBe("youtube");
  });
  it("youtube-nocookie.com を youtube と判定する", () => {
    expect(classifyUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ").kind).toBe("youtube");
  });

  it("x.com/user/status/123 を tweet と判定する", () => {
    expect(classifyUrl("https://x.com/somebody/status/123456789").kind).toBe("tweet");
  });
  it("twitter.com/user/status/123 を tweet と判定する", () => {
    expect(classifyUrl("https://twitter.com/somebody/status/123456789").kind).toBe("tweet");
  });
  it("x.com のプロフィールURL（status無し）は tweet 扱いしない", () => {
    expect(classifyUrl("https://x.com/somebody").kind).not.toBe("tweet");
  });

  it("拡張子.pngの直リンクを image と判定する", () => {
    expect(classifyUrl("https://example.com/foo/bar.png").kind).toBe("image");
  });
  it("拡張子.jpgにクエリが付いても image と判定する", () => {
    expect(classifyUrl("https://example.com/bar.jpg?ex=abc&is=def").kind).toBe("image");
  });
  it("cdn.discordapp.com は拡張子なしでも image と判定する", () => {
    expect(classifyUrl("https://cdn.discordapp.com/attachments/1/2/file").kind).toBe("image");
  });
  it("media.discordapp.net も image と判定する", () => {
    expect(classifyUrl("https://media.discordapp.net/attachments/1/2/file").kind).toBe("image");
  });

  it("該当しないURLは link と判定する", () => {
    expect(classifyUrl("https://ultimateframedata.com/zss").kind).toBe("link");
  });
  it("不正なURL文字列は link 扱い（エラーを投げない）", () => {
    expect(classifyUrl("not a url").kind).toBe("link");
  });
  it("http以外のスキーム(mailto:)は link 扱い", () => {
    expect(classifyUrl("mailto:a@example.com").kind).toBe("link");
  });
});

describe("INLINE_URL_RE", () => {
  it("全角スラッシュをURLの区切りとして扱う（連結しない）", () => {
    INLINE_URL_RE.lastIndex = 0;
    const matches = "https://a.com/x／https://b.com/y".match(INLINE_URL_RE);
    expect(matches).toEqual(["https://a.com/x", "https://b.com/y"]);
  });
  it("半角スペース区切りは従来どおり分離する", () => {
    INLINE_URL_RE.lastIndex = 0;
    const matches = "https://a.com/x https://b.com/y".match(INLINE_URL_RE);
    expect(matches).toEqual(["https://a.com/x", "https://b.com/y"]);
  });
});

describe("matchBareUrlLine", () => {
  it("行全体がURLのみなら抽出する", () => {
    expect(matchBareUrlLine("https://example.com/foo")).toBe("https://example.com/foo");
  });
  it("前後空白があっても抽出する", () => {
    expect(matchBareUrlLine("  https://example.com/foo  ")).toBe("https://example.com/foo");
  });
  it("文中にURLが混じる行は単独行と判定しない", () => {
    expect(matchBareUrlLine("見て https://example.com/foo")).toBeNull();
  });
  it("URLを含まない行はnull", () => {
    expect(matchBareUrlLine("ただのテキスト")).toBeNull();
  });
});

describe("attachment placeholder", () => {
  it("id/nameをパースする", () => {
    expect(parseAttachmentPlaceholder("attachment://123456/screenshot.png")).toEqual({
      id: "123456",
      name: "screenshot.png",
    });
  });
  it("形式が違えばnull", () => {
    expect(parseAttachmentPlaceholder("attachment://noSlashHere")).toBeNull();
    expect(parseAttachmentPlaceholder("not-attachment://1/2")).toBeNull();
  });
  it("storage_pathへ変換する（discord/<id>_<name>）", () => {
    expect(attachmentToStoragePath({ id: "123456", name: "screenshot.png" })).toBe(
      "discord/123456_screenshot.png",
    );
  });
  it("nameにアンダースコアや日本語を含んでも素通しする", () => {
    expect(attachmentToStoragePath({ id: "1", name: "画像_1.png" })).toBe("discord/1_画像_1.png");
  });
});

describe("matchMarkdownImageAttachmentLine", () => {
  it("![alt](attachment://id/name) 単独行をパースする", () => {
    expect(matchMarkdownImageAttachmentLine("![スクショ](attachment://123/foo.png)")).toEqual({
      alt: "スクショ",
      id: "123",
      name: "foo.png",
    });
  });
  it("altが空でもパースする", () => {
    expect(matchMarkdownImageAttachmentLine("![](attachment://123/foo.png)")).toEqual({
      alt: "",
      id: "123",
      name: "foo.png",
    });
  });
  it("通常のMarkdown画像（http URL）はnull（別経路で処理）", () => {
    expect(matchMarkdownImageAttachmentLine("![alt](https://example.com/foo.png)")).toBeNull();
  });
  it("前後に文字がある行はnull（単独行のみ対象）", () => {
    expect(matchMarkdownImageAttachmentLine("見て ![alt](attachment://1/a.png)")).toBeNull();
  });
});

describe("matchBareAttachmentLine", () => {
  it("素のattachment://単独行をパースする", () => {
    expect(matchBareAttachmentLine("attachment://123/foo.png")).toEqual({
      id: "123",
      name: "foo.png",
    });
  });
  it("前後空白を許容する", () => {
    expect(matchBareAttachmentLine("  attachment://123/foo.png  ")).toEqual({
      id: "123",
      name: "foo.png",
    });
  });
  it("Markdown画像記法込みの行はnull（別関数の担当）", () => {
    expect(matchBareAttachmentLine("![alt](attachment://123/foo.png)")).toBeNull();
  });
  it("文中に混じる場合はnull", () => {
    expect(matchBareAttachmentLine("見て attachment://123/foo.png")).toBeNull();
  });
});

describe("extractLineMedia", () => {
  it("メディアを含まない行はnull", () => {
    expect(extractLineMedia("ただのテキスト")).toBeNull();
  });

  it("既知URL以外（linkのみ）の行はnull（従来のインラインリンク化に委ねる）", () => {
    expect(extractLineMedia("参考: https://ultimateframedata.com/zss")).toBeNull();
  });

  it("単独行のYouTube URLはメディア単体のセグメントになる", () => {
    expect(extractLineMedia("https://youtu.be/CgLfqHQkbyU")).toEqual([
      { type: "media-url", kind: "youtube", url: "https://youtu.be/CgLfqHQkbyU" },
    ]);
  });

  it("行末に注記が付いたYouTube URLは、メディア＋末尾テキストに分解する", () => {
    const result = extractLineMedia("https://youtu.be/CgLfqHQkbyU （後半30分が解説タイム）");
    expect(result).toEqual([
      { type: "media-url", kind: "youtube", url: "https://youtu.be/CgLfqHQkbyU" },
      { type: "text", text: " （後半30分が解説タイム）" },
    ]);
  });

  it("行頭に注記が付く場合は、先頭テキスト＋メディアに分解する", () => {
    const result = extractLineMedia("参考動画 https://youtu.be/CgLfqHQkbyU");
    expect(result).toEqual([
      { type: "text", text: "参考動画 " },
      { type: "media-url", kind: "youtube", url: "https://youtu.be/CgLfqHQkbyU" },
    ]);
  });

  it("テキスト中（前後両方）に注記が付く場合も分解する", () => {
    const result = extractLineMedia("見て https://example.com/foo.png これ重要");
    expect(result).toEqual([
      { type: "text", text: "見て " },
      { type: "media-url", kind: "image", url: "https://example.com/foo.png" },
      { type: "text", text: " これ重要" },
    ]);
  });

  it("![](attachment://...) に日付注記が付いた行を分解する", () => {
    const result = extractLineMedia("![](attachment://123/image.png) (2023-06)");
    expect(result).toEqual([
      { type: "media-attachment", alt: "", id: "123", name: "image.png" },
      { type: "text", text: " (2023-06)" },
    ]);
  });

  it("素のattachment://に注記が付いた行を分解する", () => {
    const result = extractLineMedia("attachment://123/foo.png これは古い画像");
    expect(result).toEqual([
      { type: "media-attachment", alt: "", id: "123", name: "foo.png" },
      { type: "text", text: " これは古い画像" },
    ]);
  });

  it("1行に複数メディア（YouTube2件）があれば各々セグメント化する", () => {
    const result = extractLineMedia(
      "https://youtu.be/CgLfqHQkbyU と https://youtu.be/aaaaaaaaaaa",
    );
    expect(result).toEqual([
      { type: "media-url", kind: "youtube", url: "https://youtu.be/CgLfqHQkbyU" },
      { type: "text", text: " と " },
      { type: "media-url", kind: "youtube", url: "https://youtu.be/aaaaaaaaaaa" },
    ]);
  });

  it("画像とツイートが混在する行も各々セグメント化する", () => {
    const result = extractLineMedia(
      "https://example.com/a.png / https://x.com/somebody/status/123456789",
    );
    expect(result).toEqual([
      { type: "media-url", kind: "image", url: "https://example.com/a.png" },
      { type: "text", text: " / " },
      { type: "media-url", kind: "tweet", url: "https://x.com/somebody/status/123456789" },
    ]);
  });

  it("未知URL（link判定）はメディア化せずテキストとして残す", () => {
    const result = extractLineMedia(
      "動画 https://youtu.be/CgLfqHQkbyU 参考: https://ultimateframedata.com/zss",
    );
    expect(result).toEqual([
      { type: "text", text: "動画 " },
      { type: "media-url", kind: "youtube", url: "https://youtu.be/CgLfqHQkbyU" },
      { type: "text", text: " 参考: https://ultimateframedata.com/zss" },
    ]);
  });

  it("全角スラッシュで空白なく連結されたYouTube+ツイートURLをそれぞれ別メディアとして分解する（実データ由来）", () => {
    const result = extractLineMedia(
      "参考: https://www.youtube.com/watch?v=WJNRYe55k4o／https://twitter.com/pichuwn46/status/1293964642461429760?s=21",
    );
    expect(result).toEqual([
      { type: "text", text: "参考: " },
      { type: "media-url", kind: "youtube", url: "https://www.youtube.com/watch?v=WJNRYe55k4o" },
      { type: "text", text: "／" },
      {
        type: "media-url",
        kind: "tweet",
        url: "https://twitter.com/pichuwn46/status/1293964642461429760?s=21",
      },
    ]);
  });
});
