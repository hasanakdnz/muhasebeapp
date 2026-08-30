"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  CEK_SENET_TIPLERI,
  CEK_SENET_TIP_ETIKETI,
  CEK_SENET_YONLERI,
  CEK_SENET_YON_ETIKETI,
} from "@/lib/domain/cek-senet";
import {
  cekSenetSchema,
  type CekSenetInput,
  type CekSenetOutput,
} from "@/lib/validations/cek-senet";
import type { ActionResult } from "@/app/(dashboard)/cek-senet/actions";

export function CekSenetForm({
  cariler,
  defaultValues,
  onSubmitAction,
  submitLabel,
  cancelHref,
}: {
  cariler: Array<{ id: string; unvan: string }>;
  defaultValues: CekSenetInput;
  onSubmitAction: (values: CekSenetInput) => Promise<ActionResult>;
  submitLabel: string;
  cancelHref: string;
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
  } = useForm<CekSenetInput, unknown, CekSenetOutput>({
    resolver: zodResolver(cekSenetSchema),
    defaultValues,
  });

  // Etiket yöne göre değişir: "alınış" ile "veriliş" aynı şey değildir.
  const izlenenYon = useWatch({ control, name: "yon" });

  const onSubmit = handleSubmit(() => {
    setServerError(null);
    startTransition(async () => {
      const result = await onSubmitAction(getValues());
      if (result?.ok === false) {
        setServerError(result.error);
        for (const [alan, mesajlar] of Object.entries(result.fieldErrors ?? {})) {
          if (mesajlar?.[0]) {
            setError(alan as keyof CekSenetInput, { message: mesajlar[0] });
          }
        }
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="tip" label="Tip" error={errors.tip?.message}>
          <Select id="tip" {...register("tip")}>
            {CEK_SENET_TIPLERI.map((t) => (
              <option key={t} value={t}>
                {CEK_SENET_TIP_ETIKETI[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="yon"
          label="Yön"
          error={errors.yon?.message}
          hint="Alınan: müşteriden tahsil edeceğiniz. Verilen: tedarikçiye ödeyeceğiniz."
        >
          <Select id="yon" {...register("yon")}>
            {CEK_SENET_YONLERI.map((y) => (
              <option key={y} value={y}>
                {CEK_SENET_YON_ETIKETI[y]}
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

        <Field id="tutar" label="Tutar" error={errors.tutar?.message}>
          <Input
            id="tutar"
            inputMode="decimal"
            placeholder="0,00"
            aria-invalid={Boolean(errors.tutar)}
            {...register("tutar")}
          />
        </Field>

        <Field
          id="tarih"
          label={izlenenYon === "VERILEN" ? "Veriliş tarihi" : "Alınış tarihi"}
          error={errors.tarih?.message}
          hint="Cari bakiyesi bu tarihte değişir."
        >
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
        >
          <Input
            id="vadeTarihi"
            type="date"
            aria-invalid={Boolean(errors.vadeTarihi)}
            {...register("vadeTarihi")}
          />
        </Field>

        <Field id="aciklama" label="Açıklama" error={errors.aciklama?.message}>
          <Input
            id="aciklama"
            placeholder="Banka / çek no"
            {...register("aciklama")}
          />
        </Field>
      </div>

      {serverError && (
        <p role="alert" className="text-body-sm text-red">
          {serverError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "text" })}>
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
