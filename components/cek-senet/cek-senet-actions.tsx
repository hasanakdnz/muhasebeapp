"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  CEK_SENET_DURUM_ETIKETI,
  type CekSenetDurumuValue,
} from "@/lib/domain/cek-senet";
import { ELLE_SECILEBILIR_DURUMLAR } from "@/lib/validations/cek-senet";
import { deleteCekSenet, setDurum } from "@/app/(dashboard)/cek-senet/actions";

export function CekSenetActions({
  id,
  cariId,
  durum,
  tahsilatSayisi,
}: {
  id: string;
  cariId: string;
  durum: CekSenetDurumuValue;
  tahsilatSayisi: number;
}) {
  const router = useRouter();
  const [acik, setAcik] = React.useState(false);
  const [hata, setHata] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function durumDegistir(yeni: CekSenetDurumuValue) {
    setHata(null);
    startTransition(async () => {
      const sonuc = await setDurum(id, cariId, yeni);
      if (sonuc.ok === false) setHata(sonuc.error);
      router.refresh();
    });
  }

  function sil() {
    setHata(null);
    startTransition(async () => {
      // Başarılıysa action redirect eder; buraya yalnızca hata dönerse gelinir.
      const sonuc = await deleteCekSenet(id, cariId);
      if (sonuc?.ok === false) {
        setHata(sonuc.error);
        setAcik(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="durum">Durum</Label>
          <Select
            id="durum"
            className="w-44"
            value={durum}
            disabled={pending}
            onChange={(e) =>
              durumDegistir(e.target.value as CekSenetDurumuValue)
            }
          >
            {/* TAHSIL_EDILDI listede yok: tahsilat kayıtlarından doğar. */}
            {ELLE_SECILEBILIR_DURUMLAR.map((d) => (
              <option key={d} value={d}>
                {CEK_SENET_DURUM_ETIKETI[d]}
              </option>
            ))}
            {durum === "TAHSIL_EDILDI" && (
              <option value="TAHSIL_EDILDI">
                {CEK_SENET_DURUM_ETIKETI.TAHSIL_EDILDI}
              </option>
            )}
          </Select>
        </div>

        <Button variant="text" onClick={() => setAcik(true)} disabled={pending}>
          <Trash2 />
          Sil
        </Button>
      </div>

      {hata && (
        <p role="alert" className="max-w-sm text-right text-body-sm text-red">
          {hata}
        </p>
      )}

      <ConfirmDialog
        open={acik}
        title="Çek/senet silinsin mi?"
        description={
          tahsilatSayisi > 0
            ? `Kayıt ve ${tahsilatSayisi} tahsilatı kalıcı olarak silinecek; cari bakiyesi tahsilatlar hiç yapılmamış gibi geri alınacak.`
            : "Kayıt kalıcı olarak silinecek. Bu işlem geri alınamaz."
        }
        confirmLabel="Sil"
        pending={pending}
        onConfirm={sil}
        onCancel={() => setAcik(false)}
      />
    </div>
  );
}
