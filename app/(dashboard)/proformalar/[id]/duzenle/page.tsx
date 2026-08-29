import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProformaForm } from "@/components/proforma/proforma-form";
import { duzenlenebilirMi } from "@/lib/domain/proforma";
import { listeleCariler } from "@/lib/cari";
import { toDateInputValue } from "@/lib/date";
import { proformaGetir } from "@/lib/proforma";
import { updateProforma } from "../../actions";

export const metadata: Metadata = { title: "Teklifi Düzenle · Muhasebe" };

export default async function ProformaDuzenlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [proforma, cariler] = await Promise.all([
    proformaGetir(id),
    listeleCariler(),
  ]);
  if (!proforma) notFound();

  // Faturalanmış teklif düzenlenemez — sunucu da reddeder, form hiç açılmasın.
  if (!duzenlenebilirMi(proforma.durum)) notFound();

  async function kaydet(values: Parameters<typeof updateProforma>[1]) {
    "use server";
    return updateProforma(id, values);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Teklif ${proforma.no}`}
        description="Teklifi düzenleyin."
      />
      <ProformaForm
        cariler={cariler.map((c) => ({ id: c.id, unvan: c.unvan }))}
        defaultValues={{
          cariId: proforma.cariId,
          tarih: toDateInputValue(proforma.tarih),
          gecerlilikTarihi: proforma.gecerlilikTarihi
            ? toDateInputValue(proforma.gecerlilikTarihi)
            : "",
          notlar: proforma.notlar ?? "",
          // Saklanan fiyat DAİMA net; form da net gösterir.
          kdvDahil: false,
          kalemler: proforma.kalemler.map((k) => ({
            urunAdi: k.urunAdi,
            miktar: k.miktar,
            birimFiyat: k.birimFiyat,
            kdvOrani: k.kdvOrani as "0" | "1" | "10" | "20",
          })),
        }}
        onSubmitAction={kaydet}
        submitLabel="Değişiklikleri kaydet"
        cancelHref={`/proformalar/${id}`}
      />
    </div>
  );
}
