import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { IslemForm } from "@/components/islem/islem-form";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listeleCariler } from "@/lib/cari";
import { toDateInputValue } from "@/lib/date";
import { islemFormDefaults } from "@/lib/validations/islem";

export const metadata: Metadata = { title: "Yeni İşlem · Muhasebe" };

export default async function YeniIslemPage() {
  const cariler = await listeleCariler();

  if (cariler.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Yeni işlem" />
        <EmptyState
          title="Önce cari eklemelisiniz"
          description="Satış veya alış kaydı bir cari hesaba bağlanır."
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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Yeni işlem"
        description="Satış veya alış kaydı oluşturun."
      />
      <IslemForm
        cariler={cariler.map((c) => ({ id: c.id, unvan: c.unvan }))}
        defaultValues={{
          ...islemFormDefaults,
          // Tarih sunucuda üretilir; client'ta üretilseydi saat dilimi farkı
          // hydration uyuşmazlığı yaratabilirdi.
          tarih: toDateInputValue(new Date()),
        }}
      />
    </div>
  );
}
