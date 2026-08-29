import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { YazdirButonu } from "@/components/proforma/yazdir-butonu";
import { Amount } from "@/components/ui/amount";
import { buttonVariants } from "@/components/ui/button";
import { formatTarih } from "@/lib/date";
import { PROFORMA_DURUM_ETIKETI } from "@/lib/domain/proforma";
import { firmaGetir } from "@/lib/firma";
import { formatYuzde } from "@/lib/money";
import { proformaGetir } from "@/lib/proforma";

export const metadata: Metadata = { title: "Teklif Çıktısı · Muhasebe" };

/**
 * Yazdırılabilir teklif belgesi — ROADMAP'teki "PDF proforma şablonu".
 *
 * PDF, tarayıcının kendi "PDF olarak kaydet" çıktısıyla alınır; ayrı bir PDF
 * kütüphanesi eklenmedi. Gerekçe: Türkçe karakterler için gömülü font, sayfa
 * kırılımı ve bakım maliyeti getiren bir bağımlılık, tarayıcının zaten yaptığı
 * işi tekrar ederdi. Çıktının düzeni burada HTML olarak tanımlıdır, baskıya
 * özel kurallar app/globals.css içindeki @media print bloğundadır.
 *
 * DESIGN.md: süsleme yok, çerçeve/motif yok; hiyerarşi tipografi ağırlığı ve
 * boşlukla kurulur, tutarlar data-numeric.
 */
