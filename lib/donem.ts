import { toDateInputValue } from "@/lib/date";

/** Rapor dönemi — searchParams'tan güvenli şekilde çözülür. */
export type Donem = {
  baslangic: Date;
  bitis: Date;
  /** <input type="date"> için değerler. */
  baslangicInput: string;
  bitisInput: string;
  etiket: string;
};

const TARIH_KALIBI = /^\d{4}-\d{2}-\d{2}$/;

function ayrist(deger: string | undefined): Date | null {
  if (!deger || !TARIH_KALIBI.test(deger)) return null;
  const [yil, ay, gun] = deger.split("-").map(Number);
  const d = new Date(yil, ay - 1, gun);
  return Number.isNaN(d.getTime()) ? null : d;
}

const ETIKET = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/**
 * Dönem çözümü. Varsayılan: içinde bulunulan ay.
 * Bitiş günün SONUNA çekilir — aksi halde bitiş günü kayıtları rapora girmez.
 */
export function donemCoz(
  sp: { baslangic?: string; bitis?: string },
  bugun: Date = new Date()
): Donem {
  const varsayilanBaslangic = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
  const varsayilanBitis = new Date(
    bugun.getFullYear(),
    bugun.getMonth() + 1,
    0
  );

  const baslangic = ayrist(sp.baslangic) ?? varsayilanBaslangic;
  const secilenBitis = ayrist(sp.bitis) ?? varsayilanBitis;
  const bitis = new Date(
    secilenBitis.getFullYear(),
    secilenBitis.getMonth(),
    secilenBitis.getDate(),
    23,
    59,
    59,
    999
  );

  return {
    baslangic,
    bitis,
    baslangicInput: toDateInputValue(baslangic),
    bitisInput: toDateInputValue(secilenBitis),
    etiket: `${ETIKET.format(baslangic)} – ${ETIKET.format(secilenBitis)}`,
  };
}
