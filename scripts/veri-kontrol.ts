import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  cariBakiyesiniDogrula,
  cariEkstresiGetir,
  listeleCariler,
} from "@/lib/cari";
import { cekSenetiDogrula } from "@/lib/cek-senet";
import { hesapBakiyesiniDogrula } from "@/lib/kasa";
import { islemOdemesiniDogrula } from "@/lib/odeme";
import { hesabaIslenmemisGiderSayisi } from "@/lib/gider";
import { formatTRY } from "@/lib/money";

/**
 * Veri bütünlüğü denetimi.
 *
 * Uygulamadaki her saklanan toplam, kaynak kayıtlardan yeniden hesaplanabilir
 * olmalıdır. Bu script hepsini tek tek ölçer:
 *
 *   Cari.bakiye        = açılış + Σ(işlem, çek, ciro, direkt ödeme)
 *   KasaBanka.bakiye   = Σ HesapHareketi.tutar
 *   CekSenet.tahsilEdilen = Σ CekSenetTahsilat.tutar
 *   Islem.odenenTutar  = Σ IslemOdeme.tutar
 *   Cari ekstresinin son yürüyen bakiyesi = Cari.bakiye
 *
 * Uyuşmazlık, kodun bir yerinde bir kaynağın unutulduğu anlamına gelir; sessiz
 * kalmasındansa burada patlaması iyidir.
 *
 * Çalıştırma:  npm run db:kontrol
 */

type Sorun = { nerede: string; ayrinti: string };

async function main() {
  const sorunlar: Sorun[] = [];

  const cariler = await listeleCariler({ pasifleriGoster: true });
  for (const c of cariler) {
    const r = await cariBakiyesiniDogrula(c.id);
    if (!r.mutabik) {
      sorunlar.push({
        nerede: `Cari · ${c.unvan}`,
        ayrinti: `saklanan ${r.saklanan} ≠ hesaplanan ${r.hesaplanan}`,
      });
    }

    const e = await cariEkstresiGetir(c.id);
    if (e && !e.mutabik) {
      sorunlar.push({
        nerede: `Ekstre · ${c.unvan}`,
        ayrinti: `ekstre sonu ${e.satirlar.at(-1)?.yurutulenBakiye ?? e.acilisBakiyesi} ≠ bakiye ${e.sonBakiye}`,
      });
    }
  }

  const hesaplar = await prisma.kasaBanka.findMany({
    select: { id: true, ad: true },
  });
  for (const h of hesaplar) {
    const r = await hesapBakiyesiniDogrula(h.id);
    if (!r.mutabik) {
      sorunlar.push({
        nerede: `Hesap · ${h.ad}`,
        ayrinti: `saklanan ${r.saklanan} ≠ hesaplanan ${r.hesaplanan}`,
      });
    }
  }

  const cekler = await prisma.cekSenet.findMany({
    select: { id: true, aciklama: true, tutar: true },
  });
  for (const c of cekler) {
    const r = await cekSenetiDogrula(c.id);
    const ad = c.aciklama ?? formatTRY(c.tutar.toString());
    if (!r.mutabik) {
      sorunlar.push({
        nerede: `Çek/Senet · ${ad}`,
        ayrinti: `tahsilEdilen ${r.saklanan} ≠ Σ tahsilat ${r.hesaplanan}`,
      });
    }
    if (!r.durumDogruMu) {
      sorunlar.push({
        nerede: `Çek/Senet · ${ad}`,
        ayrinti: "durum, tahsilat toplamıyla tutmuyor",
      });
    }
  }

  const islemler = await prisma.islem.findMany({ select: { id: true, no: true } });
  for (const i of islemler) {
    const r = await islemOdemesiniDogrula(i.id);
    if (!r.mutabik) {
      sorunlar.push({
        nerede: `İşlem · ${i.no}`,
        ayrinti: `odenenTutar ${r.saklanan} ≠ Σ ödeme ${r.hesaplanan}`,
      });
    }
  }

  const kapsam =
    `${cariler.length} cari · ${hesaplar.length} hesap · ` +
    `${cekler.length} çek/senet · ${islemler.length} işlem`;

  if (sorunlar.length === 0) {
    console.log(`Tüm bakiyeler kaynak kayıtlarla mutabık (${kapsam}).`);
  } else {
    console.error(`${sorunlar.length} uyuşmazlık (${kapsam}):`);
    for (const s of sorunlar) console.error(`  ! ${s.nerede}: ${s.ayrinti}`);
    process.exitCode = 1;
  }

  // Uyuşmazlık değil, dikkat çekilecek bir durum: parası kasadan çıkmamış gider.
  const islenmemis = await hesabaIslenmemisGiderSayisi();
  if (islenmemis > 0) {
    console.log(
      `Not: ${islenmemis} gider kasa/banka hesabına işlenmemiş — tutarları Kasa bakiyesine yansımıyor.`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
