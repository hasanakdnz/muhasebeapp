import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { GiderForm } from "@/components/gider/gider-form";
import { toDateInputValue } from "@/lib/date";
import { getGider } from "@/lib/gider";
import { formatAmount } from "@/lib/money";
import type { GiderInput } from "@/lib/validations/gider";
import { updateGider } from "../../actions";

export const metadata: Metadata = { title: "Gider Düzenle · Muhasebe" };

export default async function GiderDuzenlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const gider = await getGider(id);
  if (!gider) notFound();

  const defaultValues = {
    kategori: gider.kategori,
    tutar: formatAmount(gider.tutar),
    kdvOrani: gider.kdvOrani,
    aciklama: gider.aciklama ?? "",
    tarih: toDateInputValue(gider.tarih),
  } as GiderInput;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader title="Gideri düzenle" description={gider.kategori} />
      <GiderForm
        defaultValues={defaultValues}
        onSubmitAction={updateGider.bind(null, gider.id)}
        submitLabel="Değişiklikleri kaydet"
        cancelHref={`/giderler/${gider.id}`}
        mevcutBelgeAdi={gider.belgeAdi}
      />
    </div>
  );
}
