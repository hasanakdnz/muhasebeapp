"use client";

import * as React from "react";
import Link from "next/link";
import { Paperclip } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Amount } from "@/components/ui/amount";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  GIDER_KATEGORILERI,
  GIDER_KDV_ORANLARI,
  kdvAyir,
} from "@/lib/domain/gider";
import { parseAmountInput } from "@/lib/money";
import { IZINLI_MIME_TIPLERI } from "@/lib/belge-turleri";
import {
  giderSchema,
  type GiderInput,
  type GiderOutput,
} from "@/lib/validations/gider";
import type { ActionResult } from "@/app/(dashboard)/giderler/actions";

export type HesapSecenegi = { id: string; ad: string };

export function GiderForm({
  defaultValues,
  hesaplar,
  onSubmitAction,
  submitLabel,
  cancelHref,
  mevcutBelgeAdi,
}: {
  defaultValues: GiderInput;
  hesaplar: HesapSecenegi[];
  onSubmitAction: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  cancelHref: string;
  mevcutBelgeAdi?: string | null;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const dosyaRef = React.useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    getValues,
    control,
    setError,
    formState: { errors },
  } = useForm<GiderInput, unknown, GiderOutput>({
    resolver: zodResolver(giderSchema),
    defaultValues,
  });

  // Canlı KDV önizlemesi sunucudaki AYNI fonksiyonla hesaplanır — kullanıcının
  // gördüğü ayrım ile kaydedilen ayrım ayrışamaz.
  const izlenen = useWatch({ control });
  const ayrim = React.useMemo(() => {
    const parsed = parseAmountInput(izlenen.tutar ?? "");
    return kdvAyir(parsed ? parsed.toString() : "0", izlenen.kdvOrani ?? "0");
  }, [izlenen.tutar, izlenen.kdvOrani]);

  const onSubmit = handleSubmit(() => {
    setServerError(null);
    const degerler = getValues();

    const formData = new FormData();
    formData.set("kategori", degerler.kategori);
    formData.set("tutar", degerler.tutar ?? "");
    formData.set("kdvOrani", degerler.kdvOrani);
    formData.set("aciklama", degerler.aciklama ?? "");
    formData.set("hesapId", degerler.hesapId ?? "");
    formData.set("tarih", degerler.tarih ?? "");

    const dosya = dosyaRef.current?.files?.[0];
    if (dosya) formData.set("belge", dosya);

    startTransition(async () => {
      const result = await onSubmitAction(formData);
      if (result?.ok === false) {
        setServerError(result.error);
        for (const [alan, mesajlar] of Object.entries(result.fieldErrors ?? {})) {
          if (mesajlar?.[0]) {
            setError(alan as keyof GiderInput, { message: mesajlar[0] });
          }
        }
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="kategori" label="Kategori" error={errors.kategori?.message}>
          <Select id="kategori" {...register("kategori")}>
            {GIDER_KATEGORILERI.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="tarih" label="Tarih" error={errors.tarih?.message}>
          <Input
            id="tarih"
            type="date"
            aria-invalid={Boolean(errors.tarih)}
            {...register("tarih")}
          />
        </Field>

        <Field
          id="hesapId"
          label="Hangi hesaptan"
          hint={
            hesaplar.length === 0
              ? "Kasa/banka hesabı tanımlı değil."
              : "Boş bırakılırsa kasa hareketi oluşmaz."
          }
        >
          <Select
            id="hesapId"
            disabled={hesaplar.length === 0}
            {...register("hesapId")}
          >
            <option value="">Kasaya işleme</option>
            {hesaplar.map((h) => (
              <option key={h.id} value={h.id}>
                {h.ad}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="tutar"
          label="Tutar (KDV dahil)"
          error={errors.tutar?.message}
          hint="Fişin üzerindeki toplam tutar."
        >
          <Input
            id="tutar"
            inputMode="decimal"
            placeholder="0,00"
            aria-invalid={Boolean(errors.tutar)}
            {...register("tutar")}
          />
        </Field>

        <Field id="kdvOrani" label="KDV oranı" error={errors.kdvOrani?.message}>
          <Select id="kdvOrani" {...register("kdvOrani")}>
            {GIDER_KDV_ORANLARI.map((o) => (
              <option key={o} value={o}>
                %{o}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="aciklama"
          label="Açıklama"
          error={errors.aciklama?.message}
          className="sm:col-span-2"
        >
          <Textarea id="aciklama" {...register("aciklama")} />
        </Field>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="belge">Fiş / dekont</Label>
          <input
            ref={dosyaRef}
            id="belge"
            name="belge"
            type="file"
            accept={IZINLI_MIME_TIPLERI.join(",")}
            className="text-body-md text-muted file:mr-3 file:rounded-app file:border-0 file:bg-surface-muted file:px-4 file:py-2 file:text-body-md file:text-ink hover:file:bg-border"
          />
          <p className="text-body-sm text-muted">
            {mevcutBelgeAdi
              ? `Yüklü: ${mevcutBelgeAdi} — yeni dosya seçerseniz değiştirilir.`
              : "JPEG, PNG, WebP veya PDF · en fazla 10 MB."}
          </p>
        </div>
      </div>

      {/* KDV ayrımı önizlemesi */}
      <div className="flex justify-end">
        <dl className="flex w-full max-w-xs flex-col gap-2">
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-body-md text-muted">Matrah</dt>
            <dd>
              <Amount value={ayrim.matrah} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <dt className="text-body-md text-muted">KDV</dt>
            <dd>
              <Amount value={ayrim.kdv} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-6 border-t border-border pt-2">
            <dt className="text-body-md text-ink">Toplam</dt>
            <dd className="text-heading-md">
              <Amount value={ayrim.brut} />
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
          <Paperclip />
          {pending ? "Kaydediliyor…" : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "text" })}>
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
