import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { GiderForm } from "@/components/gider/gider-form";
import { toDateInputValue } from "@/lib/date";
import { listeleHesaplar } from "@/lib/kasa";
import { giderFormDefaults } from "@/lib/validations/gider";
import { createGider } from "../actions";

export const metadata: Metadata = { title: "Yeni Gider · Muhasebe" };

export default async function YeniGiderPage() {
  const hesaplar = await listeleHesaplar();

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Yeni gider"
        description="Masraf kaydı oluşturun ve fişini ekleyin."
      />
      <GiderForm
        defaultValues={{
          ...giderFormDefaults,
          tarih: toDateInputValue(new Date()),
        }}
        hesaplar={hesaplar.map((h) => ({ id: h.id, ad: h.ad }))}
        onSubmitAction={createGider}
        submitLabel="Gideri kaydet"
        cancelHref="/giderler"
      />
    </div>
  );
}
