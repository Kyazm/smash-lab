// migration 0005 の public.is_writer() と同じ規則をクライアント側でも検証する。
// SQL: coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
import { describe, it, expect } from "vitest";
import { isWriter } from "./isWriter";

describe("isWriter", () => {
  it("is_anonymous=false（本人・明示クレームあり）は書込可", () => {
    expect(isWriter(false)).toBe(true);
  });

  it("is_anonymous=true（匿名・ゲスト）は書込不可", () => {
    expect(isWriter(true)).toBe(false);
  });

  it("is_anonymous クレーム無し(undefined/null、本人JWTの通常ケース)は書込可（Critical1回避）", () => {
    // ->>'is_anonymous' = 'false' だと NULL=false→NULL→拒否になってしまうため、
    // coalesce(...,false)=false でNULLを「匿名ではない」として扱う必要がある。
    expect(isWriter(undefined)).toBe(true);
    expect(isWriter(null)).toBe(true);
  });
});
