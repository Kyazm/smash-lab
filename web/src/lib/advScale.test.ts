import { describe, expect, it } from "vitest";
import { advLevel, formatFrames } from "./advScale";

describe("advLevel", () => {
  it("classifies safe (>=0)", () => {
    expect(advLevel(0)).toBe("safe");
    expect(advLevel(5)).toBe("safe");
  });
  it("classifies minor (-1..-4)", () => {
    expect(advLevel(-1)).toBe("minor");
    expect(advLevel(-4)).toBe("minor");
  });
  it("classifies caution (-5..-9)", () => {
    expect(advLevel(-5)).toBe("caution");
    expect(advLevel(-9)).toBe("caution");
  });
  it("classifies punish (<=-10)", () => {
    expect(advLevel(-10)).toBe("punish");
    expect(advLevel(-40)).toBe("punish");
  });
  it("boundary transitions are exact", () => {
    expect(advLevel(-4)).toBe("minor");
    expect(advLevel(-5)).toBe("caution");
    expect(advLevel(-9)).toBe("caution");
    expect(advLevel(-10)).toBe("punish");
  });
});

describe("formatFrames", () => {
  it("adds + sign for positive", () => {
    expect(formatFrames(3)).toBe("+3F");
  });
  it("shows 0 without sign", () => {
    expect(formatFrames(0)).toBe("0F");
  });
  it("keeps - sign for negative", () => {
    expect(formatFrames(-7)).toBe("-7F");
  });
});
