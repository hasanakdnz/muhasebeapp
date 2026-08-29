import { describe, expect, it } from "vitest";
import { isValidTckn, isValidVkn, isValidVknTckn, vknTcknTipi } from "@/lib/identity";

describe("isValidTckn", () => {
  it("resmî sağlama algoritmasını geçen numarayı kabul eder", () => {
    // Yaygın kullanılan geçerli test numarası.
    expect(isValidTckn("10000000146")).toBe(true);
  });

  it("sağlama hanesi bozuk numarayı reddeder", () => {
    expect(isValidTckn("10000000147")).toBe(false); // 11. hane yanlış
    expect(isValidTckn("10000000156")).toBe(false); // 10. hane yanlış
  });

  it("0 ile başlayan numarayı reddeder", () => {
    expect(isValidTckn("01234567890")).toBe(false);
  });

  it("hane sayısı ve karakter tipini kontrol eder", () => {
    expect(isValidTckn("1000000014")).toBe(false); // 10 hane
    expect(isValidTckn("100000001466")).toBe(false); // 12 hane
    expect(isValidTckn("1000000014a")).toBe(false);
    expect(isValidTckn("")).toBe(false);
  });
});

describe("isValidVkn", () => {
  it("10 haneli rakam dizisini kabul eder", () => {
    expect(isValidVkn("1234567890")).toBe(true);
  });

  it("yanlış uzunluğu ve rakam olmayanı reddeder", () => {
    expect(isValidVkn("123456789")).toBe(false);
    expect(isValidVkn("12345678901")).toBe(false);
    expect(isValidVkn("123456789a")).toBe(false);
  });
});

describe("isValidVknTckn", () => {
  it("hem VKN hem TCKN kabul eder", () => {
    expect(isValidVknTckn("1234567890")).toBe(true);
    expect(isValidVknTckn("10000000146")).toBe(true);
  });

  it("11 hanede TCKN sağlamasını uygular", () => {
    // 11 hane olduğu için TCKN kuralına tabidir; sağlaması tutmuyor.
    expect(isValidVknTckn("12345678901")).toBe(false);
  });

  it("başındaki/sonundaki boşluğu yok sayar", () => {
    expect(isValidVknTckn("  1234567890  ")).toBe(true);
  });
});

describe("vknTcknTipi", () => {
  it("numara tipini ayırt eder", () => {
    expect(vknTcknTipi("1234567890")).toBe("VKN");
    expect(vknTcknTipi("10000000146")).toBe("TCKN");
    expect(vknTcknTipi("abc")).toBeNull();
  });
});
