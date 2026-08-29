"use server";

import { revalidatePath } from "next/cache";
import { adminVeyaHata } from "@/lib/auth-guards";
import { auditKaydet } from "@/lib/audit";
import { FIRMA_ID, firmaKaydet, firmaLogosunuKaldir } from "@/lib/firma";
import { belgeKaydet } from "@/lib/storage";
import { firmaSchema } from "@/lib/validations/firma";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Logo yalnızca görsel olabilir — PDF bir antet değildir. */
const LOGO_MIME = ["image/jpeg", "image/png", "image/webp"];

function tazele() {
  revalidatePath("/ayarlar");
  // Proforma çıktısı firma künyesini kullanır.
  revalidatePath("/proformalar", "layout");
}

export async function saveFirma(formData: FormData): Promise<ActionResult> {
  // Firma künyesi müşteriye giden belgelerde görünür — yönetici ayarı.
  const yetki = await adminVeyaHata();
  if (!yetki.ok) return yetki;

  // Client tarafında da doğrulanır; server asla client'a güvenmez (CLAUDE.md).
  const parsed = firmaSchema.safeParse({
    unvan: formData.get("unvan"),
    vknTckn: formData.get("vknTckn"),
    vergiDairesi: formData.get("vergiDairesi"),
    adres: formData.get("adres"),
    telefon: formData.get("telefon"),
    email: formData.get("email"),
    iban: formData.get("iban"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Girilen bilgilerde hata var.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  let logo: { anahtar: string; ad: string } | undefined;
  const dosya = formData.get("logo");
  if (dosya instanceof File && dosya.size > 0) {
    if (!LOGO_MIME.includes(dosya.type)) {
      return { ok: false, error: "Logo JPG, PNG veya WebP olmalı." };
    }
    const sonuc = await belgeKaydet(dosya);
    if (!sonuc.ok) return { ok: false, error: sonuc.hata };
    logo = { anahtar: sonuc.anahtar, ad: sonuc.ad };
  }

  await firmaKaydet(parsed.data, logo);
  await auditKaydet({
    userId: yetki.user.id,
    aksiyon: "GUNCELLE",
    hedefTip: "Firma",
    hedefId: FIRMA_ID,
    detay: { unvan: parsed.data.unvan, logoDegisti: Boolean(logo) },
  });

  tazele();
  return { ok: true };
}

export async function removeLogo(): Promise<ActionResult> {
  const yetki = await adminVeyaHata();
  if (!yetki.ok) return yetki;

  await firmaLogosunuKaldir();
  await auditKaydet({
    userId: yetki.user.id,
    aksiyon: "GUNCELLE",
    hedefTip: "Firma",
    hedefId: FIRMA_ID,
    detay: { alan: "logo", kaldirildi: true },
  });

  tazele();
  return { ok: true };
}
