"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  HESAP_TIPLERI,
  HESAP_TIP_ETIKETI,
  hesapSchema,
  type HesapInput,
  type HesapOutput,
} from "@/lib/validations/kasa";
import type { ActionResult } from "@/app/(dashboard)/kasa-banka/actions";

export function HesapForm({
  defaultValues,
  onSubmitAction,
  submitLabel,
  cancelHref,
}: {
  defaultValues: HesapInput;
  onSubmitAction: (values: HesapInput) => Promise<ActionResult>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<HesapInput, unknown, HesapOutput>({
    resolver: zodResolver(hesapSchema),
    defaultValues,
  });

  // handleSubmit yalnızca doğrulama geçtiğinde çalışır; sunucuya kullanıcının
  // YAZDIĞI ham değerler gönderilir — dönüşümü sunucu kendi şemasıyla yapar,
  // böylece client ve server tam olarak aynı yolu izler.
  const onSubmit = handleSubmit(() => {
    setServerError(null);
    startTransition(async () => {
      const result = await onSubmitAction(getValues());
      if (result?.ok === false) {
        setServerError(result.error);
        for (const [alan, mesajlar] of Object.entries(result.fieldErrors ?? {})) {
          if (mesajlar?.[0]) {
            setError(alan as keyof HesapInput, { message: mesajlar[0] });
          }
        }
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id="ad"
          label="Hesap adı"
          error={errors.ad?.message}
          className="sm:col-span-2"
        >
          <Input id="ad" aria-invalid={Boolean(errors.ad)} {...register("ad")} />
        </Field>

        <Field id="tip" label="Hesap tipi" error={errors.tip?.message}>
          <Select id="tip" aria-invalid={Boolean(errors.tip)} {...register("tip")}>
            {HESAP_TIPLERI.map((tip) => (
              <option key={tip} value={tip}>
                {HESAP_TIP_ETIKETI[tip]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="acilisBakiyesi"
          label="Açılış bakiyesi"
          error={errors.acilisBakiyesi?.message}
          hint="Açılış bakiyesi bir hareket olarak kaydedilir."
        >
          <Input
            id="acilisBakiyesi"
            inputMode="decimal"
            placeholder="0,00"
            aria-invalid={Boolean(errors.acilisBakiyesi)}
            {...register("acilisBakiyesi")}
          />
        </Field>

        <Field
          id="acilisTarihi"
          label="Açılış tarihi"
          error={errors.acilisTarihi?.message}
        >
          <Input
            id="acilisTarihi"
            type="date"
            aria-invalid={Boolean(errors.acilisTarihi)}
            {...register("acilisTarihi")}
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
