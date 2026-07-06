// LocalFocusProvider の永続挙動（ADR-0018）。vitest環境はnode=localStorage無しでメモリ退避。
import { describe, expect, it } from "vitest";
import { LocalFocusProvider } from "./LocalFocusProvider";

let n = 0;
const fresh = () => new LocalFocusProvider(`test-focus-${++n}`);

describe("LocalFocusProvider", () => {
  it("add → list（active優先・作成順）", async () => {
    const p = fresh();
    const a = await p.add("崖2択", "technical");
    await p.add("攻め急がない", "mental");
    await p.update(a.id, { active: false });
    const list = await p.list();
    expect(list.map((x) => x.body)).toEqual(["攻め急がない", "崖2択"]); // active優先
    expect(list[1].active).toBe(false);
  });

  it("update で body/category/active を変更", async () => {
    const p = fresh();
    const a = await p.add("x", "technical");
    await p.update(a.id, { body: "y", category: "mental", active: false });
    const [pt] = await p.list();
    expect(pt).toMatchObject({ body: "y", category: "mental", active: false });
  });

  it("remove / clear", async () => {
    const p = fresh();
    const a = await p.add("x", "technical");
    await p.remove(a.id);
    expect(await p.list()).toEqual([]);
    await p.add("y", "mental");
    p.clear();
    expect(await p.list()).toEqual([]);
  });
});
