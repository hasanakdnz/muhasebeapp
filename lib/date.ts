const TARIH = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const TARIH_SAAT = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTarih(value: Date | string): string {
  return TARIH.format(new Date(value));
}

export function formatTarihSaat(value: Date | string): string {
  return TARIH_SAAT.format(new Date(value));
}

/** <input type="date"> için YYYY-MM-DD. Yerel saat dilimine göre üretilir. */
export function toDateInputValue(value: Date | string): string {
  const d = new Date(value);
  const ay = `${d.getMonth() + 1}`.padStart(2, "0");
  const gun = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${ay}-${gun}`;
}
