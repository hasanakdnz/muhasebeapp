"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteHesap,
  setHesapDurumu,
} from "@/app/(dashboard)/kasa-banka/actions";

export function HesapActions({
  id,
  ad,
  aktif,
  silinebilir,
}: {
  id: string;
  ad: string;
  aktif: boolean;
  silinebilir: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"sil" | "pasif" | null>(null);
  const [hata, setHata] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function durumuDegistir() {
    setHata(null);
    startTransition(async () => {
      const sonuc = await setHesapDurumu(id, !aktif);
      if (sonuc.ok === false) setHata(sonuc.error);
      setDialog(null);
      router.refresh();
    });
  }

  function sil() {
    setHata(null);
    startTransition(async () => {
      // Başarılıysa action redirect eder; buraya yalnızca hata dönerse gelinir.
      const sonuc = await deleteHesap(id);
      if (sonuc?.ok === false) {
        setHata(sonuc.error);
        setDialog(null);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => (aktif ? setDialog("pasif") : durumuDegistir())}
          disabled={pending}
        >
          {aktif ? <Archive /> : <ArchiveRestore />}
          {aktif ? "Pasife al" : "Aktife al"}
        </Button>

        <Button
          variant="text"
          onClick={() => setDialog("sil")}
          disabled={pending || !silinebilir}
          title={
            silinebilir
              ? undefined
              : "Hareketi olan hesap silinemez; pasife alabilirsiniz."
          }
        >
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
        open={dialog === "sil"}
        title="Hesap silinsin mi?"
        description={`"${ad}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        confirmLabel="Sil"
        pending={pending}
        onConfirm={sil}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === "pasif"}
        title="Hesap pasife alınsın mı?"
        description={`"${ad}" listelerde görünmeyecek, ancak hareketleri korunacak. İstediğiniz zaman geri alabilirsiniz.`}
        confirmLabel="Pasife al"
        pending={pending}
        onConfirm={durumuDegistir}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
