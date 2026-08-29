"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import type { CekSenetDetay, TahsilatSatiri } from "@/lib/cek-senet";
import {
  tahsilatSchema,
  type TahsilatInput,
  type TahsilatOutput,
} from "@/lib/validations/cek-senet";
import {
  createTahsilat,
  deleteTahsilat,
} from "@/app/(dashboard)/cek-senet/actions";

/**
 * Kısmi tahsilat paneli.
 *
 * Kalandan fazla tahsilat sunucuda engellenir (alan katmanındaki
 * `tahsilatKontrol`); burada ayrıca kalan tutar gösterilir ve kayıt kapalıysa
 * form hiç açılmaz — kullanıcı reddedilecek bir işlemle uğraşmasın.
 */
export function TahsilatPaneli({
  cekSenet,
  bugun,
}: {
  cekSenet: CekSenetDetay;
  bugun: string;
}) {
  const router = useRouter();
  const [silinecek, setSilinecek] = React.useState<TahsilatSatiri | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const kapali =
    cekSenet.durum === "KARSILIKSIZ" ||
    cekSenet.durum === "CIRO_EDILDI" ||
    cekSenet.durum === "TAHSIL_EDILDI";

  const defaultValues: TahsilatInput = {
    tutar: "",
    tarih: bugun,
    aciklama: "",
  };

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors },
  } = useForm<TahsilatInput, unknown, TahsilatOutput>({
    resolver: zodResolver(tahsilatSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(() => {
    setServerError(null);
    startTransition(async () => {
      const sonuc = await createTahsilat(
        cekSenet.id,
        cekSenet.cariId,
        getValues()
      );
      if (sonuc.ok === false) {
        setServerError(sonuc.error);
        for (const [alan, mesajlar] of Object.entries(sonuc.fieldErrors ?? {})) {
          if (mesajlar?.[0]) {
            setError(alan as keyof TahsilatInput, { message: mesajlar[0] });
          }
        }
        return;
      }
      reset(defaultValues);
      router.refresh();
    });
  });

  function sil() {
    if (!silinecek) return;
    setServerError(null);
    startTransition(async () => {
      const sonuc = await deleteTahsilat(
        silinecek.id,
        cekSenet.id,
        cekSenet.cariId
      );
      if (sonuc.ok === false) setServerError(sonuc.error);
      setSilinecek(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {kapali ? (
        <p className="text-body-md text-muted">
          Bu kayda yeni tahsilat eklenemez.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <Field
              id="tutar"
              label="Tahsilat tutarı"
              error={errors.tutar?.message}
              hint={`Kalan: ${formatTRY(cekSenet.kalan)}`}
            >
              <Input
                id="tutar"
                inputMode="decimal"
                placeholder="0,00"
                aria-invalid={Boolean(errors.tutar)}
                {...register("tutar")}
              />
            </Field>

            <Field id="tarih" label="Tarih" error={errors.tarih?.message}>
              <Input id="tarih" type="date" {...register("tarih")} />
            </Field>

            <Field
              id="tahsilatAciklama"
              label="Açıklama"
              error={errors.aciklama?.message}
            >
              <Input id="tahsilatAciklama" {...register("aciklama")} />
            </Field>
          </div>

          <div>
            <Button type="submit" disabled={pending}>
              <Plus />
              {pending ? "Kaydediliyor…" : "Tahsilat ekle"}
            </Button>
          </div>
        </form>
      )}

      {serverError && (
        <p role="alert" className="text-body-sm text-red">
          {serverError}
        </p>
      )}

      {cekSenet.tahsilatlar.length > 0 && (
        <LedgerTable>
          <LedgerHead>
            <tr>
              <LedgerHeadCell>Tarih</LedgerHeadCell>
              <LedgerHeadCell>Açıklama</LedgerHeadCell>
              <LedgerHeadCell numeric>Tutar</LedgerHeadCell>
              <LedgerHeadCell numeric>
                <span className="sr-only">İşlemler</span>
              </LedgerHeadCell>
            </tr>
          </LedgerHead>
          <LedgerBody>
            {cekSenet.tahsilatlar.map((tahsilat) => (
              <LedgerRow key={tahsilat.id}>
                <LedgerCell className="whitespace-nowrap text-muted">
                  {formatTarih(tahsilat.tarih)}
                </LedgerCell>
                <LedgerCell>{tahsilat.aciklama ?? "—"}</LedgerCell>
                <LedgerCell numeric>
                  <Amount value={tahsilat.tutar} tone="positive" />
                </LedgerCell>
                <LedgerCell numeric>
                  <Button
                    variant="text"
                    className="h-8 px-2"
                    onClick={() => setSilinecek(tahsilat)}
                    disabled={pending}
                    aria-label="Tahsilatı sil"
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
        title="Tahsilat silinsin mi?"
        description={`${silinecek ? formatTRY(silinecek.tutar) : ""} tutarındaki tahsilat silinecek; çek/senet durumu ve cari bakiyesi buna göre geri alınacak.`}
        confirmLabel="Sil"
        pending={pending}
        onConfirm={sil}
        onCancel={() => setSilinecek(null)}
      />
    </div>
  );
}
