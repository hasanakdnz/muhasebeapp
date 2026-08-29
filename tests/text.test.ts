import { describe, expect, it } from "vitest";
import { aramaNormalize } from "@/lib/text";

describe("aramaNormalize", () => {
  it("Türkçe büyük/küçük harf çiftlerini aynı anahtara indirger", () => {
    expect(aramaNormalize("Işık")).toBe(aramaNormalize("ışık"));
    expect(aramaNormalize("IŞIK")).toBe(aramaNormalize("ışık"));
    expect(aramaNormalize("İstanbul")).toBe(aramaNormalize("istanbul"));
  });

  it("şapka/nokta katlaması yapar — kullanıcı sade yazabilir", () => {
    expect(aramaNormalize("Işık Mühendislik")).toBe("isik muhendislik");
    expect(aramaNormalize("Çağrı Şirketi")).toBe("cagri sirketi");
    expect(aramaNormalize("Gülörnek")).toBe("gulornek");
  });

  it("fazla boşlukları sadeleştirir", () => {
    expect(aramaNormalize("  Yılmaz   Ticaret  ")).toBe("yilmaz ticaret");
  });

  it("rakam ve noktalama korunur", () => {
    expect(aramaNormalize("ABC Ltd. Şti. 2024")).toBe("abc ltd. sti. 2024");
  });
});
