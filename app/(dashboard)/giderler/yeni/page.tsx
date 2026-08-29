import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { GiderForm } from "@/components/gider/gider-form";
import { toDateInputValue } from "@/lib/date";
import { giderFormDefaults } from "@/lib/validations/gider";
import { createGider } from "../actions";

export const metadata: Metadata = { title: "Yeni Gider · Muhasebe" };

export default function YeniGiderPage() {
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
        onSubmitAction={createGider}
        submitLabel="Gideri kaydet"
        cancelHref="/giderler"
      />
    </div>
  );
}
