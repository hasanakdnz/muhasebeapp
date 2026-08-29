import Link from "next/link";
import { Amount } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import {
  LedgerBody,
  LedgerCell,
  LedgerHead,
  LedgerHeadCell,
  LedgerRow,
  LedgerTable,
} from "@/components/ui/ledger-table";
import type { CariSatiri } from "@/lib/cari";
import { CARI_TIP_ETIKETI } from "@/lib/validations/cari";

export function CariListesi({
  cariler,
  yeniId,
}: {
  cariler: CariSatiri[];
  /** Az önce eklenen satır kısa bir vurguyla belirir (DESIGN.md). */
  yeniId?: string;
}) {
  return (
    <LedgerTable>
      <LedgerHead>
        <tr>
          <LedgerHeadCell>Ünvan</LedgerHeadCell>
          <LedgerHeadCell>Tip</LedgerHeadCell>
          <LedgerHeadCell>VKN / TCKN</LedgerHeadCell>
          <LedgerHeadCell>İletişim</LedgerHeadCell>
          <LedgerHeadCell numeric>Bakiye</LedgerHeadCell>
        </tr>
      </LedgerHead>
      <LedgerBody>
        {cariler.map((cari) => (
          <LedgerRow key={cari.id} highlight={cari.id === yeniId}>
            <LedgerCell>
              <span className="flex items-center gap-2">
                {/* Satırın tamamı tıklanabilir olsun diye link satırı kaplar. */}
                <Link
                  href={`/cariler/${cari.id}`}
                  className="after:absolute after:inset-0"
                >
                  {cari.unvan}
                </Link>
                {!cari.aktif && <Badge variant="neutral">pasif</Badge>}
              </span>
            </LedgerCell>
            <LedgerCell className="text-muted">
              {CARI_TIP_ETIKETI[cari.tip]}
            </LedgerCell>
            <LedgerCell className="text-muted">
              {cari.vknTckn ? (
                <span data-numeric="">{cari.vknTckn}</span>
              ) : (
                "—"
              )}
            </LedgerCell>
            <LedgerCell className="text-muted">
              {cari.telefon ?? cari.email ?? "—"}
            </LedgerCell>
            <LedgerCell numeric>
              <Amount value={cari.bakiye} colored />
            </LedgerCell>
          </LedgerRow>
        ))}
      </LedgerBody>
    </LedgerTable>
  );
}
