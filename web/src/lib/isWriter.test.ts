// migration 0005 の public.is_writer()（auth.uid()=OWNER_UID）と同じ規則をクライアント側でも検証する。
import { describe, it, expect } from "vitest";
import { isWriter } from "./isWriter";
import { GUEST_UID } from "../data/guestConfig";

describe("isWriter", () => {
  it("オーナー本人（ゲストでない認証uid）は書込可", () => {
    expect(isWriter("2035ebe5-27c0-4c31-b34d-cc957a0529f8")).toBe(true);
  });

  it("ゲスト（GUEST_UID）は書込不可", () => {
    expect(isWriter(GUEST_UID)).toBe(false);
  });

  it("未認証（uidなし）は書込不可", () => {
    expect(isWriter(undefined)).toBe(false);
    expect(isWriter(null)).toBe(false);
  });
});
