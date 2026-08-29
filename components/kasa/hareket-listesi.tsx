"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  LedgerBody,
  LedgerCell,
  LedgerHead,
  LedgerHeadCell,
  LedgerRow,
  LedgerTable,
} from "@/components/ui/ledger-table";
import { HAREKET_YON_ETIKETI } from "@/lib/domain/kasa";
import { formatTarih } from "@/lib/date";
import type { HareketSatiri } from "@/lib/kasa";
import { deleteHareket } from "@/app/(dashboard)/kasa-banka/actions";

/**
 * Hesap ekstresi. DESIGN.md Ledger Tables:
 * tutar sütunu sağa yaslı ve `data-numeric`, giriş `+` ile yeşil, çıkış `-` ile
 * kırmızı; başka hiçbir sütunda renk kullanılmaz.
 */
export function HareketListesi({
  hesapId,
  hareketler,
  yonetici,
}: {
  hesapId: string;
  hareketler: HareketSatiri[];
  yonetici: boolean;
}) {
  const router = useRouter();
  const [silinecek, setSilinecek] = React.useState<HareketSatiri | null>(null);
  const [hata, setHata] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function sil() {
    if (!silinecek) return;
    setHata(null);
    startTransition(async () => {
      const sonuc = await deleteHareket(silinecek.id, hesapId);
      if (sonuc.ok === false) setHata(sonuc.error);
      setSilinecek(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <LedgerTable>
        <LedgerHead>
          <tr>
            <LedgerHeadCell>Tarih</LedgerHeadCell>
            <LedgerHeadCell>Açıklama</LedgerHeadCell>
            <LedgerHeadCell>Yön</LedgerHeadCell>
            <LedgerHeadCell numeric>Tutar</LedgerHeadCell>
            <LedgerHeadCell numeric>Bakiye</LedgerHeadCell>
            <LedgerHeadCell numeric>
              <span className="sr-only">İşlemler</span>
            </LedgerHeadCell>
          </tr>
        </LedgerHead>
        <LedgerBody>
          {hareketler.map((hareket) => (
            <LedgerRow key={hareket.id}>
              <LedgerCell className="whitespace-nowrap text-muted">
                {formatTarih(hareket.tarih)}
              </LedgerCell>
              <LedgerCell>{hareket.aciklama ?? "—"}</LedgerCell>
              <LedgerCell className="text-muted">
                {HAREKET_YON_ETIKETI[hareket.yon]}
              </LedgerCell>
              <LedgerCell numeric>
                <Amount value={hareket.tutar} colored signed />
              </LedgerCell>
              <LedgerCell numeric className="text-muted">
                <Amount value={hareket.yurutulenBakiye} />
              </LedgerCell>
              <LedgerCell numeric>
                <Button
                  variant="text"
                  className="h-8 px-2"
                  onClick={() => setSilinecek(hareket)}
                  disabled={pending || !yonetici}
                  aria-label="Hareketi sil"
                  title={
                    yonetici
                      ? undefined
                      : "Hareket kaydını yalnızca yönetici silebilir."
                  }
                >
                  <Trash2 />
                </Button>
              </LedgerCell>
            </LedgerRow>
          ))}
        </LedgerBody>
      </LedgerTable>

      {hata && (
        <p role="alert" className="text-body-sm text-red">
          {hata}
        </p>
      )}

      <ConfirmDialog
        open={silinecek !== null}
        title="Hareket silinsin mi?"
        description="Hareket kalıcı olarak silinecek ve hesap bakiyesi buna göre güncellenecek."
        confirmLabel="Sil"
        pending={pending}
        onConfirm={sil}
        onCancel={() => setSilinecek(null)}
      />
    </div>
  );
}
