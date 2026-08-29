"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { kdvDahilNete } from "@/lib/domain/islem";
import { islemOlustur, islemSil } from "@/lib/islem";
import { islemSchema, type IslemInput } from "@/lib/validations/islem";

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
  await requireUser();

  await islemSil(id);

  tazele(cariId);
  redirect("/islemler");
}
