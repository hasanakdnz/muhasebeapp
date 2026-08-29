"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import {
  cekSenetGuncelle,
  cekSenetOlustur,
  cekSenetSil,
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
  await requireUser();

  await cekSenetSil(id);

  tazele(cariId);
  redirect("/cek-senet");
}

export async function createTahsilat(
  cekSenetId: string,
  cariId: string,
  values: TahsilatInput
): Promise<ActionResult> {
  await requireUser();

  const parsed = tahsilatSchema.safeParse(values);
  if (!parsed.success) return alanHatasi(parsed.error.flatten().fieldErrors);

  try {
    await tahsilatEkle(cekSenetId, parsed.data);
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  tazele(cariId);
  revalidatePath(`/cek-senet/${cekSenetId}`);
  return { ok: true };
}

export async function deleteTahsilat(
  tahsilatId: string,
  cekSenetId: string,
  cariId: string
): Promise<ActionResult> {
  await requireUser();

  await tahsilatSil(tahsilatId);

  tazele(cariId);
  revalidatePath(`/cek-senet/${cekSenetId}`);
  return { ok: true };
}

export async function setDurum(
  id: string,
  cariId: string,
  durum: CekSenetDurumuValue
): Promise<ActionResult> {
  await requireUser();

  try {
    await durumDegistir(id, durum);
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  tazele(cariId);
  revalidatePath(`/cek-senet/${id}`);
  return { ok: true };
}
