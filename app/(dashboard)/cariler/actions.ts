"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { cariSilinebilirMi, cariVerisiHazirla } from "@/lib/cari";
import { prisma } from "@/lib/prisma";
import { cariSchema, type CariInput } from "@/lib/validations/cari";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createCari(values: CariInput): Promise<ActionResult> {
  await requireUser();

  // Client tarafında da doğrulanır; server asla client'a güvenmez (CLAUDE.md).
  const parsed = cariSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Girilen bilgilerde hata var.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const cari = await prisma.cari.create({
    data: cariVerisiHazirla(parsed.data),
    select: { id: true },
  });

  revalidatePath("/cariler");
  // `yeni` parametresi listede yeni satırın kısa vurgusu için kullanılır (DESIGN.md).
  redirect(`/cariler?yeni=${cari.id}`);
}

export async function updateCari(
  id: string,
  values: CariInput
): Promise<ActionResult> {
  await requireUser();

  const parsed = cariSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Girilen bilgilerde hata var.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const mevcut = await prisma.cari.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) return { ok: false, error: "Cari bulunamadı." };

  await prisma.cari.update({
    where: { id },
    data: cariVerisiHazirla(parsed.data),
  });

  revalidatePath("/cariler");
  revalidatePath(`/cariler/${id}`);
  redirect(`/cariler/${id}`);
}

/**
 * Silme yalnızca hiç muhasebe kaydı olmayan cariler için mümkündür.
 * Kayıt varsa doğru aksiyon pasife almaktır — bu, kullanıcıya söylenir.
 */
export async function deleteCari(id: string): Promise<ActionResult> {
  await requireUser();

  const durum = await cariSilinebilirMi(id);
  if (!durum.silinebilir) {
    const parcalar: string[] = [];
    if (durum.islemSayisi > 0) parcalar.push(`${durum.islemSayisi} işlem`);
    if (durum.cekSenetSayisi > 0)
      parcalar.push(`${durum.cekSenetSayisi} çek/senet`);
    return {
      ok: false,
      error: `Bu cariye bağlı ${parcalar.join(" ve ")} kaydı var, silinemez. Bunun yerine pasife alabilirsiniz.`,
    };
  }

  await prisma.cari.delete({ where: { id } });
  revalidatePath("/cariler");
  redirect("/cariler");
}

export async function setCariAktif(
  id: string,
  aktif: boolean
): Promise<ActionResult> {
  await requireUser();

  await prisma.cari.update({ where: { id }, data: { aktif } });
  revalidatePath("/cariler");
  revalidatePath(`/cariler/${id}`);
  return { ok: true };
}
