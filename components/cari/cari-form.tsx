"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CARI_TIPLERI,
  CARI_TIP_ETIKETI,
  cariSchema,
  type CariInput,
  type CariOutput,
} from "@/lib/validations/cari";
import type { ActionResult } from "@/app/(dashboard)/cariler/actions";

export function CariForm({
  defaultValues,
  onSubmitAction,
  submitLabel,
  cancelHref,
}: {
  defaultValues: CariInput;
  onSubmitAction: (values: CariInput) => Promise<ActionResult>;
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
  } = useForm<CariInput, unknown, CariOutput>({
    // CLAUDE.md: aynı Zod şeması hem client hem server tarafında.
    resolver: zodResolver(cariSchema),
    defaultValues,
  });

  // Sunucuya kullanıcının YAZDIĞI ham değerler gönderilir; dönüşümü sunucu
  // kendi şemasıyla yapar, böylece client ve server tam olarak aynı yolu izler.
  const onSubmit = handleSubmit(() => {
    setServerError(null);
    startTransition(async () => {
      const result = await onSubmitAction(getValues());
      if (result?.ok === false) {
        setServerError(result.error);
        for (const [alan, mesajlar] of Object.entries(result.fieldErrors ?? {})) {
          if (mesajlar?.[0]) {
            setError(alan as keyof CariInput, { message: mesajlar[0] });
          }
        }
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id="unvan"
          label="Ünvan"
          error={errors.unvan?.message}
          className="sm:col-span-2"
        >
          <Input
            id="unvan"
            aria-invalid={Boolean(errors.unvan)}
            {...register("unvan")}
          />
        </Field>

        <Field id="tip" label="Cari tipi" error={errors.tip?.message}>
          <Select id="tip" aria-invalid={Boolean(errors.tip)} {...register("tip")}>
            {CARI_TIPLERI.map((tip) => (
              <option key={tip} value={tip}>
                {CARI_TIP_ETIKETI[tip]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="vknTckn"
          label="VKN / TCKN"
          error={errors.vknTckn?.message}
          hint="Vergi numarası 10, TC kimlik numarası 11 hane."
        >
          <Input
            id="vknTckn"
            inputMode="numeric"
            aria-invalid={Boolean(errors.vknTckn)}
            {...register("vknTckn")}
          />
        </Field>

        <Field
          id="vergiDairesi"
          label="Vergi dairesi"
          error={errors.vergiDairesi?.message}
        >
          <Input
            id="vergiDairesi"
            aria-invalid={Boolean(errors.vergiDairesi)}
            {...register("vergiDairesi")}
          />
        </Field>

        <Field id="telefon" label="Telefon" error={errors.telefon?.message}>
          <Input
            id="telefon"
            type="tel"
            aria-invalid={Boolean(errors.telefon)}
            {...register("telefon")}
          />
        </Field>

        <Field id="email" label="E-posta" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <Field
          id="bakiye"
          label="Açılış bakiyesi"
          error={errors.bakiye?.message}
          hint="Pozitif: cari size borçlu (alacak). Negatif: siz cariye borçlusunuz."
        >
          <Input
            id="bakiye"
            inputMode="decimal"
            placeholder="0,00"
            aria-invalid={Boolean(errors.bakiye)}
            {...register("bakiye")}
          />
        </Field>

        <Field
          id="adres"
          label="Adres"
          error={errors.adres?.message}
          className="sm:col-span-2"
        >
          <Textarea
            id="adres"
            aria-invalid={Boolean(errors.adres)}
            {...register("adres")}
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
        {/* <button> içine <a> konulamaz — link doğrudan buton stiliyle çizilir. */}
        <Link href={cancelHref} className={buttonVariants({ variant: "text" })}>
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
