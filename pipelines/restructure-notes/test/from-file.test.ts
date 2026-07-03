import { describe, expect, it } from "vitest";
import { evaluateFileProposal, parseProposalsFile } from "../src/lib/from-file.js";

describe("parseProposalsFile", () => {
  it("正しいJSON配列をパースする", () => {
    const json = JSON.stringify([
      { note_id: "a", proposed_body_md: "body", change_summary: "sum" },
      { note_id: "b", proposed_body_md: "body2" },
    ]);
    const result = parseProposalsFile(json);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ note_id: "a", proposed_body_md: "body", change_summary: "sum" });
    expect(result[1].change_summary).toBeNull();
  });

  it("配列でなければ例外", () => {
    expect(() => parseProposalsFile(`{"note_id":"a"}`)).toThrow(/配列/);
  });

  it("note_id 欠落は例外", () => {
    expect(() => parseProposalsFile(`[{"proposed_body_md":"b"}]`)).toThrow(/note_id/);
  });

  it("proposed_body_md が空なら例外", () => {
    expect(() => parseProposalsFile(`[{"note_id":"a","proposed_body_md":"  "}]`)).toThrow(
      /proposed_body_md/,
    );
  });

  it("不正なJSONは例外", () => {
    expect(() => parseProposalsFile("not json")).toThrow(/パースに失敗/);
  });
});

describe("evaluateFileProposal", () => {
  it("トークンが保持されていれば needsReview=false で change_summary をそのまま使う", () => {
    const result = evaluateFileProposal(
      { title: "t", bodyMd: "上スマは30%から連携可能。" },
      { note_id: "a", proposed_body_md: "## TL;DR\n- 上スマは30%から連携", change_summary: "整頓した" },
    );
    expect(result.needsReview).toBe(false);
    expect(result.changeSummary).toBe("整頓した");
    expect(result.missingTokens).toEqual([]);
  });

  it("欠落があれば needs_review タグを change_summary の先頭に付与する", () => {
    const result = evaluateFileProposal(
      { title: "t", bodyMd: "上スマは30%から連携可能。" },
      { note_id: "a", proposed_body_md: "## TL;DR\n- 連携できる", change_summary: "整頓した" },
    );
    expect(result.needsReview).toBe(true);
    expect(result.changeSummary).toMatch(/^needs_review:/);
    expect(result.changeSummary).toContain("30%");
    expect(result.changeSummary).toContain("整頓した");
  });

  it("change_summary が無い場合は needs_review タグのみ", () => {
    const result = evaluateFileProposal(
      { title: "t", bodyMd: "発生12Fの技。" },
      { note_id: "a", proposed_body_md: "早い技", change_summary: null },
    );
    expect(result.needsReview).toBe(true);
    expect(result.changeSummary).toBe(`needs_review:${result.missingTokens.join(",")}`);
  });

  it("needs_review でも proposedBodyMd は常に返す（投入は行う）", () => {
    const result = evaluateFileProposal(
      { title: "t", bodyMd: "発生12Fの技。" },
      { note_id: "a", proposed_body_md: "早い技", change_summary: null },
    );
    expect(result.proposedBodyMd).toBe("早い技");
  });
});
