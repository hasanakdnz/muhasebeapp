import { describe, expect, it } from "vitest";
import { canAccess, isAdminOnlyPath } from "@/lib/rbac";
import { NAV_ITEMS } from "@/lib/navigation";

describe("isAdminOnlyPath", () => {
  it("admin'e özel yolu ve alt yollarını tanır", () => {
    expect(isAdminOnlyPath("/ayarlar")).toBe(true);
    expect(isAdminOnlyPath("/ayarlar/kullanicilar")).toBe(true);
  });

  it("denetim kaydı yöneticiye özeldir", () => {
    // İşlem kaydı kimin neyi sildiğini gösterir; personel görmemeli.
    expect(isAdminOnlyPath("/kayitlar")).toBe(true);
    expect(canAccess("PERSONEL", "/kayitlar")).toBe(false);
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

describe("Menü ve yetki politikası tutarlılığı", () => {
  it("adminOnly menü öğeleri rbac tablosuyla aynı yolu işaret eder", () => {
    // İkisi ayrı dosyada; biri güncellenip diğeri unutulursa menüde görünen
    // ama açılmayan (ya da tersi) bir sayfa oluşurdu.
    for (const item of NAV_ITEMS) {
      expect(isAdminOnlyPath(item.href)).toBe(Boolean(item.adminOnly));
    }
  });
});
