import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CariActions } from "@/components/cari/cari-actions";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { cariSilinebilirMi, getCari } from "@/lib/cari";
import { formatTarih } from "@/lib/date";
import { toDecimal } from "@/lib/money";
import { CARI_TIP_ETIKETI } from "@/lib/validations/cari";

export const metadata: Metadata = { title: "Cari Kartı · Muhasebe" };

function Satir({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-6">
      <span className="text-label-md text-muted sm:w-44 sm:shrink-0">
        {label}
      </span>
      <span className="text-body-md text-ink">{children}</span>
    </div>
  );
}

export default async function CariDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cari = await getCari(id);
  if (!cari) notFound();

  const { silinebilir } = await cariSilinebilirMi(cari.id);
  const bakiye = toDecimal(cari.bakiye);
  const bakiyeAciklamasi = bakiye.isZero()
    ? "Hesap kapalı"
    : bakiye.isPositive()
      ? "Cari size borçlu"
      : "Siz cariye borçlusunuz";

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <PageHeader
        title={cari.unvan}
        description={CARI_TIP_ETIKETI[cari.tip]}
        actions={
          <div className="flex flex-col items-end gap-3">
            <Link
              href={`/cariler/${cari.id}/duzenle`}
              className={buttonVariants()}
            >
              <Pencil />
              Düzenle
            </Link>
            <CariActions
              id={cari.id}
              unvan={cari.unvan}
              aktif={cari.aktif}
              silinebilir={silinebilir}
            />
          </div>
        }
      />

      <Card>
        <CardLabel>Bakiye</CardLabel>
        <p className="mt-2 text-display-lg">
          <Amount value={cari.bakiye} colored />
        </p>
        <p className="mt-1 text-body-sm text-muted">{bakiyeAciklamasi}</p>
      </Card>

      <Card>
        <Satir label="Durum">
          {cari.aktif ? (
            <Badge variant="positive">aktif</Badge>
          ) : (
            <Badge variant="neutral">pasif</Badge>
          )}
        </Satir>
        <Satir label="VKN / TCKN">
          {cari.vknTckn ? <span data-numeric="">{cari.vknTckn}</span> : "—"}
        </Satir>
        <Satir label="Vergi dairesi">{cari.vergiDairesi ?? "—"}</Satir>
        <Satir label="Telefon">{cari.telefon ?? "—"}</Satir>
        <Satir label="E-posta">
          {cari.email ? (
            <a href={`mailto:${cari.email}`} className="hover:underline">
              {cari.email}
            </a>
          ) : (
            "—"
          )}
        </Satir>
        <Satir label="Adres">
          <span className="whitespace-pre-line">{cari.adres ?? "—"}</span>
        </Satir>
        <Satir label="Kayıt tarihi">{formatTarih(cari.createdAt)}</Satir>
        <Satir label="Bağlı kayıtlar">
          <span className="text-muted">
            {cari.islemSayisi} işlem · {cari.cekSenetSayisi} çek/senet
          </span>
        </Satir>
      </Card>
    </div>
  );
}
