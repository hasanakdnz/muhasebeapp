import { describe, expect, it } from "vitest";
import { DURATION, easeOutProgress } from "@/lib/motion";

describe("motion token'ları", () => {
  it("DESIGN.md'deki süreleri taşır", () => {
    expect(DURATION.fast).toBe(120);
    expect(DURATION.base).toBe(200);
    expect(DURATION.slow).toBe(500);
  });
});

describe("easeOutProgress", () => {
  it("uçlarda 0 ve 1 döner", () => {
    expect(easeOutProgress(0)).toBe(0);
    expect(easeOutProgress(1)).toBe(1);
  });

  it("aralık dışını kırpar", () => {
    expect(easeOutProgress(-1)).toBe(0);
    expect(easeOutProgress(2)).toBe(1);
  });

  it("monoton artar ve ease-out'tur (başta hızlı)", () => {
    expect(easeOutProgress(0.25)).toBeGreaterThan(0.25);
    expect(easeOutProgress(0.5)).toBeGreaterThan(easeOutProgress(0.25));
    expect(easeOutProgress(0.75)).toBeGreaterThan(easeOutProgress(0.5));
  });
});
