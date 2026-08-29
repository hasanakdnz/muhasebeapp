import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { HesapDuzenleForm } from "@/components/kasa/hesap-duzenle-form";
import { getHesap } from "@/lib/kasa";
import { updateHesap } from "../../actions";

export const metadata: Metadata = { title: "Hesap Düzenle · Muhasebe" };

export default async function HesapDuzenlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hesap = await getHesap(id);
  if (!hesap) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Hesabı düzenle"
        description={hesap.ad}
      />
      <HesapDuzenleForm
        defaultValues={{ ad: hesap.ad, tip: hesap.tip }}
        onSubmitAction={updateHesap.bind(null, hesap.id)}
        cancelHref={`/kasa-banka/${hesap.id}`}
      />
    </div>
  );
}