export default async function ProformaYazdirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [proforma, firma] = await Promise.all([proformaGetir(id), firmaGetir()]);
  if (!proforma) notFound();

  const taslak = proforma.durum === "TASLAK";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {/* Ekran kontrolleri — baskıda görünmez. */}
      <div
        data-print="gizle"
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <Link
          href={`/proformalar/${id}`}
          className={buttonVariants({ variant: "text" })}
        >
          <ArrowLeft />
          Teklife dön
        </Link>
        <div className="flex items-center gap-4">
          {taslak && (
            <p className="text-body-sm text-amber">
              Bu teklif henüz taslak durumunda.
            </p>
          )}
          <YazdirButonu />
        </div>
      </div>

      <article className="flex flex-col gap-10 text-ink">
        {/* Künye */}
        <header className="flex flex-wrap items-start justify-between gap-8">
          <div className="flex flex-col gap-3">
            {firma.logoUrl && (
              <Image
                src={`/api/belge/${firma.logoUrl}`}
                alt={firma.logoAdi ?? firma.unvan}
                width={200}
                height={64}
                unoptimized
                className="h-14 w-auto max-w-48 object-contain object-left"
              />
            )}
            <div className="flex flex-col gap-1">
              <p className="text-heading-md">
                {firma.unvan || "Firma ünvanı tanımlanmadı"}
              </p>
              {firma.adres && (
                <p className="max-w-xs whitespace-pre-line text-body-sm text-muted">
                  {firma.adres}
                </p>
              )}
              {(firma.vknTckn || firma.vergiDairesi) && (
                <p className="text-body-sm text-muted">
                  {firma.vergiDairesi}
                  {firma.vergiDairesi && firma.vknTckn ? " · " : ""}
                  {firma.vknTckn && (
                    <span data-numeric="">{firma.vknTckn}</span>
                  )}
                </p>
              )}
              {(firma.telefon || firma.email) && (
                <p className="text-body-sm text-muted">
                  {firma.telefon}
                  {firma.telefon && firma.email ? " · " : ""}
                  {firma.email}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 text-right">
            <p className="text-label-md text-muted">Proforma fatura</p>
            <p className="text-display-md" data-numeric="">
              {proforma.no}
            </p>
            <p className="text-body-sm text-muted">
              Tarih: {formatTarih(proforma.tarih)}
            </p>
            {proforma.gecerlilikTarihi && (
              <p className="text-body-sm text-muted">
                Geçerlilik: {formatTarih(proforma.gecerlilikTarihi)}
              </p>
            )}
            {taslak && (
              <p className="text-body-sm text-amber">
                {PROFORMA_DURUM_ETIKETI.TASLAK}
              </p>
            )}
          </div>
        </header>

        {/* Alıcı */}
        <section className="flex flex-col gap-1 border-t border-border pt-6">
          <p className="text-label-md text-muted">Sayın</p>
          <p className="text-heading-md">{proforma.cariUnvan}</p>
          {proforma.cariAdres && (
            <p className="max-w-md whitespace-pre-line text-body-sm text-muted">
              {proforma.cariAdres}
            </p>
          )}
          {(proforma.cariVknTckn || proforma.cariVergiDairesi) && (
            <p className="text-body-sm text-muted">
              {proforma.cariVergiDairesi}
              {proforma.cariVergiDairesi && proforma.cariVknTckn ? " · " : ""}
              {proforma.cariVknTckn && (
                <span data-numeric="">{proforma.cariVknTckn}</span>
              )}
            </p>
          )}
        </section>

        {/* Kalemler */}
        <table className="w-full border-collapse text-body-md">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 pr-4 text-left text-label-md font-medium text-muted">
                Ürün / hizmet
              </th>
              <th className="py-3 px-4 text-right text-label-md font-medium text-muted">
                Miktar
              </th>
              <th className="py-3 px-4 text-right text-label-md font-medium text-muted">
                Birim fiyat
              </th>
              <th className="py-3 px-4 text-right text-label-md font-medium text-muted">
                KDV
              </th>
              <th className="py-3 pl-4 text-right text-label-md font-medium text-muted">
                Tutar
              </th>
            </tr>
          </thead>
          <tbody>
            {proforma.kalemler.map((k) => (
              <tr key={k.id} className="border-b border-border">
                <td className="py-3 pr-4">{k.urunAdi}</td>
                <td className="py-3 px-4 text-right" data-numeric="">
                  {k.miktar}
                </td>
                <td className="py-3 px-4 text-right">
                  <Amount value={k.birimFiyat} />
                </td>
                <td className="py-3 px-4 text-right" data-numeric="">
                  %{formatYuzde(k.kdvOrani, 0)}
                </td>
                <td className="py-3 pl-4 text-right">
                  <Amount value={k.matrah} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Toplamlar */}
        <div className="flex justify-end">
          <dl className="flex w-full max-w-xs flex-col gap-2">
            <div className="flex items-baseline justify-between gap-6">
              <dt className="text-body-md text-muted">Ara toplam</dt>
              <dd>
                <Amount value={proforma.matrah} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-6">
              <dt className="text-body-md text-muted">KDV</dt>
              <dd>
                <Amount value={proforma.kdvTutari} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 border-t border-border pt-2">
              <dt className="text-body-md">Genel toplam</dt>
              <dd className="text-heading-md">
                <Amount value={proforma.toplamTutar} />
              </dd>
            </div>
          </dl>
        </div>

        {proforma.notlar && (
          <section className="flex flex-col gap-2 border-t border-border pt-6">
            <p className="text-label-md text-muted">Notlar</p>
            <p className="max-w-2xl whitespace-pre-line text-body-md">
              {proforma.notlar}
            </p>
          </section>
        )}

        <footer className="flex flex-wrap items-end justify-between gap-8 border-t border-border pt-6">
          <div className="flex flex-col gap-1">
            {firma.iban && (
              <>
                <p className="text-label-md text-muted">Ödeme bilgisi</p>
                <p className="text-body-md" data-numeric="">
                  {firma.iban}
                </p>
              </>
            )}
            <p className="mt-2 max-w-md text-body-sm text-muted">
              Bu belge proforma faturadır; mali değeri yoktur ve muhasebe kaydı
              oluşturmaz.
            </p>
          </div>

          {/* Kaşe / imza alanı — DESIGN.md gereği çerçeve değil, ince çizgi. */}
          <div className="flex w-56 flex-col gap-2">
            <div className="h-20 border-b border-border" />
            <p className="text-label-md text-muted">Kaşe / İmza</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
