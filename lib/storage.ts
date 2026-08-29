import "server-only";

import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  IZINLI_BELGE_TURLERI,
  MAKS_BELGE_BOYUTU,
  anahtarGecerliMi,
  type BelgeTuru,
} from "@/lib/belge-turleri";

/**
 * Belge (fiş/dekont) deposu — YALNIZCA sunucu.
 *
 * ROADMAP Faz 5'te S3 yazıyor; ancak CLAUDE.md bulut altyapısı ve kimlik
 * bilgisi gerektiren konuları şimdilik kapsam dışı bırakıyor (SQLite kararıyla
 * aynı gerekçe). Bu yüzden yerel dosya sistemi kullanılıyor ve tüm erişim bu
 * modülün arkasına alınıyor: S3'e geçiş yalnızca bu dosyayı değiştirir.
 *
 * `import "server-only"` bilinçlidir: bu modül bir client component'e sızarsa
 * build ANINDA kırılır. Node API'leri (fs/crypto/path) sessizce istemci
 * paketine sürüklenmemeli. İstemcinin de ihtiyaç duyduğu sabitler
 * lib/belge-turleri.ts içindedir.
 *
 * ## Güvenlik
 *  - Depo anahtarı rastgele üretilir; kullanıcının dosya adı YOLA hiç girmez.
 *  - Okuma sırasında anahtar katı bir kalıba karşı doğrulanır (dizin geçişi yok).
 *  - Dosya türü İÇERİK İMZASI (magic bytes) ile denetlenir; yalnızca uzantıya
 *    veya istemcinin bildirdiği MIME'a güvenilmez.
 *  - Servis eden rota oturum ister (app/api/belge/[anahtar]/route.ts).
 */

export {
  IZINLI_MIME_TIPLERI,
  MAKS_BELGE_BOYUTU,
  anahtarGecerliMi,
  anahtarMimeTipi,
} from "@/lib/belge-turleri";

function depoKlasoru(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
}

function imzaUyuyorMu(bytes: Uint8Array, tur: BelgeTuru): boolean {
  const ofset = tur.ofset ?? 0;
  if (bytes.length < ofset + tur.imza.length) return false;
  return tur.imza.every((b, i) => bytes[ofset + i] === b);
}

export type BelgeKaydiSonucu =
  | { ok: true; anahtar: string; ad: string; boyut: number }
  | { ok: false; hata: string };

export async function belgeKaydet(dosya: File): Promise<BelgeKaydiSonucu> {
  if (dosya.size === 0) return { ok: false, hata: "Dosya boş." };
  if (dosya.size > MAKS_BELGE_BOYUTU) {
    return { ok: false, hata: "Dosya en fazla 10 MB olabilir." };
  }

  const bytes = new Uint8Array(await dosya.arrayBuffer());

  // İçerik imzası belirleyicidir; uzantısı değiştirilmiş bir dosya buradan geçemez.
  const tur = IZINLI_BELGE_TURLERI.find((t) => imzaUyuyorMu(bytes, t));
  if (!tur) {
    return {
      ok: false,
      hata: "Yalnızca JPEG, PNG, WebP veya PDF yükleyebilirsiniz.",
    };
  }

  const anahtar = `${randomBytes(16).toString("hex")}.${tur.uzanti}`;
  const klasor = depoKlasoru();
  await fs.mkdir(klasor, { recursive: true });
  await fs.writeFile(path.join(klasor, anahtar), bytes);

  return {
    ok: true,
    anahtar,
    // Özgün ad yalnızca gösterim/indirme için saklanır, YOLA girmez.
    ad: dosya.name.slice(0, 200),
    boyut: dosya.size,
  };
}

export async function belgeOku(anahtar: string): Promise<Buffer | null> {
  // Dizin geçişi (../) bu kontrolden geçemez: anahtar yalnızca hex + uzantıdır.
  if (!anahtarGecerliMi(anahtar)) return null;
  try {
    return await fs.readFile(path.join(depoKlasoru(), anahtar));
  } catch {
    return null;
  }
}

export async function belgeSil(anahtar: string): Promise<void> {
  if (!anahtarGecerliMi(anahtar)) return;
  try {
    await fs.unlink(path.join(depoKlasoru(), anahtar));
  } catch {
    // Dosya zaten yoksa sorun değil — kayıt silinebilmeli.
  }
}
