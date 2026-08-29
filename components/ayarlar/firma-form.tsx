"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  firmaSchema,
  type FirmaInput,
  type FirmaOutput,
} from "@/lib/validations/firma";
import type { ActionResult } from "@/app/(dashboard)/ayarlar/actions";

const LOGO_KABUL = "image/jpeg,image/png,image/webp";

export function FirmaForm({
  defaultValues,
  logoUrl,
  logoAdi,
  onSubmitAction,
  onRemoveLogoAction,
}: {
  defaultValues: FirmaInput;
  logoUrl: string | null;
  logoAdi: string | null;
  onSubmitAction: (formData: FormData) => Promise<ActionResult>;
  onRemoveLogoAction: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const logoRef = React.useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors },
  } = useForm<FirmaInput, unknown, FirmaOutput>({
    resolver: zodResolver(firmaSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(() => {
    setServerError(null);
    setKaydedildi(false);
    const d = getValues();

    const formData = new FormData();
    for (const alan of [
      "unvan",
      "vknTckn",
      "vergiDairesi",
      "adres",
      "telefon",
      "email",
      "iban",
    ] as const) {
      formData.set(alan, d[alan] ?? "");
    }
    const dosya = logoRef.current?.files?.[0];
    if (dosya) formData.set("logo", dosya);

    startTransition(async () => {
      const sonuc = await onSubmitAction(formData);
      if (sonuc.ok === false) {
        setServerError(sonuc.error);
        for (const [alan, mesajlar] of Object.entries(sonuc.fieldErrors ?? {})) {
          if (mesajlar?.[0]) {
            setError(alan as keyof FirmaInput, { message: mesajlar[0] });
          }
        }
        return;
      }
      if (logoRef.current) logoRef.current.value = "";
      setKaydedildi(true);
      router.refresh();
    });
  });

  function logoyuKaldir() {
    setServerError(null);
    startTransition(async () => {
      const sonuc = await onRemoveLogoAction();
      if (sonuc.ok === false) setServerError(sonuc.error);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card className="flex flex-col gap-6">
        <CardTitle>Künye</CardTitle>

        <Field id="unvan" label="Firma ünvanı" error={errors.unvan?.message}>
          <Input id="unvan" autoComplete="organization" {...register("unvan")} />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id="vknTckn"
            label="VKN / TCKN"
            error={errors.vknTckn?.message}
            hint="Vergi numarası 10, TC kimlik 11 hane."
          >
            <Input id="vknTckn" inputMode="numeric" {...register("vknTckn")} />
          </Field>
          <Field
            id="vergiDairesi"
            label="Vergi dairesi"
            error={errors.vergiDairesi?.message}
          >
            <Input id="vergiDairesi" {...register("vergiDairesi")} />
          </Field>
        </div>

        <Field id="adres" label="Adres" error={errors.adres?.message}>
          <Textarea id="adres" rows={3} {...register("adres")} />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="telefon" label="Telefon" error={errors.telefon?.message}>
            <Input id="telefon" inputMode="tel" {...register("telefon")} />
          </Field>
          <Field id="email" label="E-posta" error={errors.email?.message}>
            <Input id="email" type="email" {...register("email")} />
          </Field>
        </div>

        <Field
          id="iban"
          label="IBAN"
          error={errors.iban?.message}
          hint="Teklif çıktısının altında ödeme bilgisi olarak görünür."
        >
          <Input id="iban" placeholder="TR00 0000 …" {...register("iban")} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-6">
        <CardTitle>Logo</CardTitle>

        {logoUrl ? (
          <div className="flex items-center gap-6">
            {/* Depodan servis edilen dosya; boyutu bilinmediği için
                unoptimized — Next optimizasyonu özel rotayı yeniden çeker. */}
            <Image
              src={`/api/belge/${logoUrl}`}
              alt={logoAdi ?? "Firma logosu"}
              width={160}
              height={64}
              unoptimized
              className="h-16 w-auto max-w-40 object-contain"
            />
            <div className="flex flex-col gap-2">
              <p className="text-body-sm text-muted">{logoAdi}</p>
              <Button
                type="button"
                variant="text"
                onClick={logoyuKaldir}
                disabled={pending}
                className="self-start px-0"
              >
                <X />
                Logoyu kaldır
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-body-sm text-muted">
            Henüz logo yüklenmedi. Teklif çıktısında yalnızca firma ünvanı
            görünür.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="logo">
            {logoUrl ? "Yeni logo yükle" : "Logo yükle"}
          </Label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept={LOGO_KABUL}
            ref={logoRef}
            className="text-body-sm text-muted file:mr-4 file:h-10 file:cursor-pointer file:rounded-app file:border file:border-border file:bg-surface file:px-4 file:text-body-sm file:text-ink hover:file:bg-surface-muted"
          />
          <p className="text-body-sm text-muted">
            JPG, PNG veya WebP · en fazla 10 MB
          </p>
        </div>
      </Card>

      {serverError && (
        <p role="alert" className="text-body-sm text-red">
          {serverError}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        {kaydedildi && !pending && (
          <span className="flex items-center gap-2 text-body-sm text-green">
            <Check className="size-4 stroke-[1.5]" />
            Kaydedildi
          </span>
        )}
      </div>
    </form>
  );
}
