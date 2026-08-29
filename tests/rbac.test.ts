import { describe, expect, it } from "vitest";
import { canAccess, isAdminOnlyPath } from "@/lib/rbac";

describe("isAdminOnlyPath", () => {
  it("admin'e özel yolu ve alt yollarını tanır", () => {
    expect(isAdminOnlyPath("/ayarlar")).toBe(true);
    expect(isAdminOnlyPath("/ayarlar/kullanicilar")).toBe(true);
  });

  it("benzer isimli farklı yolu admin'e özel saymaz", () => {
    // Önek eşleşmesi "/ayarlarim" gibi yolları yanlışlıkla kilitlememeli.
    expect(isAdminOnlyPath("/ayarlarim")).toBe(false);
    expect(isAdminOnlyPath("/cariler")).toBe(false);
  });
});

describe("canAccess", () => {
  it("admin her yere erişir", () => {
    expect(canAccess("ADMIN", "/ayarlar")).toBe(true);
    expect(canAccess("ADMIN", "/cariler")).toBe(true);
  });

  it("personel admin sayfasına erişemez, diğerlerine erişir", () => {
    expect(canAccess("PERSONEL", "/ayarlar")).toBe(false);
    expect(canAccess("PERSONEL", "/cariler")).toBe(true);
    expect(canAccess("PERSONEL", "/dashboard")).toBe(true);
  });

  it("rolsüz (oturumsuz) erişim reddedilir", () => {
    expect(canAccess(undefined, "/dashboard")).toBe(false);
  });
});
