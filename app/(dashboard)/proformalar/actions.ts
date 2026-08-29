"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminVeyaHata, requireUser } from "@/lib/auth-guards";
import { auditKaydet } from "@/lib/audit";
import type { ProformaDurumuValue } from "@/lib/domain/proforma";
import { prisma } from "@/lib/prisma";
import {
  proformaDurumDegistir,
  proformaGuncelle,
  proformaOlustur,
  proformaSil,
  proformayiIsleDonustur,
} from "@/lib/proforma";
import { proformaSchema, type ProformaInput } from "@/lib/validations/proforma";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function tazele(id?: string) {
  revalidatePath("/proformalar");
  if (id) revalidatePath(`/proformalar/${id}`);
}

function alanHatasi(
  fieldErrors: Record<string, string[] | undefined>
): ActionResult {
  return {
    ok: false,
    error: "Girilen bilgilerde hata var.",
    fieldErrors: fieldErrors as Record<string, string[]>,
  };
}

/** İş kuralı ihlalleri kullanıcıya okunur mesaj döner; diğerleri fırlatılır. */
function isKuraliHatasi(error: unknown): ActionResult | null {
  if (!(error instanceof Error)) return null;
  const bilinen = [
    "geçilemez",
    "düzenlenemez",
    "silinemez",
    "dönüştürülemez",
    "Yalnızca kabul edilen",
    "zaten faturalandırılmış",
    "bulunamadı",
  ];
  return bilinen.some((k) => error.message.includes(k))
    ? { ok: false, error: error.message }
    : null;
}

export async function createProforma(
  values: ProformaInput
): Promise<ActionResult> {
  await requireUser();

  // Client tarafında da doğrulanır; server asla client'a güvenmez (CLAUDE.md).
  const parsed = proformaSchema.safeParse(values);
  if (!parsed.success) return alanHatasi(parsed.error.flatten().fieldErrors);

  let kayitId: string;
  try {
    const kayit = await proformaOlustur(parsed.data);
    kayitId = kayit.id;
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    if (error instanceof Error && error.message.includes("Cari bulunamadı")) {
      return { ok: false, error: "Seçilen cari bulunamadı." };
    }
    throw error;
  }

  tazele();
  // redirect() NEXT_REDIRECT fırlatır; try/catch DIŞINDA çağrılmalı.
  redirect(`/proformalar/${kayitId}`);
}

export async function updateProforma(
  id: string,
  values: ProformaInput
): Promise<ActionResult> {
  await requireUser();

  const parsed = proformaSchema.safeParse(values);
  if (!parsed.success) return alanHatasi(parsed.error.flatten().fieldErrors);

  try {
    await proformaGuncelle(id, parsed.data);
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  tazele(id);
  redirect(`/proformalar/${id}`);
}

export async function setProformaDurumu(
  id: string,
  durum: ProformaDurumuValue
): Promise<ActionResult> {
  const user = await requireUser();

  try {
    await proformaDurumDegistir(id, durum);
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  await auditKaydet({
    userId: user.id,
    aksiyon: "DURUM",
    hedefTip: "Proforma",
    hedefId: id,
    detay: { yeniDurum: durum },
  });

  tazele(id);
  return { ok: true };
}

/**
 * Teklifi faturaya dönüştürür — cari bakiyesi ilk kez burada değişir, bu
 * yüzden denetim kaydına parasal etki de yazılır.
 */
export async function proformayiFaturala(
  id: string,
  tarih: string,
  vadeTarihi: string
): Promise<ActionResult> {
  const user = await requireUser();

  const gun = (deger: string): Date | undefined => {
    const raw = deger.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
    const [yil, ay, g] = raw.split("-").map(Number);
    return new Date(yil, ay - 1, g);
  };

  const islemTarihi = gun(tarih);
  if (!islemTarihi) return { ok: false, error: "Geçerli bir fatura tarihi girin." };

  let islemId: string;
  try {
    const sonuc = await proformayiIsleDonustur(id, {
      tarih: islemTarihi,
      vadeTarihi: gun(vadeTarihi),
    });
    islemId = sonuc.islemId;
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  const p = await prisma.proforma.findUnique({
    where: { id },
    select: { no: true, cariId: true, toplamTutar: true },
  });
  await auditKaydet({
    userId: user.id,
    aksiyon: "OLUSTUR",
    hedefTip: "Islem",
    hedefId: islemId,
    detay: {
      kaynak: "proforma",
      proformaNo: p?.no,
      cariId: p?.cariId,
      tutar: p?.toplamTutar?.toString(),
    },
  });

  tazele(id);
  revalidatePath("/islemler");
  revalidatePath("/dashboard");
  revalidatePath("/cariler");
  if (p?.cariId) revalidatePath(`/cariler/${p.cariId}`);
  redirect(`/islemler/${islemId}`);
}

export async function deleteProforma(id: string): Promise<ActionResult> {
  // Silme yönetici yetkisi ister (RBAC): personel kayıt girer, yönetici siler.
  const yetki = await adminVeyaHata();
  if (!yetki.ok) return yetki;

  const p = await prisma.proforma.findUnique({
    where: { id },
    select: { no: true, cariId: true, toplamTutar: true },
  });

  try {
    await proformaSil(id);
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  await auditKaydet({
    userId: yetki.user.id,
    aksiyon: "SIL",
    hedefTip: "Proforma",
    hedefId: id,
    detay: {
      no: p?.no,
      cariId: p?.cariId,
      tutar: p?.toplamTutar?.toString(),
    },
  });

  tazele();
  redirect("/proformalar");
}
