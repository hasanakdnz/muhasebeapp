"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  LedgerBody,
  LedgerCell,
  LedgerHead,
  LedgerHeadCell,
  LedgerRow,
  LedgerTable,
} from "@/components/ui/ledger-table";
import { formatTarih } from "@/lib/date";
import { formatTRY } from "@/lib/money";
import {
  ODEME_KAYNAKLARI,
  ODEME_KAYNAK_ETIKETI,
  type OdemeKaynagiValue,
} from "@/lib/domain/odeme";
import type { KullanilabilirCek, OdemeSatiri } from "@/lib/odeme";
import { createOdeme, deleteOdeme } from "@/app/(dashboard)/islemler/actions";

/**
 * Fatura ödeme paneli.
 *
 * Ödemenin KAYNAĞI kritiktir:
 *  - "Nakit / Banka" cari bakiyesini düşürür.
 *  - "Çek / Senet" bakiyeyi ETKİLEMEZ; borç çek ALINDIĞINDA zaten
 *    kapanmıştı. Buradaki kayıt "bu çek hangi faturayı kapattı"
 *    bilgisidir. Bu ayrım kullanıcıya da açıkça yazılır.
 */
export type HesapSecenegi = { id: string; ad: string };

export function OdemePaneli({
  islemId,
  cariId,
  kalanTutar,
  status,
  odemeler,
  cekler,
  hesaplar,
  bugun,
  yonetici,
}: {
  islemId: string;
  cariId: string;
  kalanTutar: string;
  status: string;
  odemeler: OdemeSatiri[];
  cekler: KullanilabilirCek[];
  hesaplar: HesapSecenegi[];
  bugun: string;
  yonetici: boolean;
}) {
  const router = useRouter();
  const [tutar, setTutar] = React.useState("");
  const [tarih, setTarih] = React.useState(bugun);
  const [kaynak, setKaynak] = React.useState<OdemeKaynagiValue>("DIREKT");
  const [cekId, setCekId] = React.useState("");
  const [hesapId, setHesapId] = React.useState("");
  const [aciklama, setAciklama] = React.useState("");
  const [hata, setHata] = React.useState<string | null>(null);
  const [silinecek, setSilinecek] = React.useState<OdemeSatiri | null>(null);
  const [pending, startTransition] = React.useTransition();

  const kapali = status === "ODENDI" || status === "IPTAL";

  function ekle() {
    setHata(null);
    startTransition(async () => {
      const sonuc = await createOdeme(islemId, cariId, {
        tutar,
        tarih,
        kaynak,
        cekSenetId: kaynak === "CEK" ? cekId || undefined : undefined,
        // Çeke bağlanan ödemede para kasaya çek TAHSİL EDİLİRKEN girer;
        // hesap burada da gönderilseydi ikinci kez girer, kasa şişerdi.
        hesapId: kaynak === "DIREKT" ? hesapId || undefined : undefined,
        aciklama: aciklama || undefined,
      });
      if (sonuc.ok === false) {
        setHata(sonuc.error);
        return;
      }
      setTutar("");
      setAciklama("");
      setCekId("");
      setHesapId("");
      router.refresh();
    });
  }

  function sil() {
    if (!silinecek) return;
    setHata(null);
    startTransition(async () => {
      const sonuc = await deleteOdeme(silinecek.id, islemId, cariId);
      if (sonuc.ok === false) setHata(sonuc.error);
      setSilinecek(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {kapali ? (
        <p className="text-body-md text-muted">
          {status === "ODENDI"
            ? "Bu işlem tamamen ödenmiş."
            : "İptal edilmiş işleme ödeme kaydedilemez."}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              id="odemeTutar"
              label="Tutar"
              hint={`Kalan: ${formatTRY(kalanTutar)}`}
            >
              <Input
                id="odemeTutar"
                inputMode="decimal"
                placeholder="0,00"
                value={tutar}
                onChange={(e) => setTutar(e.target.value)}
              />
            </Field>

            <Field id="odemeTarih" label="Tarih">
              <Input
                id="odemeTarih"
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
              />
            </Field>

            <Field id="odemeKaynak" label="Kaynak">
              <Select
                id="odemeKaynak"
                value={kaynak}
                onChange={(e) =>
                  setKaynak(e.target.value as OdemeKaynagiValue)
                }
              >
                {ODEME_KAYNAKLARI.map((k) => (
                  <option key={k} value={k}>
                    {ODEME_KAYNAK_ETIKETI[k]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field id="odemeAciklama" label="Açıklama">
              <Input
                id="odemeAciklama"
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
              />
            </Field>
          </div>

          {kaynak === "DIREKT" && (
            <Field
              id="odemeHesap"
              label="Hangi hesaba"
              hint={
                hesaplar.length === 0
                  ? "Kasa/banka hesabı tanımlı değil."
                  : "Boş bırakılırsa kasa hareketi oluşmaz."
              }
            >
              <Select
                id="odemeHesap"
                value={hesapId}
                disabled={hesaplar.length === 0}
                onChange={(e) => setHesapId(e.target.value)}
              >
                <option value="">Kasaya işleme</option>
                {hesaplar.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.ad}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {kaynak === "CEK" && (
            <div className="flex flex-col gap-2">
              <Field
                id="odemeCek"
                label="Hangi çek/senet"
                hint="Bu carinin faturalara henüz sayılmamış çek/senetleri."
              >
                <Select
                  id="odemeCek"
                  value={cekId}
                  onChange={(e) => setCekId(e.target.value)}
                >
                  <option value="">Seçin…</option>
                  {cekler.map((c) => (
                    <option key={c.cekSenetId} value={c.cekSenetId}>
                      vade {formatTarih(c.vadeTarihi)} ·{" "}
                      {c.aciklama ?? "Çek/senet"} · dağıtılabilir{" "}
                      {formatTRY(c.dagitilabilir)}
                    </option>
                  ))}
                </Select>
              </Field>
              {cekler.length === 0 && (
                <p className="text-body-sm text-muted">
                  Bu carinin dağıtılabilir çek/senedi yok.{" "}
                  <Link href="/cek-senet" className="underline underline-offset-2">
                    Çek/senet ekranından
                  </Link>{" "}
                  kayıt ekleyebilirsiniz.
                </p>
              )}
              <p className="text-body-sm text-muted">
                Çek alındığında cari bakiyesi zaten kapanmıştı; bu kayıt yalnızca
                çekin hangi faturayı kapattığını belirler, bakiyeyi tekrar
                değiştirmez.
              </p>
            </div>
          )}

          <div>
            <Button
              onClick={ekle}
              disabled={
                pending ||
                !tutar ||
                (kaynak === "CEK" && !cekId)
              }
            >
              <Plus />
              {pending ? "Kaydediliyor…" : "Ödeme ekle"}
            </Button>
          </div>
        </div>
      )}

      {hata && (
        <p role="alert" className="text-body-sm text-red">
          {hata}
        </p>
      )}

      {odemeler.length > 0 && (
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Tarih</LedgerHeadCell>
              <LedgerHeadCell>Kaynak</LedgerHeadCell>
              <LedgerHeadCell>Açıklama</LedgerHeadCell>
              <LedgerHeadCell numeric>Tutar</LedgerHeadCell>
              <LedgerHeadCell numeric>
                <span className="sr-only">İşlemler</span>
              </LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {odemeler.map((odeme) => (
              <LedgerRow key={odeme.id}>
                <LedgerCell className="whitespace-nowrap text-muted">
                  {formatTarih(odeme.tarih)}
                </LedgerCell>
                <LedgerCell className="text-muted">
                  {odeme.kaynak === "CEK" && odeme.cekSenetId ? (
                    <Link
                      href={`/cek-senet/${odeme.cekSenetId}`}
                      className="underline underline-offset-2"
                    >
                      {ODEME_KAYNAK_ETIKETI[odeme.kaynak]}
                    </Link>
                  ) : (
                    ODEME_KAYNAK_ETIKETI[odeme.kaynak]
                  )}
                </LedgerCell>
                <LedgerCell>{odeme.aciklama ?? "—"}</LedgerCell>
                <LedgerCell numeric>
                  <Amount value={odeme.tutar} tone="positive" />
                </LedgerCell>
                <LedgerCell numeric>
                  <Button
                    variant="text"
                    className="h-8 px-2"
                    onClick={() => setSilinecek(odeme)}
                    disabled={pending || !yonetici}
                    aria-label="Ödemeyi sil"
                    title={
                      yonetici
                        ? undefined
                        : "Ödeme kaydını yalnızca yönetici silebilir."
                    }
                  >
                    <Trash2 />
                  </Button>
                </LedgerCell>
              </LedgerRow>
            ))}
          </LedgerBody>
        </LedgerTable>
      )}

      <ConfirmDialog
        open={silinecek !== null}
        title="Ödeme silinsin mi?"
        description={
          silinecek?.kaynak === "CEK"
            ? "Eşleştirme kaldırılacak; çek kaydı ve cari bakiyesi değişmez, fatura yeniden açık görünür."
            : "Ödeme silinecek ve cari bakiyesi buna göre geri alınacak."
        }
        confirmLabel="Sil"
        pending={pending}
        onConfirm={sil}
        onCancel={() => setSilinecek(null)}
      />
    </div>
  );
}
