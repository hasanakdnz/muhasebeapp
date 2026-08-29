"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTRY } from "@/lib/money";
import type { AylikNakitAkisi } from "@/lib/dashboard";

/**
 * Nakit akışı — kasa/banka giriş ve çıkışı, aylık.
 *
 * Renk burada anlam taşır (yeşil giriş, kırmızı çıkış). Ancak bu iki ton renk
 * körlüğünde birbirine yakın düşer; bu yüzden ikincil kodlama olarak giriş
 * sıfır çizgisinin ÜSTÜNE, çıkış ALTINA çizilir. Konum tek başına okunur,
 * renk yalnızca teyit eder. Ayrıca lejant ve ekran okuyucular için bir tablo
 * karşılığı bulunur.
 */

const eksenBicimi = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function Ipucu({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AylikNakitAkisi }>;
}) {
  if (!active || !payload?.length) return null;
  const veri = payload[0].payload;

  return (
    <div className="rounded-app bg-surface p-4 shadow-float">
      <p className="text-label-md text-muted">{veri.etiket}</p>
      <dl className="mt-2 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-6">
          <dt className="text-body-sm text-muted">Giriş</dt>
          <dd className="text-body-sm text-green" data-numeric="">
            {formatTRY(veri.girisTam)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-6">
          <dt className="text-body-sm text-muted">Çıkış</dt>
          <dd className="text-body-sm text-red" data-numeric="">
            {formatTRY(veri.cikisTam)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function NakitAkisi({ veriler }: { veriler: AylikNakitAkisi[] }) {
  const bosMu = veriler.every((v) => v.giris === 0 && v.cikis === 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Lejant: iki seri olduğu için her zaman bulunur, kimlik renge
          bırakılmaz. */}
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-2 text-body-sm text-muted">
          <span
            aria-hidden
            className="size-2.5 rounded-full bg-green"
          />
          Giriş
        </span>
        <span className="flex items-center gap-2 text-body-sm text-muted">
          <span aria-hidden className="size-2.5 rounded-full bg-red" />
          Çıkış
        </span>
      </div>

      {bosMu ? (
        <p className="py-16 text-center text-body-md text-muted">
          Bu dönemde kasa/banka hareketi yok.
        </p>
      ) : (
        <div className="h-64 w-full" role="img" aria-label="Aylık nakit akışı grafiği">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={veriler}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              barGap={2}
            >
              {/* Geri çekilmiş, yalnızca yatay, kesiksiz ızgara. */}
              <CartesianGrid
                vertical={false}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <XAxis
                dataKey="etiket"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-muted)", fontSize: 12 }}
                dy={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                tick={{ fill: "var(--color-muted)", fontSize: 12 }}
                tickFormatter={(v: number) => eksenBicimi.format(v)}
              />
              <ReferenceLine y={0} stroke="var(--color-border)" strokeWidth={1} />
              <Tooltip
                content={<Ipucu />}
                cursor={{ fill: "var(--color-surface-muted)" }}
              />
              {/* Yuvarlatılmış uçlar taban çizgisine sabitlenir: giriş yukarı
                  büyür (üst köşeler), çıkış aşağı (alt köşeler). */}
              {/* isAnimationActive={false}: DESIGN.md dekoratif animasyon
                  kullanmaz — hareket yalnızca sayılı "seçili anlar"dadır ve
                  grafik onlardan biri değildir. Ayrıca Recharts'ın giriş
                  animasyonu, sekme arka plandayken (requestAnimationFrame
                  kısıtlanır) yarıda donup çubukları YANLIŞ yükseklikte bırakıyor. */}
              <Bar
                dataKey="giris"
                name="Giriş"
                fill="var(--color-green)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
              <Bar
                dataKey="cikis"
                name="Çıkış"
                fill="var(--color-red)"
                radius={[0, 0, 4, 4]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grafiğin tablo karşılığı — ekran okuyucular ve renk körlüğü için. */}
      <table className="sr-only">
        <caption>Aylık nakit akışı</caption>
        <thead>
          <tr>
            <th scope="col">Ay</th>
            <th scope="col">Giriş</th>
            <th scope="col">Çıkış</th>
          </tr>
        </thead>
        <tbody>
          {veriler.map((v) => (
            <tr key={v.ay}>
              <th scope="row">{v.etiket}</th>
              <td>{formatTRY(v.girisTam)}</td>
              <td>{formatTRY(v.cikisTam)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
