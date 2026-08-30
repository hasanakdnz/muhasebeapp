import { beforeEach, describe, expect, it } from "vitest";
import {
  KILIT_SURESI_MS,
  MAKS_DENEME,
  PENCERE_MS,
  kilitMesaji,
  limitDurumu,
  pencereyeIndir,
} from "@/lib/domain/giris-limiti";
import {
  basariliGirisTemizle,
  basarisizGirisKaydet,
  girisAnahtarlari,
  girisDenenebilirMi,
  girisSayaciniSifirla,
} from "@/lib/giris-limiti";
import { SAHTE_HASH, hashPassword, verifyPassword } from "@/lib/password";
import { authConfig } from "@/lib/auth.config";

describe("Giriş deneme sınırı — kural", () => {
  const T = 1_000_000;

  it("sınırın altında izin verir", () => {
    const denemeler = Array.from({ length: MAKS_DENEME - 1 }, () => T);
    expect(limitDurumu(denemeler, T).izinli).toBe(true);
  });

  it("sınıra ulaşınca kilitler", () => {
    const denemeler = Array.from({ length: MAKS_DENEME }, () => T);
    const d = limitDurumu(denemeler, T);
    expect(d.izinli).toBe(false);
    expect(d.izinli === false && d.kalanSaniye).toBe(KILIT_SURESI_MS / 1000);
  });

  it("kilit süresi dolunca yeniden izin verir", () => {
    const denemeler = Array.from({ length: MAKS_DENEME }, () => T);
    expect(limitDurumu(denemeler, T + KILIT_SURESI_MS).izinli).toBe(true);
  });

  it("kilitliyken yapılan deneme süreyi UZATIR", () => {
    // Aksi halde saldırgan kilidin bitmesini bekleyip yeni hak kazanırdı.
    const eski = Array.from({ length: MAKS_DENEME }, () => T);
    const yeniDeneme = T + 5 * 60_000;
    const d = limitDurumu([...eski, yeniDeneme], yeniDeneme);
    expect(d.izinli).toBe(false);
    expect(d.izinli === false && d.kalanSaniye).toBe(KILIT_SURESI_MS / 1000);
  });

  it("pencere dışındaki eski denemeler sayılmaz", () => {
    const cokEski = Array.from({ length: MAKS_DENEME }, () => T);
    const simdi = T + PENCERE_MS + 1;
    expect(pencereyeIndir(cokEski, simdi)).toHaveLength(0);
    expect(limitDurumu(cokEski, simdi).izinli).toBe(true);
  });

  it("kilit mesajı kalan süreyi dakika olarak söyler", () => {
    expect(kilitMesaji(900)).toMatch(/15 dakika/);
    // Bir dakikanın altı da "1 dakika" olarak yuvarlanır — "0 dakika" saçmadır.
    expect(kilitMesaji(20)).toMatch(/1 dakika/);
  });
});

describe("Giriş deneme sayacı — durum", () => {
  beforeEach(() => girisSayaciniSifirla());

  it("art arda başarısız denemeler girişi kilitler", () => {
    const anahtarlar = girisAnahtarlari("kurban@ornek.com", "10.0.0.1");

    for (let i = 0; i < MAKS_DENEME; i += 1) {
      expect(girisDenenebilirMi(anahtarlar).izinli).toBe(true);
      basarisizGirisKaydet(anahtarlar);
    }

    expect(girisDenenebilirMi(anahtarlar).izinli).toBe(false);
  });

  it("başarılı giriş sayacı sıfırlar", () => {
    const anahtarlar = girisAnahtarlari("kurban@ornek.com", "10.0.0.1");
    for (let i = 0; i < MAKS_DENEME - 1; i += 1) basarisizGirisKaydet(anahtarlar);

    basariliGirisTemizle(anahtarlar);

    for (let i = 0; i < MAKS_DENEME - 1; i += 1) {
      expect(girisDenenebilirMi(anahtarlar).izinli).toBe(true);
      basarisizGirisKaydet(anahtarlar);
    }
  });

  it("e-posta değiştirerek IP sınırı atlatılamaz", () => {
    const ip = "10.0.0.9";
    // Saldırgan her denemede farklı e-posta kullanıyor.
    for (let i = 0; i < MAKS_DENEME; i += 1) {
      basarisizGirisKaydet(girisAnahtarlari(`hedef${i}@ornek.com`, ip));
    }
    // IP sayacı doldu: yeni bir e-posta da reddedilir.
    expect(
      girisDenenebilirMi(girisAnahtarlari("baska@ornek.com", ip)).izinli
    ).toBe(false);
  });

  it("IP değiştirerek e-posta sınırı atlatılamaz", () => {
    const eposta = "hedef@ornek.com";
    for (let i = 0; i < MAKS_DENEME; i += 1) {
      basarisizGirisKaydet(girisAnahtarlari(eposta, `10.0.0.${i}`));
    }
    expect(
      girisDenenebilirMi(girisAnahtarlari(eposta, "10.0.0.200")).izinli
    ).toBe(false);
  });

  it("başka kullanıcının kilidi masum kullanıcıyı etkilemez", () => {
    for (let i = 0; i < MAKS_DENEME; i += 1) {
      basarisizGirisKaydet(girisAnahtarlari("hedef@ornek.com", "10.0.0.1"));
    }
    expect(
      girisDenenebilirMi(girisAnahtarlari("masum@ornek.com", "10.0.0.2")).izinli
    ).toBe(true);
  });

  it("e-posta büyük/küçük harf farkıyla sınır atlatılamaz", () => {
    for (let i = 0; i < MAKS_DENEME; i += 1) {
      basarisizGirisKaydet(girisAnahtarlari("Hedef@Ornek.com", null));
    }
    expect(girisDenenebilirMi(girisAnahtarlari("hedef@ornek.com", null)).izinli).toBe(
      false
    );
  });
});

