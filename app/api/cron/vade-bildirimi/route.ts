import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { vadeBildirimiGonder } from "@/lib/bildirim";

/**
 * Vade bildirimi cron job'u.
 *
 * Dış bir zamanlayıcı (cron, Vercel Cron, Windows Görev Zamanlayıcı) çağırır;
 * oturumu yoktur, bu yüzden middleware matcher'ından muaftır (bkz. middleware.ts)
 * ve paylaşılan bir sırla korunur.
 *
 * Sır tanımlı değilse uç nokta ÇALIŞMAZ — açık bir uç nokta bırakmaktansa
 * kapalı başarısız olmak doğrudur.
 *
 * Çağrı:  curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/vade-bildirimi
 */
function yetkiliMi(request: Request): boolean {
  const sir = process.env.CRON_SECRET;
  if (!sir) return false;

  const baslik = request.headers.get("authorization") ?? "";
  const onek = "Bearer ";
  if (!baslik.startsWith(onek)) return false;

  const gelen = Buffer.from(baslik.slice(onek.length));
  const beklenen = Buffer.from(sir);
  // Uzunluk farkı timingSafeEqual'i patlatır; önce eşitlenir.
  if (gelen.length !== beklenen.length) return false;
  return timingSafeEqual(gelen, beklenen);
}

async function calistir(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { hata: "CRON_SECRET tanımlı değil; bildirim job'u devre dışı." },
      { status: 503 }
    );
  }
  if (!yetkiliMi(request)) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }

  const sonuc = await vadeBildirimiGonder(new Date());
  return NextResponse.json(sonuc);
}

export async function GET(request: Request) {
  return calistir(request);
}

// Zamanlayıcılar çoğunlukla POST kullanır.
export async function POST(request: Request) {
  return calistir(request);
}
