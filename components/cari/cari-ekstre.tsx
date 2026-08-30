import Link from "next/link";
import { Download } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  LedgerBody,
  LedgerCell,
  LedgerHead,
  LedgerHeadCell,
  LedgerRow,
  LedgerTable,
} from "@/components/ui/ledger-table";
import { formatTarih } from "@/lib/date";
import { CARI_HAREKET_ETIKETI } from "@/lib/domain/cari-ekstre";
import type { CariEkstresi } from "@/lib/cari";

/**
 * Cari ekstresi.
 *
 * Kart yalnızca bir bakiye gösteriyordu; "-60.000 nereden çıktı?" sorusunun
 * cevabı kayıtları tek tek gezmekten geçiyordu. Ekstre bakiyeyi oluşturan her
 * hareketi kronolojik ve yürüyen bakiyeyle gösterir.
 *
 * DESIGN.md Ledger Tables: tutar sütunu sağa yaslı ve `data-numeric`, artı
 * yeşil eksi kırmızı; başka hiçbir sütunda renk yok. Yürüyen bakiye NÖTR
 * kalır — her satırı renklendirmek tabloyu alarm tahtasına çevirirdi, oysa
 * anlam taşıyan şey hareketin yönü.
 */
export function CariEkstre({
  ekstre,
  cariId,
}: {
  ekstre: CariEkstresi;
  cariId: string;
}) {
  if (ekstre.satirlar.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-heading-md text-ink">Ekstre</h2>
        <EmptyState
          title="Henüz hareket yok"
          description="Bu cariye ait işlem, çek/senet veya ödeme kaydedildiğinde burada görünür."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <h2 className="text-heading-md text-ink">Ekstre</h2>
          <p className="text-body-sm text-muted">
            {ekstre.hareketSayisi} hareket
          </p>
        </div>
        <div className="flex items-center gap-2" data-print="gizle">
          <a
            href={`/api/rapor/cari-ekstre?cari=${cariId}`}
            className={buttonVariants({ variant: "text" })}
          >
            <Download />
            Excel (CSV)
          </a>
        </div>
      </div>

      {!ekstre.mutabik && (
        <Card className="border border-red">
          <CardLabel>Uyuşmazlık</CardLabel>
          <p className="mt-2 text-body-md text-red">
            Ekstrenin son bakiyesi, kayıtlı bakiyeyle ({" "}
            <Amount value={ekstre.sonBakiye} /> ) tutmuyor. Bu, ekstrede eksik
            bir kaynak olduğu anlamına gelir; rakamlara güvenmeyin ve
            <code className="mx-1 text-body-sm">npm run db:bakiye-yenile</code>
            çalıştırın.
          </p>
        </Card>
      )}

      <LedgerTable>
        <LedgerHead>
          <tr>
            <LedgerHeadCell>Tarih</LedgerHeadCell>
            <LedgerHeadCell>Hareket</LedgerHeadCell>
            <LedgerHeadCell>Açıklama</LedgerHeadCell>
            <LedgerHeadCell numeric>Tutar</LedgerHeadCell>
            <LedgerHeadCell numeric>Bakiye</LedgerHeadCell>
          </tr>
        </LedgerHead>
        <LedgerBody>
          {/* Açılış satırı bir hareket değil, başlangıç noktasıdır — bu yüzden
              tutar sütunu boş, yalnızca bakiye yazılır. */}
          <LedgerRow>
            <LedgerCell className="whitespace-nowrap text-muted">—</LedgerCell>
            <LedgerCell className="text-muted">
              {CARI_HAREKET_ETIKETI.ACILIS}
            </LedgerCell>
            <LedgerCell className="text-muted">—</LedgerCell>
            <LedgerCell numeric className="text-muted">
              —
            </LedgerCell>
            <LedgerCell numeric className="text-muted">
              <Amount value={ekstre.acilisBakiyesi} />
            </LedgerCell>
          </LedgerRow>

          {ekstre.satirlar.map((s, i) => (
            <LedgerRow key={`${s.tur}-${i}`}>
              <LedgerCell className="whitespace-nowrap text-muted">
                {s.href ? (
                  <Link href={s.href} className="after:absolute after:inset-0">
                    {formatTarih(s.tarih)}
                  </Link>
                ) : (
                  formatTarih(s.tarih)
                )}
              </LedgerCell>
              <LedgerCell>{CARI_HAREKET_ETIKETI[s.tur]}</LedgerCell>
              <LedgerCell className="text-muted">
                {s.aciklama ?? "—"}
              </LedgerCell>
              <LedgerCell numeric>
                {Number(s.etki) === 0 ? (
                  // Çek tahsilatından doğan fatura ödemesi bakiyeyi etkilemez;
                  // sıfır yazmak "0 TL ödendi" gibi okunurdu.
                  <span className="text-muted">—</span>
                ) : (
                  <Amount value={s.etki} signed colored />
                )}
              </LedgerCell>
              <LedgerCell numeric className="text-muted">
                <Amount value={s.yurutulenBakiye} />
              </LedgerCell>
            </LedgerRow>
          ))}
        </LedgerBody>
      </LedgerTable>

      <div className="flex flex-wrap justify-end gap-8 text-body-sm">
        <span className="flex items-baseline gap-3">
          <span className="text-muted">Toplam borçlandırma</span>
          <Amount value={ekstre.toplamAlacak} tone="positive" />
        </span>
        <span className="flex items-baseline gap-3">
          <span className="text-muted">Toplam alacaklandırma</span>
          <Amount value={ekstre.toplamBorc} tone="negative" />
        </span>
        <span className="flex items-baseline gap-3">
          <span className="text-ink">Bakiye</span>
          <Amount value={ekstre.sonBakiye} colored className="text-body-lg" />
        </span>
      </div>
    </div>
  );
}
