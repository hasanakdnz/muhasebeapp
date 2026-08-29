"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteCari, setCariAktif } from "@/app/(dashboard)/cariler/actions";

export function CariActions({
  id,
  unvan,
  aktif,
  silinebilir,
  yonetici,
}: {
  id: string;
  unvan: string;
  aktif: boolean;
  silinebilir: boolean;
  /** Silme yalnızca yöneticide (RBAC); personelde düğme hiç görünmez. */
  yonetici: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"sil" | "pasif" | null>(null);
  const [hata, setHata] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function pasifDurumunuDegistir() {
    setHata(null);
    startTransition(async () => {
      const sonuc = await setCariAktif(id, !aktif);
      if (sonuc.ok === false) setHata(sonuc.error);
      setDialog(null);
      router.refresh();
    });
  }

  function sil() {
    setHata(null);
    startTransition(async () => {
      // Başarılıysa action redirect eder; buraya yalnızca hata dönerse gelinir.
      const sonuc = await deleteCari(id);
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
          onClick={() => (aktif ? setDialog("pasif") : pasifDurumunuDegistir())}
          disabled={pending}
        >
          {aktif ? <Archive /> : <ArchiveRestore />}
          {aktif ? "Pasife al" : "Aktife al"}
        </Button>

        {yonetici && (
          <Button
            variant="text"
            onClick={() => setDialog("sil")}
            disabled={pending || !silinebilir}
            title={
              silinebilir
                ? undefined
                : "Muhasebe kaydı olan cari silinemez; pasife alabilirsiniz."
            }
          >
            <Trash2 />
            Sil
          </Button>
        )}
      </div>

      {hata && (
        <p role="alert" className="max-w-sm text-right text-body-sm text-red">
          {hata}
        </p>
      )}

      <ConfirmDialog
        open={dialog === "sil"}
        title="Cari silinsin mi?"
        description={`"${unvan}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        confirmLabel="Sil"
        pending={pending}
        onConfirm={sil}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === "pasif"}
        title="Cari pasife alınsın mı?"
        description={`"${unvan}" listelerde görünmeyecek, ancak geçmiş kayıtları korunacak. İstediğiniz zaman geri alabilirsiniz.`}
        confirmLabel="Pasife al"
        pending={pending}
        onConfirm={pasifDurumunuDegistir}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
