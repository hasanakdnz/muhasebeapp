import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ProformaForm } from "@/components/proforma/proforma-form";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listeleCariler } from "@/lib/cari";
import { toDateInputValue } from "@/lib/date";
import { proformaFormDefaults } from "@/lib/validations/proforma";
import { createProforma } from "../actions";

export const metadata: Metadata = { title: "Yeni Teklif · Muhasebe" };

export default async function YeniProformaPage() {
  const cariler = await listeleCariler();

  if (cariler.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Yeni teklif" />
        <EmptyState
          title="Önce cari eklemelisiniz"
          description="Teklif bir cari hesaba bağlanır."
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
        title="Yeni teklif"
        description="Proforma fatura oluşturun. Kaydetmek muhasebeye işlemez."
      />
      <ProformaForm
        cariler={cariler.map((c) => ({ id: c.id, unvan: c.unvan }))}
        defaultValues={{
          ...proformaFormDefaults,
          // Tarih sunucuda üretilir; client'ta üretilseydi saat dilimi farkı
          // hydration uyuşmazlığı yaratabilirdi.
          tarih: toDateInputValue(new Date()),
        }}
        onSubmitAction={createProforma}
        submitLabel="Teklifi kaydet"
        cancelHref="/proformalar"
      />
    </div>
  );
}
