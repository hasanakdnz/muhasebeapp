"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileCheck2, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  PROFORMA_DURUM_ETIKETI,
  donusturulebilirMi,
  duzenlenebilirMi,
  silinebilirMi,
  sonrakiDurumlar,
  type ProformaDurumuValue,
} from "@/lib/domain/proforma";
import {
  deleteProforma,
  proformayiFaturala,
  setProformaDurumu,
} from "@/app/(dashboard)/proformalar/actions";

export function ProformaActions({
  id,
  no,
  durum,
  bugun,
  yonetici,
}: {
  id: string;
  no: string;
  durum: ProformaDurumuValue;
  /** Fatura tarihi varsayılanı sunucudan gelir (hydration uyuşmazlığı olmasın). */
  bugun: string;
  yonetici: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"sil" | null>(null);
  const [faturaAcik, setFaturaAcik] = React.useState(false);
  const [faturaTarihi, setFaturaTarihi] = React.useState(bugun);
  const [vadeTarihi, setVadeTarihi] = React.useState("");
  const [hata, setHata] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const secenekler = sonrakiDurumlar(durum);

  function durumDegistir(yeni: string) {
    if (!yeni) return;
    setHata(null);
    startTransition(async () => {
      const sonuc = await setProformaDurumu(id, yeni as ProformaDurumuValue);
      if (sonuc.ok === false) setHata(sonuc.error);
      router.refresh();
    });
  }

  function faturala() {
    setHata(null);
    startTransition(async () => {
      // Başarılıysa action oluşan faturaya yönlendirir; buraya hata dönerse gelinir.
      const sonuc = await proformayiFaturala(id, faturaTarihi, vadeTarihi);
      if (sonuc?.ok === false) {
        setHata(sonuc.error);
        setFaturaAcik(false);
      }
    });
  }

  function sil() {
    setHata(null);
    startTransition(async () => {
      const sonuc = await deleteProforma(id);
      if (sonuc?.ok === false) {
        setHata(sonuc.error);
        setDialog(null);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {secenekler.length > 0 && (
          <Select
            aria-label="Teklif durumunu değiştir"
            value=""
            disabled={pending}
            onChange={(e) => durumDegistir(e.target.value)}
            className="w-auto"
          >
            <option value="">Durum değiştir…</option>
            {secenekler.map((d) => (
              <option key={d} value={d}>
                {PROFORMA_DURUM_ETIKETI[d]}
              </option>
            ))}
          </Select>
        )}

        {donusturulebilirMi(durum) && (
          <Button onClick={() => setFaturaAcik(true)} disabled={pending}>
            <FileCheck2 />
            Faturaya dönüştür
          </Button>
        )}

        {duzenlenebilirMi(durum) && (
          <Link
            href={`/proformalar/${id}/duzenle`}
            className={buttonVariants({ variant: "secondary" })}
          >
            Düzenle
          </Link>
        )}

        {yonetici && silinebilirMi(durum) && (
          <Button
            variant="text"
            onClick={() => setDialog("sil")}
            disabled={pending}
          >
            <Trash2 />
            Sil
          </Button>
        )}
      </div>

      {hata && (
        <p role="alert" className="max-w-md text-right text-body-sm text-red">
          {hata}
        </p>
      )}

      {/* Faturalama tarihi teklif tarihinden farklı olabilir; muhasebeye
          giren tarih burada seçilir, varsayılan bugündür. */}
      {faturaAcik && (
        <div className="w-full max-w-md rounded-app bg-surface p-6 text-left">
          <h3 className="text-heading-md text-ink">Faturaya dönüştür</h3>
          <p className="mt-2 text-body-md text-muted">
            {no} numaralı teklif bir satış işlemine dönüşecek ve cari bakiyesi
            bu anda güncellenecek. Teklif bundan sonra düzenlenemez.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field id="faturaTarihi" label="Fatura tarihi">
              <Input
                id="faturaTarihi"
                type="date"
                value={faturaTarihi}
                onChange={(e) => setFaturaTarihi(e.target.value)}
              />
            </Field>
            <Field id="vadeTarihi" label="Vade tarihi" hint="Boş bırakılabilir.">
              <Input
                id="vadeTarihi"
                type="date"
                value={vadeTarihi}
                onChange={(e) => setVadeTarihi(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setFaturaAcik(false)}
              disabled={pending}
            >
              Vazgeç
            </Button>
            <Button onClick={faturala} disabled={pending}>
              {pending ? "Oluşturuluyor…" : "Faturayı oluştur"}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={dialog === "sil"}
        title="Teklif silinsin mi?"
        description={`${no} numaralı teklif kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        confirmLabel="Sil"
        pending={pending}
        onConfirm={sil}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
