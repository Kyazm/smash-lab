// LocalSessionProvider の不変条件（ADR-0018）: activeは常に最大1件、finishはendedAtを上書きしない。
import { describe, expect, it } from "vitest";
import { LocalSessionProvider } from "./LocalSessionProvider";

let n = 0;
const fresh = () => new LocalSessionProvider(`test-session-${++n}`);

describe("LocalSessionProvider", () => {
  it("start → getActive", async () => {
    const p = fresh();
    const s = await p.start("崖狩りで2択を通す");
    const active = await p.getActive();
    expect(active?.id).toBe(s.id);
    expect(active?.goal).toBe("崖狩りで2択を通す");
    expect(active?.endedAt).toBeNull();
  });

  it("start は既存activeを自動クローズする（多重active無し・振り返りはnullで残る）", async () => {
    const p = fresh();
    const first = await p.start("a");
    await p.start("b");
    const recent = await p.listRecent(10);
    const actives = recent.filter((s) => s.endedAt == null);
    expect(actives).toHaveLength(1);
    expect(actives[0].goal).toBe("b");
    const closed = recent.find((s) => s.id === first.id);
    expect(closed?.endedAt).not.toBeNull();
    expect(closed?.retroMd).toBeNull(); // 未振り返りとして残る（後から書ける）
  });

  it("finish で終了+retro保存、終了済みへの後書きretroはendedAtを上書きしない", async () => {
    const p = fresh();
    const s = await p.start("a");
    await p.finish(s.id, "振り返り1");
    const [done] = await p.listRecent(1);
    expect(done.endedAt).not.toBeNull();
    expect(done.retroMd).toBe("振り返り1");
    const endedAt = done.endedAt;
    await p.finish(s.id, "追記した振り返り");
    const [again] = await p.listRecent(1);
    expect(again.endedAt).toBe(endedAt); // 上書きされない
    expect(again.retroMd).toBe("追記した振り返り");
  });

  it("getActive は無ければ null / clear で全消去", async () => {
    const p = fresh();
    expect(await p.getActive()).toBeNull();
    await p.start("a");
    p.clear();
    expect(await p.getActive()).toBeNull();
    expect(await p.listRecent(5)).toEqual([]);
  });
});
