import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CariForm } from "@/components/cari/cari-form";
import { cariFormDefaults } from "@/lib/validations/cari";
import { createCari } from "../actions";

export const metadata: Metadata = { title: "Yeni Cari · Muhasebe" };

export default function YeniCariPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Yeni cari"
        description="Müşteri veya tedarikçi hesabı oluşturun."
      />
      <CariForm
        defaultValues={cariFormDefaults}
        onSubmitAction={createCari}
        submitLabel="Cariyi kaydet"
        cancelHref="/cariler"
      />
    </div>
  );
}