describe("Kullanıcı sayımı (enumeration) koruması", () => {
  it("sahte hash gerçek bir bcrypt doğrulaması yapar ve hiçbir parolayla eşleşmez", async () => {
    // Kullanıcı bulunamadığında bu hash ile karşılaştırılır; amaç yanıt
    // süresinin "kayıtlı e-posta" ile "kayıtsız e-posta" arasında ayrım
    // yaratmaması (ölçülen fark düzeltmeden önce ~200ms idi).
    const t0 = performance.now();
    const sonuc = await verifyPassword("herhangi-bir-sifre", SAHTE_HASH);
    const sahteSure = performance.now() - t0;

    expect(sonuc).toBe(false);

    const gercek = await hashPassword("DogruSifre123!");
    const t1 = performance.now();
    await verifyPassword("YanlisSifre123!", gercek);
    const gercekSure = performance.now() - t1;

    // İki dal aynı büyüklükte olmalı. Kesin eşitlik beklenemez; sahte hash
    // gerçeğin yarısından hızlıysa maliyet ödenmiyor demektir.
    expect(sahteSure).toBeGreaterThan(gercekSure * 0.5);
  });
});

describe("Oturum ömrü", () => {
  it("varsayılan 30 gün yerine iş günü uzunluğunda", () => {
    // Muhasebe verisine erişen bir çerez bir ay boyunca geçerli kalmamalı.
    expect(authConfig.session.maxAge).toBe(12 * 60 * 60);
    expect(authConfig.session.maxAge).toBeLessThan(24 * 60 * 60);
  });
});

describe("Yönetici sayfaları kendi yetkisini doğrular", () => {
  it("ADMIN_ONLY_PREFIXES içindeki her sayfa requireAdminSayfa çağırır", async () => {
    // middleware yalnızca JWT'ye bakar ve JWT giriş anındaki rolü taşır;
    // yetkisi düşürülen kullanıcı eski token'la yönetici sayfasını doğrudan
    // açabiliyordu. Sayfanın kendisi de doğrulamalı. Bu test, ileride eklenen
    // bir yönetici sayfasının kapıyı unutmasını engeller.
    const { readFile } = await import("node:fs/promises");
    const { ADMIN_ONLY_PREFIXES } = await import("@/lib/rbac");

    for (const prefix of ADMIN_ONLY_PREFIXES) {
      const yol = `app/(dashboard)${prefix}/page.tsx`;
      const icerik = await readFile(yol, "utf8");
      expect(icerik, `${yol} yetki kapısını çağırmıyor`).toContain(
        "requireAdminSayfa()"
      );
    }
  });

  it("yetki listesi boş değil — kapı testi anlamsızlaşmasın", async () => {
    const { ADMIN_ONLY_PREFIXES } = await import("@/lib/rbac");
    expect(ADMIN_ONLY_PREFIXES.length).toBeGreaterThan(0);
  });
});
