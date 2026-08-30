import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { cariBakiyesiniYenile, cariBakiyesiniDogrula } from "@/lib/cari";

/**
 * Tüm cari bakiyelerini kaynak kayıtlardan YENİDEN hesaplar.
 *
 * Ne zaman gerekir: bakiye kuralı değiştiğinde (örn. çekin cari bakiyesine
 * alındığı anda işlenmesine geçiş) mevcut kayıtlar eski kurala göre
 * hesaplanmış olarak kalır. Bu script onları yeni kurala taşır.
 *
 * Güvenlidir: `bakiye` alanı zaten türetilmiş bir değerdir — kaynak kayıtlar
 * (işlem, çek/senet, ciro, ödeme) hiç değiştirilmez, yalnızca onlardan
 * hesaplanan toplam yeniden yazılır. Aynı script iki kez çalıştırılırsa
 * ikincisi hiçbir şeyi değiştirmez.
 *
 * Çalıştırma:  npm run db:bakiye-yenile
 */
async function main() {
  const cariler = await prisma.cari.findMany({
    select: { id: true, unvan: true, bakiye: true },
    orderBy: { unvan: "asc" },
  });

  if (cariler.length === 0) {
    console.log("Cari kaydı yok, yapılacak bir şey yok.");
    return;
  }

  let degisen = 0;

  for (const cari of cariler) {
    const once = cari.bakiye.toString();

    await prisma.$transaction(async (tx) => {
      await cariBakiyesiniYenile(cari.id, tx);
    });

    const sonra = (
      await prisma.cari.findUniqueOrThrow({
        where: { id: cari.id },
        select: { bakiye: true },
      })
    ).bakiye.toString();

    if (once !== sonra) {
      degisen += 1;
      console.log(`  ~ ${cari.unvan}: ${once} → ${sonra}`);
    }
  }

  // Yazdıktan sonra mutabakatı doğrula: saklanan bakiye, kaynak kayıtların
  // toplamına eşit olmalı. Bu geçmezse script işe yaramamış demektir.
  let hatali = 0;
  for (const cari of cariler) {
    const r = await cariBakiyesiniDogrula(cari.id);
    if (!r.mutabik) {
      hatali += 1;
      console.error(`  ! UYUŞMAZLIK ${cari.unvan}:`, JSON.stringify(r));
    }
  }

  console.log(
    `\n${cariler.length} cari işlendi, ${degisen} tanesinin bakiyesi değişti.`
  );
  if (hatali > 0) {
    console.error(`${hatali} cari mutabık DEĞİL.`);
    process.exitCode = 1;
  } else {
    console.log("Tüm bakiyeler kaynak kayıtlarla mutabık.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
