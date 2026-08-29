import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { HesapForm } from "@/components/kasa/hesap-form";
import { toDateInputValue } from "@/lib/date";
import { hesapFormDefaults } from "@/lib/validations/kasa";
import { createHesap } from "../actions";

export const metadata: Metadata = { title: "Yeni Hesap · Muhasebe" };

export default function YeniHesapPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Yeni hesap"
        description="Kasa veya banka hesabı tanımlayın."
      />
      <HesapForm
        defaultValues={{
          ...hesapFormDefaults,
          // Tarih sunucuda üretilir; client'ta üretilseydi saat dilimi farkı
          // hydration uyuşmazlığı yaratabilirdi.
          acilisTarihi: toDateInputValue(new Date()),
        }}
        onSubmitAction={createHesap}
        submitLabel="Hesabı kaydet"
        cancelHref="/kasa-banka"
      />
    </div>
  );
}
