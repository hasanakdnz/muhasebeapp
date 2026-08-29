import { prisma } from "@/lib/prisma";
import type { FirmaOutput } from "@/lib/validations/firma";

/**
 * Firma künyesi — tek satırlık ayar kaydı.
 *
 * Sabit `id: "firma"` bilinçli: bu tablo bir liste değil, uygulamanın kendi
 * kimliği. Böylece "hangi kayıt geçerli?" sorusu hiç doğmaz ve upsert tek
 * adımda yapılabilir.
 */
export const FIRMA_ID = "firma";

export type FirmaBilgisi = {
  unvan: string;
  vknTckn: string | null;
  vergiDairesi: string | null;
  adres: string | null;
  telefon: string | null;
  email: string | null;
  iban: string | null;
  logoUrl: string | null;
  logoAdi: string | null;
};

const BOS: FirmaBilgisi = {
  unvan: "",
  vknTckn: null,
  vergiDairesi: null,
  adres: null,
  telefon: null,
  email: null,
  iban: null,
  logoUrl: null,
  logoAdi: null,
};

export async function firmaGetir(): Promise<FirmaBilgisi> {
  const kayit = await prisma.firma.findUnique({ where: { id: FIRMA_ID } });
  if (!kayit) return BOS;
  return {
    unvan: kayit.unvan,
    vknTckn: kayit.vknTckn,
    vergiDairesi: kayit.vergiDairesi,
    adres: kayit.adres,
    telefon: kayit.telefon,
    email: kayit.email,
    iban: kayit.iban,
    logoUrl: kayit.logoUrl,
    logoAdi: kayit.logoAdi,
  };
}

export async function firmaKaydet(
  veri: FirmaOutput,
  logo?: { anahtar: string; ad: string }
): Promise<void> {
  const alanlar = {
    unvan: veri.unvan,
    vknTckn: veri.vknTckn ?? null,
    vergiDairesi: veri.vergiDairesi ?? null,
    adres: veri.adres ?? null,
    telefon: veri.telefon ?? null,
    email: veri.email ?? null,
    iban: veri.iban ?? null,
    // Logo yalnızca yeni dosya yüklendiğinde değişir; form her kaydedişte
    // mevcut logoyu silmemeli.
    ...(logo ? { logoUrl: logo.anahtar, logoAdi: logo.ad } : {}),
  };

  await prisma.firma.upsert({
    where: { id: FIRMA_ID },
    create: { id: FIRMA_ID, ...alanlar },
    update: alanlar,
  });
}

export async function firmaLogosunuKaldir(): Promise<void> {
  await prisma.firma.updateMany({
    where: { id: FIRMA_ID },
    data: { logoUrl: null, logoAdi: null },
  });
}

/** Belge servis rotası için: bu anahtar firma logosu mu? */
export async function logoAnahtariKullanimda(anahtar: string): Promise<boolean> {
  const sayi = await prisma.firma.count({ where: { logoUrl: anahtar } });
  return sayi > 0;
}
