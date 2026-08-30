"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Amount } from "@/components/ui/amount";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ISLEM_TIPLERI,
  ISLEM_TIP_ETIKETI,
  KDV_ORANLARI,
  hesaplaIslemToplamlari,
  kdvDahilNete,
} from "@/lib/domain/islem";
import { parseAmountInput } from "@/lib/money";
import {
  bosKalem,
  islemSchema,
  type IslemInput,
  type IslemOutput,
} from "@/lib/validations/islem";
import { createIslem, type ActionResult } from "@/app/(dashboard)/islemler/actions";

type CariSecenegi = { id: string; unvan: string };

/** Girilen metni sayıya çevirir; boş/geçersizse 0 — canlı önizleme için. */
function sayi(deger: string | undefined): string {
  const parsed = parseAmountInput(deger ?? "");
  return parsed ? parsed.toString() : "0";
}

export function IslemForm({
  cariler,
  defaultValues,
}: {
  cariler: CariSecenegi[];
  defaultValues: IslemInput;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const {
    register,
    handleSubmit,
    getValues,
    control,
    setError,
    formState: { errors },
  } = useForm<IslemInput, unknown, IslemOutput>({
    resolver: zodResolver(islemSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "kalemler" });

  // Belge no ipucu tipe göre değişir: alışta numara tedarikçinindir.
  const izlenenTip = useWatch({ control, name: "tip" });

  // Canlı toplamlar sunucudakiyle AYNI alan fonksiyonlarıyla hesaplanır —
  // kullanıcının gördüğü tutar ile kaydedilen tutar ayrışamaz.
  const izlenen = useWatch({ control });
  const toplamlar = React.useMemo(() => {
    const kdvDahil = Boolean(izlenen.kdvDahil);
    const kalemler = (izlenen.kalemler ?? []).map((k) => {
      const oran = k?.kdvOrani ?? "0";
      const girilen = sayi(k?.birimFiyat);
      return {
        miktar: sayi(k?.miktar),
        birimFiyat: kdvDahil ? kdvDahilNete(girilen, oran) : girilen,
        kdvOrani: oran,
      };
    });
    return hesaplaIslemToplamlari(kalemler);
  }, [izlenen]);

  const onSubmit = handleSubmit(() => {
    setServerError(null);
    startTransition(async () => {
      const result: ActionResult = await createIslem(getValues());
      if (result?.ok === false) {
        setServerError(result.error);
        for (const [alan, mesajlar] of Object.entries(result.fieldErrors ?? {})) {
          if (mesajlar?.[0]) {
            setError(alan as keyof IslemInput, { message: mesajlar[0] });
          }
        }
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Field id="tip" label="İşlem tipi" error={errors.tip?.message}>
          <Select id="tip" aria-invalid={Boolean(errors.tip)} {...register("tip")}>
            {ISLEM_TIPLERI.map((t) => (
              <option key={t} value={t}>
                {ISLEM_TIP_ETIKETI[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="cariId" label="Cari" error={errors.cariId?.message}>
          <Select
            id="cariId"
            aria-invalid={Boolean(errors.cariId)}
            {...register("cariId")}
          >
            <option value="">Seçin…</option>
            {cariler.map((c) => (
              <option key={c.id} value={c.id}>
                {c.unvan}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="tarih" label="İşlem tarihi" error={errors.tarih?.message}>
          <Input
            id="tarih"
            type="date"
            aria-invalid={Boolean(errors.tarih)}
            {...register("tarih")}
          />
        </Field>

        <Field
          id="vadeTarihi"
          label="Vade tarihi"
          error={errors.vadeTarihi?.message}
          hint="Boş bırakılabilir."
        >
          <Input id="vadeTarihi" type="date" {...register("vadeTarihi")} />
        </Field>

        <Field
          id="belgeNo"
          label="Belge no"
          error={errors.belgeNo?.message}
          hint={
            izlenenTip === "ALIS"
              ? "Tedarikçinin fatura numarası."
              : "E-fatura numaranız; boş bırakılabilir."
          }
        >
          <Input id="belgeNo" {...register("belgeNo")} />
        </Field>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-heading-md text-ink">Kalemler</h2>
          <label className="flex items-center gap-2 text-body-md text-muted">
            <input
              type="checkbox"
              className="size-4 accent-ink"
              aria-label="Fiyatları KDV dahil giriyorum"
              {...register("kdvDahil")}
            />
            Fiyatları KDV dahil giriyorum
          </label>
        </div>

        <div className="flex flex-col gap-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid items-end gap-4 rounded-app bg-surface p-4 sm:grid-cols-[1fr_7rem_9rem_7rem_auto]"
            >
              <Field
                id={`kalem-${index}-urunAdi`}
                label="Ürün / hizmet"
                error={errors.kalemler?.[index]?.urunAdi?.message}
              >
                <Input
                  id={`kalem-${index}-urunAdi`}
                  aria-invalid={Boolean(errors.kalemler?.[index]?.urunAdi)}
                  {...register(`kalemler.${index}.urunAdi`)}
                />
              </Field>

              <Field
                id={`kalem-${index}-miktar`}
                label="Miktar"
                error={errors.kalemler?.[index]?.miktar?.message}
              >
                <Input
                  id={`kalem-${index}-miktar`}
                  inputMode="decimal"
                  aria-invalid={Boolean(errors.kalemler?.[index]?.miktar)}
                  {...register(`kalemler.${index}.miktar`)}
                />
              </Field>

              <Field
                id={`kalem-${index}-birimFiyat`}
                label="Birim fiyat"
                error={errors.kalemler?.[index]?.birimFiyat?.message}
              >
                <Input
                  id={`kalem-${index}-birimFiyat`}
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-invalid={Boolean(errors.kalemler?.[index]?.birimFiyat)}
                  {...register(`kalemler.${index}.birimFiyat`)}
                />
              </Field>

              <Field
                id={`kalem-${index}-kdvOrani`}
                label="KDV"
                error={errors.kalemler?.[index]?.kdvOrani?.message}
              >
                <Select
                  id={`kalem-${index}-kdvOrani`}
                  {...register(`kalemler.${index}.kdvOrani`)}
                >
                  {KDV_ORANLARI.map((o) => (
                    <option key={o} value={o}>
                      %{o}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="flex flex-col gap-2">
                <Label aria-hidden>Tutar</Label>
                <div className="flex h-11 items-center gap-2">
                  <Amount
                    value={toplamlar.kalemler[index]?.brut ?? "0"}
                    className="min-w-28 text-right text-body-md"
                  />
                  <Button
                    variant="text"
                    className="h-9 px-2"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    aria-label="Kalemi sil"
                    title={
                      fields.length === 1
                        ? "İşlemde en az bir kalem olmalı."
                        : undefined
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {errors.kalemler?.message && (
          <p role="alert" className="text-body-sm text-red">
            {errors.kalemler.message}
          </p>
        )}

        <div>
          <Button variant="secondary" onClick={() => append(bosKalem)}>
            <Plus />
            Kalem ekle
          </Button>
        </div>
      </div>

      {/* Özet: DESIGN.md'ye göre tutarlar data-numeric ve sağa yaslı. */}
      <div className="flex justify-end">
        <dl className="flex w-full max-w-xs flex-col gap-2">
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-body-md text-muted">Ara toplam</dt>
            <dd>
              <Amount value={toplamlar.toplamMatrah} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-body-md text-muted">KDV</dt>
            <dd>
              <Amount value={toplamlar.kdvTutari} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 border-t border-border pt-2">
            <dt className="text-body-md text-ink">Genel toplam</dt>
            <dd className="text-heading-md">
              <Amount value={toplamlar.toplamTutar} />
            </dd>
          </div>
        </dl>
      </div>

      {serverError && (
        <p role="alert" className="text-body-sm text-red">
          {serverError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "İşlemi kaydet"}
        </Button>
        <Link href="/islemler" className={buttonVariants({ variant: "text" })}>
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
