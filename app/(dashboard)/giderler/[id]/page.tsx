import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { GiderActions } from "@/components/gider/gider-actions";
import { Amount } from "@/components/ui/amount";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardLabel, CardTitle } from "@/components/ui/card";
import { formatTarih } from "@/lib/date";
import { getGider } from "@/lib/gider";

export const metadata: Metadata = { title: "Gider · Muhasebe" };

export default async function GiderDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const gider = await getGider(id);
  if (!gider) notFound();

  const belgeUrl = gider.belgeUrl ? `/api/belge/${gider.belgeUrl}` : null;
  const gorselMi = Boolean(gider.belgeUrl && !gider.belgeUrl.endsWith(".pdf"));

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <PageHeader
        title={gider.kategori}
        description={formatTarih(gider.tarih)}
        actions={
          <div className="flex flex-col items-end gap-3">
            <Link
              href={`/giderler/${gider.id}/duzenle`}
              className={buttonVariants()}
            >
              <Pencil />
              Düzenle
            </Link>
            <GiderActions id={gider.id} belgeVarMi={Boolean(gider.belgeUrl)} />
          </div>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardLabel>Toplam (KDV dahil)</CardLabel>
          <p className="mt-2 text-display-lg">
            <Amount value={gider.tutar} tone="negative" />
          </p>
        </Card>
        <Card>
          <CardLabel>Matrah</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={gider.matrah} />
          </p>
        </Card>
        <Card>
          <CardLabel>KDV (%{gider.kdvOrani})</CardLabel>
          <p className="mt-2 text-display-md">
            <Amount value={gider.kdvTutari} />
          </p>
        </Card>
      </div>

      {gider.aciklama && (
        <Card>
          <CardLabel>Açıklama</CardLabel>
          <p className="mt-2 whitespace-pre-line text-body-md text-ink">
            {gider.aciklama}
          </p>
        </Card>
      )}

      <Card className="flex flex-col gap-6">
        <CardTitle>Fiş / dekont</CardTitle>
        {belgeUrl ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-body-md text-ink">
                {gider.belgeAdi ?? "Belge"}
              </span>
              <a
                href={belgeUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "secondary" })}
              >
                <ExternalLink />
                Aç
              </a>
            </div>
            {gorselMi && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={belgeUrl}
                alt={gider.belgeAdi ?? "Fiş görseli"}
                className="max-h-[32rem] w-auto self-start rounded-app border border-border"
              />
            )}
          </div>
        ) : (
          <p className="text-body-md text-muted">
            Bu gidere belge eklenmemiş. Düzenle ekranından fiş yükleyebilirsiniz.
          </p>
        )}
      </Card>
    </div>
  );
}
