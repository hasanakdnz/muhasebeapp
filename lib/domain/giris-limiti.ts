/**
 * Giriş deneme sınırı — saf mantık, durum tutmaz, doğrudan test edilebilir.
 *
 * Sorun: `authorize` sınırsız deneme kabul ediyordu. bcrypt maliyeti (~200ms)
 * tek başına caydırıcı değildir; paralel istekle saniyede onlarca parola
 * denenebilir ve zayıf bir parola kısa sürede bulunur.
 *
 * Kural: bir anahtar (e-posta ya da IP) için PENCERE içinde MAKS_DENEME kadar
 * BAŞARISIZ giriş olursa, anahtar KILIT_SURESI boyunca reddedilir. Başarılı
 * giriş sayacı sıfırlar.
 *
 * Sayaç e-posta VE IP için ayrı tutulur: yalnızca e-posta sayılsaydı saldırgan
 * her istekte farklı e-posta deneyerek sınırı atlardı; yalnızca IP sayılsaydı
 * ortak IP arkasındaki bir ofis tek kullanıcının hatasıyla kilitlenirdi.
 */

export const MAKS_DENEME = 5;
/** Bu süre içindeki başarısız denemeler birlikte sayılır. */
export const PENCERE_MS = 15 * 60_000;
/** Sınır aşılınca uygulanan bekleme. */
export const KILIT_SURESI_MS = 15 * 60_000;

export type LimitDurumu =
  | { izinli: true }
  | { izinli: false; kalanSaniye: number };

/** Pencere dışında kalan denemeleri atar — sayaç sonsuza dek büyümez. */
export function pencereyeIndir(
  denemeler: number[],
  simdi: number,
  pencereMs: number = PENCERE_MS
): number[] {
  const sinir = simdi - pencereMs;
  return denemeler.filter((t) => t > sinir);
}

/**
 * Bu anahtar şu an giriş deneyebilir mi?
 *
 * Kilit, SON başarısız denemeden itibaren sayılır: kilitliyken yapılan her
 * deneme süreyi uzatır. Aksi halde saldırgan kilit bitimini bekleyip yeniden
 * MAKS_DENEME hakkı kazanırdı.
 */
export function limitDurumu(
  denemeler: number[],
  simdi: number,
  secenek: {
    maksDeneme?: number;
    pencereMs?: number;
    kilitSuresiMs?: number;
  } = {}
): LimitDurumu {
  const maks = secenek.maksDeneme ?? MAKS_DENEME;
  const pencere = secenek.pencereMs ?? PENCERE_MS;
  const kilit = secenek.kilitSuresiMs ?? KILIT_SURESI_MS;

  const guncel = pencereyeIndir(denemeler, simdi, pencere);
  if (guncel.length < maks) return { izinli: true };

  const sonDeneme = Math.max(...guncel);
  const kilitBitisi = sonDeneme + kilit;
  if (simdi >= kilitBitisi) return { izinli: true };

  return {
    izinli: false,
    kalanSaniye: Math.ceil((kilitBitisi - simdi) / 1000),
  };
}

/** Kullanıcıya gösterilecek mesaj — kalan süreyi dakika olarak söyler. */
export function kilitMesaji(kalanSaniye: number): string {
  const dakika = Math.max(1, Math.ceil(kalanSaniye / 60));
  return `Çok fazla hatalı giriş denemesi. ${dakika} dakika sonra tekrar deneyin.`;
}
