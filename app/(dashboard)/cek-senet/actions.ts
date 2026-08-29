"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminVeyaHata, requireUser } from "@/lib/auth-guards";
import { auditKaydet } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  cekSenetGuncelle,
  cekSenetOlustur,
  cekSenetSil,
  ciroEt,
  ciroGeriAl,
  durumDegistir,
  tahsilatEkle,
  tahsilatSil,
} from "@/lib/cek-senet";
import type { CekSenetDurumuValue } from "@/lib/domain/cek-senet";
import {
  cekSenetSchema,
  tahsilatSchema,
  type CekSenetInput,
  type TahsilatInput,
} from "@/lib/validations/cek-senet";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function tazele(cariId?: string) {
  revalidatePath("/cek-senet");
  revalidatePath("/dashboard");
  revalidatePath("/cariler");
  if (cariId) revalidatePath(`/cariler/${cariId}`);
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

/** İş kuralı ihlalleri (fazla tahsilat, geçersiz durum geçişi) kullanıcıya
 *  okunur bir mesaj olarak döner; beklenmeyen hatalar yukarı fırlatılır. */
function isKuraliHatasi(error: unknown): ActionResult | null {
  if (!(error instanceof Error)) return null;
  const bilinen = [
    "kalan tutardan büyük",
    "Yalnızca alınan",
    "Yalnızca portföydeki",
    "kısmen tahsil",
    "cariyi seçin",
    "kendisini veren",
    "ciro edilmemiş",
    "hedef cariyi",
    "ciroyu geri alın",
    "zaten tamamen tahsil",
    "tahsilat kaydedilemez",
    "ciro edilemez",
    "elle seçilemez",
    "altına düşürülemez",
    "karşılıksız olarak işaretlenemez",
    "sıfırdan büyük olmalı",
    "bulunamadı",
  ];
  return bilinen.some((k) => error.message.includes(k))
    ? { ok: false, error: error.message }
    : null;
}

export async function createCekSenet(
  values: CekSenetInput
): Promise<ActionResult> {
  await requireUser();

  const parsed = cekSenetSchema.safeParse(values);
  if (!parsed.success) return alanHatasi(parsed.error.flatten().fieldErrors);

  const kayit = await cekSenetOlustur(parsed.data);

  tazele(parsed.data.cariId);
  redirect(`/cek-senet/${kayit.id}`);
}

export async function updateCekSenet(
  id: string,
  values: CekSenetInput
): Promise<ActionResult> {
  await requireUser();

  const parsed = cekSenetSchema.safeParse(values);
  if (!parsed.success) return alanHatasi(parsed.error.flatten().fieldErrors);

  try {
    await cekSenetGuncelle(id, parsed.data);
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  tazele(parsed.data.cariId);
  redirect(`/cek-senet/${id}`);
}

export async function deleteCekSenet(
  id: string,
  cariId: string
): Promise<ActionResult> {
  const yetki = await adminVeyaHata();
  if (!yetki.ok) return yetki;
  const user = yetki.user;

  const kayit = await prisma.cekSenet.findUnique({
    where: { id },
    select: { tip: true, yon: true, tutar: true },
  });

  await cekSenetSil(id);
  await auditKaydet({
    userId: user.id,
    aksiyon: "SIL",
    hedefTip: "CekSenet",
    hedefId: id,
    detay: {
      tip: kayit?.tip,
      yon: kayit?.yon,
      tutar: kayit?.tutar?.toString(),
      cariId,
    },
  });

  tazele(cariId);
  redirect("/cek-senet");
}

export async function createTahsilat(
  cekSenetId: string,
  cariId: string,
  values: TahsilatInput
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = tahsilatSchema.safeParse(values);
  if (!parsed.success) return alanHatasi(parsed.error.flatten().fieldErrors);

  let tahsilatId: string;
  try {
    const tahsilat = await tahsilatEkle(cekSenetId, parsed.data);
    tahsilatId = tahsilat.id;
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  await auditKaydet({
    userId: user.id,
    aksiyon: "TAHSILAT",
    hedefTip: "CekSenetTahsilat",
    hedefId: tahsilatId,
    detay: { cekSenetId, cariId, tutar: parsed.data.tutar },
  });

  tazele(cariId);
  revalidatePath(`/cek-senet/${cekSenetId}`);
  return { ok: true };
}

export async function deleteTahsilat(
  tahsilatId: string,
  cekSenetId: string,
  cariId: string
): Promise<ActionResult> {
  const yetki = await adminVeyaHata();
  if (!yetki.ok) return yetki;
  const user = yetki.user;

  const tahsilat = await prisma.cekSenetTahsilat.findUnique({
    where: { id: tahsilatId },
    select: { tutar: true },
  });

  await tahsilatSil(tahsilatId);
  await auditKaydet({
    userId: user.id,
    aksiyon: "SIL",
    hedefTip: "CekSenetTahsilat",
    hedefId: tahsilatId,
    detay: { cekSenetId, cariId, tutar: tahsilat?.tutar?.toString() },
  });

  tazele(cariId);
  revalidatePath(`/cek-senet/${cekSenetId}`);
  return { ok: true };
}

export async function setDurum(
  id: string,
  cariId: string,
  durum: CekSenetDurumuValue
): Promise<ActionResult> {
  const user = await requireUser();

  try {
    await durumDegistir(id, durum);
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  await auditKaydet({
    userId: user.id,
    aksiyon: "DURUM",
    hedefTip: "CekSenet",
    hedefId: id,
    detay: { cariId, yeniDurum: durum },
  });

  tazele(cariId);
  revalidatePath(`/cek-senet/${id}`);
  return { ok: true };
}

/**
 * Ciro: alınan çeki bir tedarikçiye devreder. İki cari bakiyesini birden
 * etkilediği için etkilenen HER İKİ cari sayfası da tazelenir.
 */
export async function ciroEtAction(
  id: string,
  cariId: string,
  hedefCariId: string,
  tarih: string
): Promise<ActionResult> {
  const user = await requireUser();

  const gecerliTarih = /^\d{4}-\d{2}-\d{2}$/.test(tarih.trim());
  if (!gecerliTarih) return { ok: false, error: "Geçerli bir tarih girin." };
  const [yil, ay, gun] = tarih.trim().split("-").map(Number);

  try {
    await ciroEt(id, hedefCariId, new Date(yil, ay - 1, gun));
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  await auditKaydet({
    userId: user.id,
    aksiyon: "CIRO",
    hedefTip: "CekSenet",
    hedefId: id,
    detay: { verenCariId: cariId, hedefCariId, tarih },
  });

  tazele(cariId);
  revalidatePath(`/cariler/${hedefCariId}`);
  revalidatePath(`/cek-senet/${id}`);
  return { ok: true };
}

export async function ciroGeriAlAction(
  id: string,
  cariId: string,
  hedefCariId: string
): Promise<ActionResult> {
  const user = await requireUser();

  try {
    await ciroGeriAl(id);
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  await auditKaydet({
    userId: user.id,
    aksiyon: "CIRO",
    hedefTip: "CekSenet",
    hedefId: id,
    detay: { verenCariId: cariId, hedefCariId, geriAlindi: true },
  });

  tazele(cariId);
  revalidatePath(`/cariler/${hedefCariId}`);
  revalidatePath(`/cek-senet/${id}`);
  return { ok: true };
}
