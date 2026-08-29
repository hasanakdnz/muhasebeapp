"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminVeyaHata, requireUser } from "@/lib/auth-guards";
import { auditKaydet } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  giderBelgesiniKaldir,
  giderGuncelle,
  giderOlustur,
  giderSil,
} from "@/lib/gider";
import { belgeKaydet } from "@/lib/storage";
import { giderSchema } from "@/lib/validations/gider";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function tazele(id?: string) {
  revalidatePath("/giderler");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/giderler/${id}`);
}

/** FormData'dan alanları okur — dosya yüklemesi olduğu için tipli nesne değil. */
function alanlariOku(formData: FormData) {
  return {
    kategori: formData.get("kategori"),
    tutar: formData.get("tutar"),
    kdvOrani: formData.get("kdvOrani"),
    aciklama: formData.get("aciklama"),
    tarih: formData.get("tarih"),
  };
}

async function belgeyiIsle(
  formData: FormData
): Promise<
  { ok: true; belge?: { anahtar: string; ad: string } } | { ok: false; hata: string }
> {
  const dosya = formData.get("belge");
  if (!(dosya instanceof File) || dosya.size === 0) return { ok: true };

  const sonuc = await belgeKaydet(dosya);
  if (!sonuc.ok) return { ok: false, hata: sonuc.hata };
  return { ok: true, belge: { anahtar: sonuc.anahtar, ad: sonuc.ad } };
}

export async function createGider(formData: FormData): Promise<ActionResult> {
  await requireUser();

  // Client tarafında da doğrulanır; server asla client'a güvenmez (CLAUDE.md).
  const parsed = giderSchema.safeParse(alanlariOku(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Girilen bilgilerde hata var.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const belgeSonuc = await belgeyiIsle(formData);
  if (!belgeSonuc.ok) return { ok: false, error: belgeSonuc.hata };

  const gider = await giderOlustur(parsed.data, belgeSonuc.belge);

  tazele();
  redirect(`/giderler/${gider.id}`);
}

export async function updateGider(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireUser();

  const parsed = giderSchema.safeParse(alanlariOku(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Girilen bilgilerde hata var.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const belgeSonuc = await belgeyiIsle(formData);
  if (!belgeSonuc.ok) return { ok: false, error: belgeSonuc.hata };

  await giderGuncelle(id, parsed.data, belgeSonuc.belge);

  tazele(id);
  redirect(`/giderler/${id}`);
}

export async function deleteGider(id: string): Promise<ActionResult> {
  const yetki = await adminVeyaHata();
  if (!yetki.ok) return yetki;
  const user = yetki.user;

  const gider = await prisma.gider.findUnique({
    where: { id },
    select: { kategori: true, tutar: true, aciklama: true },
  });

  await giderSil(id);
  await auditKaydet({
    userId: user.id,
    aksiyon: "SIL",
    hedefTip: "Gider",
    hedefId: id,
    detay: {
      kategori: gider?.kategori,
      tutar: gider?.tutar?.toString(),
      aciklama: gider?.aciklama,
    },
  });

  tazele();
  redirect("/giderler");
}

export async function removeBelge(id: string): Promise<ActionResult> {
  // Belge kaldırma da geri alınamaz (dosya diskten silinir) — yönetici işi.
  const yetki = await adminVeyaHata();
  if (!yetki.ok) return yetki;
  const user = yetki.user;

  await giderBelgesiniKaldir(id);
  await auditKaydet({
    userId: user.id,
    aksiyon: "SIL",
    hedefTip: "Gider",
    hedefId: id,
    detay: { alan: "belge" },
  });

  tazele(id);
  return { ok: true };
}
