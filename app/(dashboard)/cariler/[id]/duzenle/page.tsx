import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CariForm } from "@/components/cari/cari-form";
import { getCari } from "@/lib/cari";
import { formatAmount } from "@/lib/money";
import type { CariInput } from "@/lib/validations/cari";
import { updateCari } from "../../actions";

export const metadata: Metadata = { title: "Cari Düzenle · Muhasebe" };

export default async function CariDuzenlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cari = await getCari(id);
  if (!cari) notFound();

  const defaultValues: CariInput = {
    unvan: cari.unvan,
    tip: cari.tip,
    vknTckn: cari.vknTckn ?? "",
    vergiDairesi: cari.vergiDairesi ?? "",
    telefon: cari.telefon ?? "",
    email: cari.email ?? "",
    adres: cari.adres ?? "",
    // Kullanıcı tutarı uygulamanın kendi gösterim dilinde görsün ("-15.200,40");
    // parseAmountInput bu biçimi zaten kayıpsız geri okur.
    bakiye: formatAmount(cari.bakiye),
  };

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader title="Cariyi düzenle" description={cari.unvan} />
      <CariForm
        defaultValues={defaultValues}
        onSubmitAction={updateCari.bind(null, cari.id)}
        submitLabel="Değişiklikleri kaydet"
        cancelHref={`/cariler/${cari.id}`}
      />
    </div>
  );
}
