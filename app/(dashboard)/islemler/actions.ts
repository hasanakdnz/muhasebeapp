"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminVeyaHata, requireUser } from "@/lib/auth-guards";
import { auditKaydet } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { kdvDahilNete } from "@/lib/domain/islem";
import { islemOlustur, islemSil } from "@/lib/islem";
import { odemeEkle, odemeSil } from "@/lib/odeme";
import { islemSchema, type IslemInput } from "@/lib/validations/islem";
import { odemeSchema, type OdemeInput } from "@/lib/validations/odeme";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function tazele(cariId: string) {
  revalidatePath("/islemler");
  revalidatePath("/dashboard");
  revalidatePath("/cariler");
  revalidatePath(`/cariler/${cariId}`);
}

export async function createIslem(values: IslemInput): Promise<ActionResult> {
  await requireUser();

  // Client tarafında da doğrulanır; server asla client'a güvenmez (CLAUDE.md).
  const parsed = islemSchema.safeParse(values);
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

  const { kdvDahil, kalemler, ...islem } = parsed.data;

  let kayitId: string;
  try {
    const kayit = await islemOlustur({
      tip: islem.tip,
      cariId: islem.cariId,
      tarih: islem.tarih,
      vadeTarihi: islem.vadeTarihi,
      kalemler: kalemler.map((k) => ({
        urunAdi: k.urunAdi,
        miktar: k.miktar,
        // Veritabanına DAİMA KDV hariç (net) fiyat yazılır.
        birimFiyat: kdvDahil
          ? kdvDahilNete(k.birimFiyat, k.kdvOrani)
          : k.birimFiyat,
        kdvOrani: k.kdvOrani,
      })),
    });
    kayitId = kayit.id;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cari bulunamadı")) {
      return { ok: false, error: "Seçilen cari bulunamadı." };
    }
    throw error;
  }

  tazele(islem.cariId);
  // redirect() NEXT_REDIRECT fırlatır; try/catch DIŞINDA çağrılmalı,
  // aksi halde yukarıdaki catch bloğu sinyali yutardı.
  redirect(`/islemler/${kayitId}`);
}

export async function deleteIslem(
  id: string,
  cariId: string
): Promise<ActionResult> {
  const yetki = await adminVeyaHata();
  if (!yetki.ok) return yetki;
  const user = yetki.user;

  // Silinen kaydın kimliği log için silmeden ÖNCE okunur.
  const islem = await prisma.islem.findUnique({
    where: { id },
    select: { tip: true, tarih: true, toplamTutar: true },
  });

  await islemSil(id);
  await auditKaydet({
    userId: user.id,
    aksiyon: "SIL",
    hedefTip: "Islem",
    hedefId: id,
    detay: {
      tip: islem?.tip,
      tarih: islem?.tarih?.toISOString(),
      tutar: islem?.toplamTutar?.toString(),
      cariId,
    },
  });

  tazele(cariId);
  redirect("/islemler");
}

/** İş kuralı ihlalleri kullanıcıya okunur mesaj döner; diğerleri fırlatılır. */
function isKuraliHatasi(error: unknown): ActionResult | null {
  if (!(error instanceof Error)) return null;
  const bilinen = [
    "kalan tutardan büyük",
    "zaten tamamen ödenmiş",
    "sıfırdan büyük olmalı",
    "dağıtılabilecek tutar",
    "carisine ait değil",
    "Çek tahsilatı seçin",
    "ödeme kaydedilemez",
    "bulunamadı",
  ];
  return bilinen.some((k) => error.message.includes(k))
    ? { ok: false, error: error.message }
    : null;
}

export async function createOdeme(
  islemId: string,
  cariId: string,
  veri: OdemeInput
): Promise<ActionResult> {
  const user = await requireUser();

  // Client tarafında da doğrulanır; server asla client'a güvenmez (CLAUDE.md).
  // Tutar burada kullanıcı biçiminden ("3.930,00") kanonik Decimal'e çevrilir —
  // alan katmanı ham kullanıcı girdisini çözmez.
  const parsed = odemeSchema.safeParse(veri);
  if (!parsed.success) {
    const ilkHata = parsed.error.issues[0]?.message ?? "Girilen bilgilerde hata var.";
    return { ok: false, error: ilkHata };
  }

  let odemeId: string;
  try {
    const odeme = await odemeEkle(islemId, {
      tutar: parsed.data.tutar,
      tarih: parsed.data.tarih,
      kaynak: parsed.data.kaynak,
      cekSenetTahsilatId: parsed.data.cekSenetTahsilatId,
      hesapId: parsed.data.hesapId,
      aciklama: parsed.data.aciklama,
    });
    odemeId = odeme.id;
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  await auditKaydet({
    userId: user.id,
    aksiyon: "ODEME",
    hedefTip: "IslemOdeme",
    hedefId: odemeId,
    detay: {
      islemId,
      cariId,
      tutar: parsed.data.tutar,
      kaynak: parsed.data.kaynak,
    },
  });

  tazele(cariId);
  revalidatePath(`/islemler/${islemId}`);
  revalidatePath("/kasa-banka");
  return { ok: true };
}

export async function deleteOdeme(
  odemeId: string,
  islemId: string,
  cariId: string
): Promise<ActionResult> {
  const yetki = await adminVeyaHata();
  if (!yetki.ok) return yetki;
  const user = yetki.user;

  const odeme = await prisma.islemOdeme.findUnique({
    where: { id: odemeId },
    select: { tutar: true, kaynak: true },
  });

  try {
    await odemeSil(odemeId);
  } catch (error) {
    const sonuc = isKuraliHatasi(error);
    if (sonuc) return sonuc;
    throw error;
  }

  await auditKaydet({
    userId: user.id,
    aksiyon: "SIL",
    hedefTip: "IslemOdeme",
    hedefId: odemeId,
    detay: {
      islemId,
      cariId,
      tutar: odeme?.tutar?.toString(),
      kaynak: odeme?.kaynak,
    },
  });

  tazele(cariId);
  revalidatePath(`/islemler/${islemId}`);
  return { ok: true };
}
