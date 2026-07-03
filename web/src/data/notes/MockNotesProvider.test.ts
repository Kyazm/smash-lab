// listPendingProposals の挙動確認（docs/07 F-A）。vitest環境はnodeのためlocalStorage無し=メモリ永続で動く。
import { describe, it, expect } from "vitest";
import { MockNotesProvider } from "./MockNotesProvider";

describe("MockNotesProvider.listPendingProposals", () => {
  it("pending/staleの提案のみ返し、rejected/acceptedは含めない", async () => {
    const provider = new MockNotesProvider();
    const items = await provider.listPendingProposals();
    const statuses = new Set(items.map((i) => i.proposal.status));
    expect(statuses.has("pending") || statuses.has("stale")).toBe(true);
    expect(statuses.has("accepted")).toBe(false);
    expect(statuses.has("rejected")).toBe(false);
  });

  it("seedの2件(pending: fox-neutral, mario-projectile) + 1件(stale: fox-edgeguard) が含まれる", async () => {
    const provider = new MockNotesProvider();
    const items = await provider.listPendingProposals();
    const ids = items.map((i) => i.proposal.id).sort();
    expect(ids).toEqual(
      [
        "seed-proposal-fox-edgeguard-1",
        "seed-proposal-fox-neutral-1",
        "seed-proposal-mario-projectile-1",
      ].sort(),
    );
  });

  it("各行にノートタイトル・kind・キャラ名/slugが結合されている", async () => {
    const provider = new MockNotesProvider();
    const items = await provider.listPendingProposals();
    const foxNeutral = items.find((i) => i.proposal.id === "seed-proposal-fox-neutral-1");
    expect(foxNeutral).toBeDefined();
    expect(foxNeutral?.kind).toBe("matchup");
    expect(foxNeutral?.characterName).toBe("フォックス");
    expect(foxNeutral?.characterSlug).toBe("fox");
    expect(foxNeutral?.noteTitle).toBe("ニュートラルの噛み合い");
  });

  it("承認するとpending一覧から消える", async () => {
    const provider = new MockNotesProvider();
    await provider.applyProposal("seed-proposal-fox-neutral-1");
    const items = await provider.listPendingProposals();
    expect(items.some((i) => i.proposal.id === "seed-proposal-fox-neutral-1")).toBe(false);
  });

  it("却下するとpending一覧から消える", async () => {
    const provider = new MockNotesProvider();
    await provider.rejectProposal("seed-proposal-mario-projectile-1");
    const items = await provider.listPendingProposals();
    expect(items.some((i) => i.proposal.id === "seed-proposal-mario-projectile-1")).toBe(false);
  });

  it("stale提案はstatus='stale'のまま一覧に残る", async () => {
    const provider = new MockNotesProvider();
    const items = await provider.listPendingProposals();
    const staleItem = items.find((i) => i.proposal.id === "seed-proposal-fox-edgeguard-1");
    expect(staleItem?.proposal.status).toBe("stale");
  });

  it("created_at降順（新しい提案が先頭）で返す", async () => {
    const provider = new MockNotesProvider();
    const items = await provider.listPendingProposals();
    const createdAts = items.map((i) => i.proposal.created_at);
    const sorted = [...createdAts].sort((a, b) => (a < b ? 1 : -1));
    expect(createdAts).toEqual(sorted);
  });
});
