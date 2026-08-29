"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteGider, removeBelge } from "@/app/(dashboard)/giderler/actions";

export function GiderActions({
  id,
  belgeVarMi,
}: {
  id: string;
  belgeVarMi: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"sil" | "belge" | null>(null);
  const [hata, setHata] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function sil() {
    setHata(null);
    startTransition(async () => {
      // Başarılıysa action redirect eder; buraya yalnızca hata dönerse gelinir.
      const sonuc = await deleteGider(id);
      if (sonuc?.ok === false) {
        setHata(sonuc.error);
        setDialog(null);
      }
    });
  }

  function belgeyiKaldir() {
    setHata(null);
    startTransition(async () => {
      const sonuc = await removeBelge(id);
      if (sonuc.ok === false) setHata(sonuc.error);
      setDialog(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {belgeVarMi && (
          <Button
            variant="secondary"
            onClick={() => setDialog("belge")}
            disabled={pending}
          >
            <X />
            Belgeyi kaldır
          </Button>
        )}
        <Button variant="text" onClick={() => setDialog("sil")} disabled={pending}>
          <Trash2 />
          Sil
        </Button>
      </div>

      {hata && (
        <p role="alert" className="text-body-sm text-red">
          {hata}
        </p>
      )}

      <ConfirmDialog
        open={dialog === "sil"}
        title="Gider silinsin mi?"
        description={
          belgeVarMi
            ? "Gider kaydı ve yüklenen belgesi kalıcı olarak silinecek."
            : "Gider kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz."
        }
        confirmLabel="Sil"
        pending={pending}
        onConfirm={sil}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === "belge"}
        title="Belge kaldırılsın mı?"
        description="Yüklenen fiş/dekont silinecek; gider kaydı olduğu gibi kalacak."
        confirmLabel="Kaldır"
        pending={pending}
        onConfirm={belgeyiKaldir}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
