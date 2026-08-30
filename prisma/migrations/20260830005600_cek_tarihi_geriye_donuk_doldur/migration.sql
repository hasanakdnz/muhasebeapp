-- Veri migration'ı: CekSenet.tarih ("çekin alındığı/verildiği tarih") bir önceki
-- migration'da eklendi ve mevcut satırlar varsayılan CURRENT_TIMESTAMP değerini
-- aldı. Bir çekin alınma tarihi için elimizdeki en iyi bilgi, kaydın
-- oluşturulma zamanıdır.
--
-- Koşulsuz yazılır: sütun bir önceki migration'da doğduğu için hiçbir
-- kullanıcının henüz gerçek bir tarih girmiş olması mümkün değildir.
-- (Koşullu yazmak ayrıca hatalıydı: SQLite'ta tarihler "2026-08-30 00:55:22"
-- ve "2026-08-30T00:00:36.505+00:00" gibi FARKLI biçimlerde saklanabiliyor,
-- düz string karşılaştırması yanlış sonuç veriyor.)
UPDATE "CekSenet" SET "tarih" = "createdAt";

-- Karşılıksız işaretli kayıtlarda geri dönüş tarihi bilinmiyor; en yakın
-- bilgi son güncelleme zamanıdır.
UPDATE "CekSenet"
SET "karsiliksizTarihi" = "updatedAt"
WHERE "durum" = 'KARSILIKSIZ' AND "karsiliksizTarihi" IS NULL;
