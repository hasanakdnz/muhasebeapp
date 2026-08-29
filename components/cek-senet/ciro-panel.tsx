"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightLeft, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatTarih } from "@/lib/date";
import { formatTRY } from "@/lib/money";
import type { CekSenetDetay } from "@/lib/cek-senet";
import {
  ciroEtAction,
  ciroGeriAlAction,
} from "@/app/(dashboard)/cek-senet/actions";

/**
 * Ciro paneli.
 *
 * Ciro, çeki bir tedarikçiye devretmektir ve İKİ cari bakiyesini birden
 * etkiler: çeki veren müşterinin borcu kapanır, çeki devrettiğimiz
 * tedarikçiye olan borcumuz azalır. Bu yüzden hedef cari zorunludur —
 * bilinmeden etki hesaplanamaz.
 */
export function CiroPaneli({
  cekSenet,
  cariler,
  bugun,
}: {
  cekSenet: CekSenetDetay;
  cariler: Array<{ id: string; unvan: string }>;
  bugun: string;
}) {
  const router = useRouter();
  const [hedef, setHedef] = React.useState("");
  const [tarih, setTarih] = React.useState(bugun);
  const [hata, setHata] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const ciroEdilebilir =
    cekSenet.yon === "ALINAN" &&
    cekSenet.durum === "PORTFOYDE" &&
    Number(cekSenet.tahsilEdilen) === 0;

  function ciroEt() {
    setHata(null);
    startTransition(async () => {
      const sonuc = await ciroEtAction(
        cekSenet.id,
        cekSenet.cariId,
        hedef,
        tarih
      );
      if (sonuc.ok === false) setHata(sonuc.error);
      else router.refresh();
    });
  }

  function geriAl() {
    setHata(null);
    startTransition(async () => {
      const sonuc = await ciroGeriAlAction(
        cekSenet.id,
        cekSenet.cariId,
        cekSenet.ciroEdilenCariId ?? ""
      );
      if (sonuc.ok === false) setHata(sonuc.error);
      else router.refresh();
    });
  }

  if (cekSenet.durum === "CIRO_EDILDI") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body-md text-ink">
          Bu çek{" "}
          {cekSenet.ciroTarihi && (
            <span className="text-muted">
              {formatTarih(cekSenet.ciroTarihi)} tarihinde{" "}
            </span>
          )}
          <Link
            href={`/cariler/${cekSenet.ciroEdilenCariId}`}
            className="underline underline-offset-2"
          >
            {cekSenet.ciroEdilenCariUnvan}
          </Link>{" "}
          carisine ciro edildi.
        </p>
        <p className="text-body-sm text-muted">
          {formatTRY(cekSenet.tutar)} tutarında; {cekSenet.cariUnvan}{" "}
          carisinin borcu kapandı, ciro edilen cariye olan borcunuz aynı tutarda
          azaldı.
        </p>

        {hata && (
          <p role="alert" className="text-body-sm text-red">
            {hata}
          </p>
        )}

        <div>
          <Button variant="secondary" onClick={geriAl} disabled={pending}>
            <Undo2 />
            {pending ? "Geri alınıyor…" : "Ciroyu geri al"}
          </Button>
        </div>
      </div>
    );
  }

  if (!ciroEdilebilir) {
    return (
      <p className="text-body-md text-muted">
        {cekSenet.yon !== "ALINAN"
          ? "Yalnızca alınan çek/senet ciro edilebilir."
          : Number(cekSenet.tahsilEdilen) > 0
            ? "Kısmen tahsil edilmiş çek/senet ciro edilemez."
            : "Yalnızca portföydeki çek/senet ciro edilebilir."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-sm text-muted">
        Çeki bir tedarikçinize devredin. {cekSenet.cariUnvan} carisinin borcu
        kapanacak, seçtiğiniz cariye olan borcunuz {formatTRY(cekSenet.tutar)}{" "}
        azalacak.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="ciroHedef" label="Ciro edilecek cari">
          <Select
            id="ciroHedef"
            value={hedef}
            onChange={(e) => setHedef(e.target.value)}
          >
            <option value="">Seçin…</option>
            {cariler
              .filter((c) => c.id !== cekSenet.cariId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.unvan}
                </option>
              ))}
          </Select>
        </Field>

        <Field id="ciroTarihi" label="Ciro tarihi">
          <Input
            id="ciroTarihi"
            type="date"
            value={tarih}
            onChange={(e) => setTarih(e.target.value)}
          />
        </Field>
      </div>

      {hata && (
        <p role="alert" className="text-body-sm text-red">
          {hata}
        </p>
      )}

      <div>
        <Button onClick={ciroEt} disabled={pending || !hedef}>
          <ArrowRightLeft />
          {pending ? "Ciro ediliyor…" : "Ciro et"}
        </Button>
      </div>
    </div>
  );
}
