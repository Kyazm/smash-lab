import { describe, expect, it } from "vitest";
import {
  computeEveryN,
  parseDuration,
  parseFps,
  parseShowinfoPtsTimes,
  sliceThumbnails,
} from "../src/lib/video.js";

describe("parseDuration", () => {
  it("整数秒をパースする", () => {
    expect(parseDuration("213\n")).toBe(213);
  });
  it("小数秒をパースする", () => {
    expect(parseDuration("213.44")).toBeCloseTo(213.44);
  });
  it("先頭の非数値行を飛ばす", () => {
    expect(parseDuration("WARNING: foo\n99.5\n")).toBeCloseTo(99.5);
  });
  it("取れなければ 0", () => {
    expect(parseDuration("N/A")).toBe(0);
    expect(parseDuration("")).toBe(0);
  });
});

describe("parseFps", () => {
  it("分数表記を割る", () => {
    expect(parseFps("30000/1001")).toBeCloseTo(29.97, 2);
    expect(parseFps("60/1")).toBe(60);
  });
  it("分母0は 25 フォールバック", () => {
    expect(parseFps("0/0")).toBe(25);
  });
  it("非数値は 25 フォールバック", () => {
    expect(parseFps("N/A")).toBe(25);
  });
  it("単純な数値も受ける", () => {
    expect(parseFps("50")).toBe(50);
  });
});

describe("parseShowinfoPtsTimes", () => {
  it("stderr から pts_time を出現順で抽出する", () => {
    const stderr = [
      "[Parsed_showinfo_1 @ 0x1] n:   0 pts:      0 pts_time:0       duration:1",
      "[Parsed_showinfo_1 @ 0x1] n:   1 pts:  15015 pts_time:1.5015  duration:1",
      "[Parsed_showinfo_1 @ 0x1] n:   2 pts:  30030 pts_time:3.003   duration:1",
    ].join("\n");
    expect(parseShowinfoPtsTimes(stderr)).toEqual([0, 1.5015, 3.003]);
  });
  it("pts_time が無ければ空配列", () => {
    expect(parseShowinfoPtsTimes("no frames here")).toEqual([]);
  });
});

describe("computeEveryN", () => {
  it("fps * floor を丸める", () => {
    expect(computeEveryN(29.97, 1.0)).toBe(30);
    expect(computeEveryN(60, 1.0)).toBe(60);
  });
  it("下限は 1", () => {
    expect(computeEveryN(0.2, 1.0)).toBe(1);
  });
});

describe("sliceThumbnails", () => {
  it("768byte 単位に分割する", () => {
    const buf = new Uint8Array(768 * 3);
    expect(sliceThumbnails(buf).length).toBe(3);
    expect(sliceThumbnails(buf)[0].length).toBe(768);
  });
  it("端数は切り捨てる", () => {
    const buf = new Uint8Array(768 * 2 + 10);
    expect(sliceThumbnails(buf).length).toBe(2);
  });
});
