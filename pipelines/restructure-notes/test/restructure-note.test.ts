import { describe, expect, it, vi } from "vitest";
import { restructureNote } from "../src/lib/restructure-note.js";

describe("restructureNote", () => {
  it("1回目で検証OKならリトライせず成功として返す", async () => {
    const generate = vi.fn().mockResolvedValue("## TL;DR\n- 上スマは30%から連携 (2023-06)");
    const result = await restructureNote(
      { characterName: "フォックス", title: "t", bodyMd: "上スマは30%から連携可能。" },
      generate,
    );
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.attempts).toBe(1);
    expect(result.needsReview).toBe(false);
    expect(result.changeSummary).toBeNull();
  });

  it("1回目で欠落があれば2回目をリトライし、成功すれば needsReview=false", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce("## TL;DR\n- 連携可能")
      .mockResolvedValueOnce("## TL;DR\n- 上スマは30%から連携 (2023-06)");

    const result = await restructureNote(
      { characterName: "フォックス", title: "t", bodyMd: "上スマは30%から連携可能。" },
      generate,
    );

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    expect(result.needsReview).toBe(false);
  });

  it("2回とも欠落が残れば needsReview=true で change_summary に欠落一覧を記録し、投入は行う", async () => {
    const generate = vi.fn().mockResolvedValue("## TL;DR\n- 連携可能な技がある");

    const result = await restructureNote(
      { characterName: "フォックス", title: "t", bodyMd: "上スマは30%から連携可能。" },
      generate,
    );

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    expect(result.needsReview).toBe(true);
    expect(result.changeSummary).toMatch(/^needs_review:/);
    expect(result.changeSummary).toContain("30%");
    // needs_review でも proposedBodyMd は常に返る（投入は行う）
    expect(result.proposedBodyMd.length).toBeGreaterThan(0);
  });

  it("2回目のリトライ時は欠落トークンを伝えるプロンプトで再生成する", async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce("欠落あり")
      .mockResolvedValueOnce("30%を含む出力");

    await restructureNote(
      { characterName: "フォックス", title: "t", bodyMd: "30%から連携可能。" },
      generate,
    );

    const secondCallPrompt = generate.mock.calls[1][0] as string;
    expect(secondCallPrompt).toContain("前回の出力で欠落");
    expect(secondCallPrompt).toContain("30%");
  });
});
