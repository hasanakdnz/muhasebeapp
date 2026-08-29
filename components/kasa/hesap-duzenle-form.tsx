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
  hesapDuzenleSchema,
  type HesapDuzenleInput,
  type HesapDuzenleOutput,
} from "@/lib/validations/kasa";
import type { ActionResult } from "@/app/(dashboard)/kasa-banka/actions";

/**
 * Düzenlemede bakiye alanı YOKTUR — bakiye hareketlerden doğar. Elle
 * düzeltilebilseydi `bakiye = Σ hareket` değişmezi bozulurdu.
 */
export function HesapDuzenleForm({
  defaultValues,
  onSubmitAction,
  cancelHref,
}: {
  defaultValues: HesapDuzenleInput;
  onSubmitAction: (values: HesapDuzenleInput) => Promise<ActionResult>;
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
  } = useForm<HesapDuzenleInput, unknown, HesapDuzenleOutput>({
    resolver: zodResolver(hesapDuzenleSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(() => {
    setServerError(null);
    startTransition(async () => {
      const result = await onSubmitAction(getValues());
      if (result?.ok === false) {
        setServerError(result.error);
        for (const [alan, mesajlar] of Object.entries(result.fieldErrors ?? {})) {
          if (mesajlar?.[0]) {
            setError(alan as keyof HesapDuzenleInput, { message: mesajlar[0] });
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
      </div>

      {serverError && (
        <p role="alert" className="text-body-sm text-red">
          {serverError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "text" })}>
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
