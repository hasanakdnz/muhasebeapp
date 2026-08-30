import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CekSenetForm } from "@/components/cek-senet/cek-senet-form";
import { listeleCariler } from "@/lib/cari";
import { getCekSenet } from "@/lib/cek-senet";
import { toDateInputValue } from "@/lib/date";
import { formatAmount } from "@/lib/money";
import { updateCekSenet } from "../../actions";

export const metadata: Metadata = { title: "Çek/Senet Düzenle · Muhasebe" };

export default async function CekSenetDuzenlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [kayit, cariler] = await Promise.all([
    getCekSenet(id),
    listeleCariler(),
  ]);
  if (!kayit) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader title="Çek/senedi düzenle" description={kayit.cariUnvan} />
      <CekSenetForm
        cariler={cariler.map((c) => ({ id: c.id, unvan: c.unvan }))}
        defaultValues={{
          tip: kayit.tip,
          yon: kayit.yon,
          cariId: kayit.cariId,
          tutar: formatAmount(kayit.tutar),
          tarih: toDateInputValue(kayit.tarih),
          vadeTarihi: toDateInputValue(kayit.vadeTarihi),
          aciklama: kayit.aciklama ?? "",
        }}
        onSubmitAction={updateCekSenet.bind(null, kayit.id)}
        submitLabel="Değişiklikleri kaydet"
        cancelHref={`/cek-senet/${kayit.id}`}
      />
    </div>
  );
}
