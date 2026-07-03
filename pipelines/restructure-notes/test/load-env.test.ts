import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/lib/load-env.js";

describe("parseEnv", () => {
  it("KEY=VALUE 形式を解釈する", () => {
    const result = parseEnv("FOO=bar\nBAZ=qux");
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("コメント行と空行を無視する", () => {
    const result = parseEnv("# comment\nFOO=bar\n\nBAZ=qux");
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("クォートされた値の引用符を除去する", () => {
    const result = parseEnv(`FOO="bar baz"\nQUX='single'`);
    expect(result).toEqual({ FOO: "bar baz", QUX: "single" });
  });

  it("値に = が含まれても最初の = で分割する", () => {
    const result = parseEnv("URL=https://example.com?a=1&b=2");
    expect(result.URL).toBe("https://example.com?a=1&b=2");
  });
});
