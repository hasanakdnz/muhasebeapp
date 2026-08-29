// lib/prisma.ts modül yüklenirken DATABASE_URL ister. Entegrasyon testleri
// kendi izole veritabanlarını kurar; global client kullanılmaz. Yine de yanlışlıkla
// geliştirme veritabanına dokunulmasın diye kullanılmayan bir yola işaret ediyoruz.
process.env.DATABASE_URL ??= "file:./.vitest-unused.db";
