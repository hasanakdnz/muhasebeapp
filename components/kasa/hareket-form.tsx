"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { HAREKET_YONLERI, HAREKET_YON_ETIKETI } from "@/lib/domain/kasa";
import {
  hareketSchema,
  type HareketInput,
  type HareketOutput,
} from "@/lib/validations/kasa";
import { createHareket } from "@/app/(dashboard)/kasa-banka/actions";

/**
 * Manuel giriş/çıkış kaydı. Kullanıcı daima POZİTİF tutar + yön girer;
 * işaret sunucuda isaretliTutar ile uygulanır (lib/domain/kasa.ts).
 */
export function HareketForm({
  hesapId,
  bugun,
}: {
  hesapId: string;
  /** Sunucuda üretilir — client/server saat farkından hydration uyuşmazlığı olmasın. */
  bugun: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const defaultValues: HareketInput = {
    yon: "GIRIS",
    tutar: "",
    aciklama: "",
    tarih: bugun,
  };

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors },
  } = useForm<HareketInput, unknown, HareketOutput>({
    resolver: zodResolver(hareketSchema),
    defaultValues,
  });

  const onSubmit = handleSubmit(() => {
    setServerError(null);
    startTransition(async () => {
      const result = await createHareket(hesapId, getValues());
      if (result.ok === false) {
        setServerError(result.error);
        for (const [alan, mesajlar] of Object.entries(result.fieldErrors ?? {})) {
          if (mesajlar?.[0]) {
            setError(alan as keyof HareketInput, { message: mesajlar[0] });
          }
        }
        return;
      }
      reset(defaultValues);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-4">
        <Field id="yon" label="Yön" error={errors.yon?.message}>
          <Select id="yon" aria-invalid={Boolean(errors.yon)} {...register("yon")}>
            {HAREKET_YONLERI.map((yon) => (
              <option key={yon} value={yon}>
                {HAREKET_YON_ETIKETI[yon]}
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

        <Field id="tarih" label="Tarih" error={errors.tarih?.message}>
          <Input
            id="tarih"
            type="date"
            aria-invalid={Boolean(errors.tarih)}
            {...register("tarih")}
          />
        </Field>

        <Field id="aciklama" label="Açıklama" error={errors.aciklama?.message}>
          <Input
            id="aciklama"
            aria-invalid={Boolean(errors.aciklama)}
            {...register("aciklama")}
          />
        </Field>
      </div>

      {serverError && (
        <p role="alert" className="text-body-sm text-red">
          {serverError}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          <Plus />
          {pending ? "Ekleniyor…" : "Hareket ekle"}
        </Button>
      </div>
    </form>
  );
}
