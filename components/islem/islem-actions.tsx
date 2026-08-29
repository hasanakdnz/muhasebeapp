"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteIslem } from "@/app/(dashboard)/islemler/actions";

export function IslemActions({
  id,
  cariId,
  cariUnvan,
  toplamTutar,
}: {
  id: string;
  cariId: string;
  cariUnvan: string;
  toplamTutar: string;
}) {
  const [acik, setAcik] = React.useState(false);
  const [hata, setHata] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function sil() {
    setHata(null);
    startTransition(async () => {
      // Başarılıysa action redirect eder; buraya yalnızca hata dönerse gelinir.
      const sonuc = await deleteIslem(id, cariId);
      if (sonuc?.ok === false) {
        setHata(sonuc.error);
        setAcik(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button variant="text" onClick={() => setAcik(true)} disabled={pending}>
        <Trash2 />
        Sil
      </Button>

      {hata && (
        <p role="alert" className="text-body-sm text-red">
          {hata}
        </p>
      )}

      <ConfirmDialog
        open={acik}
        title="İşlem silinsin mi?"
        description={`İşlem kalıcı olarak silinecek ve "${cariUnvan}" carisinin bakiyesi ${toplamTutar} kadar düzeltilecek.`}
        confirmLabel="Sil"
        pending={pending}
        onConfirm={sil}
        onCancel={() => setAcik(false)}
      />
    </div>
  );
}
