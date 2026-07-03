// LocalMatchProvider の永続挙動確認（ADR-0015）。vitest環境はnode=localStorage無しでメモリ退避で動く。
// テスト間干渉を避けるため、各テストで一意の storageKey のインスタンスを使う。
import { describe, it, expect } from "vitest";
import { LocalMatchProvider } from "./LocalMatchProvider";

let n = 0;
function freshProvider(): LocalMatchProvider {
  n += 1;
  return new LocalMatchProvider(`test-match-key-${n}`);
}

describe("LocalMatchProvider", () => {
  it("addResult した記録を listResults が createdAt 昇順で返す", async () => {
    const p = freshProvider();
    await p.addResult({ characterId: "c1", mode: "vip", result: "win" });
    await p.addResult({ characterId: "c1", mode: "vip", result: "lose" });
    const all = await p.listResults();
    expect(all).toHaveLength(2);
    expect(all[0].createdAt <= all[1].createdAt).toBe(true);
    expect(all.map((r) => r.result)).toEqual(["win", "lose"]);
  });

  it("characterId / mode でフィルタできる", async () => {
    const p = freshProvider();
    await p.addResult({ characterId: "c1", mode: "vip", result: "win" });
    await p.addResult({ characterId: "c2", mode: "vip", result: "win" });
    await p.addResult({ characterId: "c1", mode: "offline", result: "lose" });
    expect(await p.listResults({ characterId: "c1" })).toHaveLength(2);
    expect(await p.listResults({ mode: "vip" })).toHaveLength(2);
    expect(await p.listResults({ characterId: "c1", mode: "offline" })).toHaveLength(1);
  });

  it("deleteResult で1件削除できる（undo）", async () => {
    const p = freshProvider();
    const rec = await p.addResult({ characterId: "c1", mode: "vip", result: "win" });
    await p.addResult({ characterId: "c1", mode: "vip", result: "lose" });
    await p.deleteResult(rec.id);
    const all = await p.listResults();
    expect(all).toHaveLength(1);
    expect(all[0].result).toBe("lose");
  });

  it("clear で全消去される", async () => {
    const p = freshProvider();
    await p.addResult({ characterId: "c1", mode: "vip", result: "win" });
    p.clear();
    expect(await p.listResults()).toEqual([]);
  });
});
