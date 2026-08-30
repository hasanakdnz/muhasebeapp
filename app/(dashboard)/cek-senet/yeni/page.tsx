import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CekSenetForm } from "@/components/cek-senet/cek-senet-form";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listeleCariler } from "@/lib/cari";
import { toDateInputValue } from "@/lib/date";
import { cekSenetFormDefaults } from "@/lib/validations/cek-senet";
import { createCekSenet } from "../actions";

export const metadata: Metadata = { title: "Yeni Çek/Senet · Muhasebe" };

export default async function YeniCekSenetPage() {
  const cariler = await listeleCariler();

  if (cariler.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Yeni çek/senet" />
        <EmptyState
          title="Önce cari eklemelisiniz"
          description="Çek/senet bir cari hesaba bağlanır."
          action={
            <Link href="/cariler/yeni" className={buttonVariants()}>
              Yeni cari
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Yeni çek/senet"
        description="Alınan veya verilen çek/senet kaydı."
      />
      <CekSenetForm
        cariler={cariler.map((c) => ({ id: c.id, unvan: c.unvan }))}
        defaultValues={{
          ...cekSenetFormDefaults,
          // Tarih sunucuda üretilir; client'ta üretilseydi saat dilimi farkı
          // hydration uyuşmazlığı yaratabilirdi.
          tarih: toDateInputValue(new Date()),
          vadeTarihi: toDateInputValue(new Date()),
        }}
        onSubmitAction={createCekSenet}
        submitLabel="Kaydet"
        cancelHref="/cek-senet"
      />
    </div>
  );
}
