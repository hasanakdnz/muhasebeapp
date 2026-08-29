"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminVeyaHata, requireUser } from "@/lib/auth-guards";
import { auditKaydet } from "@/lib/audit";
import {
  hareketEkle,
  hareketSil,
  hesapGuncelle,
  hesapOlustur,
  hesapSil,
  hesapSilinebilirMi,
  setHesapAktif,
} from "@/lib/kasa";
import {
  hareketSchema,
  hesapDuzenleSchema,
  hesapSchema,
  type HareketInput,
  type HesapDuzenleInput,
  type HesapInput,
} from "@/lib/validations/kasa";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function hataSonucu(
  fieldErrors: Record<string, string[] | undefined>
): ActionResult {
  return {
    ok: false,
    error: "Girilen bilgilerde hata var.",
    fieldErrors: fieldErrors as Record<string, string[]>,
  };
}

export async function createHesap(values: HesapInput): Promise<ActionResult> {
  await requireUser();

  // Client tarafında da doğrulanır; server asla client'a güvenmez (CLAUDE.md).
  const parsed = hesapSchema.safeParse(values);
  if (!parsed.success) return hataSonucu(parsed.error.flatten().fieldErrors);

  const hesap = await hesapOlustur(parsed.data);

  revalidatePath("/kasa-banka");
  redirect(`/kasa-banka/${hesap.id}`);
}

export async function updateHesap(
  id: string,
  values: HesapDuzenleInput
): Promise<ActionResult> {
  await requireUser();

  const parsed = hesapDuzenleSchema.safeParse(values);
  if (!parsed.success) return hataSonucu(parsed.error.flatten().fieldErrors);

  await hesapGuncelle(id, parsed.data);

  revalidatePath("/kasa-banka");
  revalidatePath(`/kasa-banka/${id}`);
  redirect(`/kasa-banka/${id}`);
}

/** Hareketi olan hesap silinemez; doğru aksiyon pasife almaktır. */
export async function deleteHesap(id: string): Promise<ActionResult> {
  const yetki = await adminVeyaHata();
  if (!yetki.ok) return yetki;
  const user = yetki.user;

  const durum = await hesapSilinebilirMi(id);
  if (!durum.silinebilir) {
    return {
      ok: false,
      error: `Bu hesapta ${durum.hareketSayisi} hareket kaydı var, silinemez. Bunun yerine pasife alabilirsiniz.`,
    };
  }

  await hesapSil(id);
  await auditKaydet({
    userId: user.id,
    aksiyon: "SIL",
    hedefTip: "KasaBanka",
    hedefId: id,
  });

  revalidatePath("/kasa-banka");
  redirect("/kasa-banka");
}

export async function setHesapDurumu(
  id: string,
  aktif: boolean
): Promise<ActionResult> {
  await requireUser();
  await setHesapAktif(id, aktif);
  revalidatePath("/kasa-banka");
  revalidatePath(`/kasa-banka/${id}`);
  return { ok: true };
}

export async function createHareket(
  hesapId: string,
  values: HareketInput
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = hareketSchema.safeParse(values);
  if (!parsed.success) return hataSonucu(parsed.error.flatten().fieldErrors);

  const hareket = await hareketEkle(hesapId, parsed.data);
  await auditKaydet({
    userId: user.id,
    aksiyon: "ODEME",
    hedefTip: "HesapHareketi",
    hedefId: hareket.id,
    detay: {
      hesapId,
      yon: parsed.data.yon,
      tutar: parsed.data.tutar,
    },
  });

  revalidatePath("/kasa-banka");
  revalidatePath(`/kasa-banka/${hesapId}`);
  return { ok: true };
}

export async function deleteHareket(
  hareketId: string,
  hesapId: string
): Promise<ActionResult> {
  const yetki = await adminVeyaHata();
  if (!yetki.ok) return yetki;
  const user = yetki.user;

  await hareketSil(hareketId);
  await auditKaydet({
    userId: user.id,
    aksiyon: "SIL",
    hedefTip: "HesapHareketi",
    hedefId: hareketId,
    detay: { hesapId },
  });

  revalidatePath("/kasa-banka");
  revalidatePath(`/kasa-banka/${hesapId}`);
  return { ok: true };
}
