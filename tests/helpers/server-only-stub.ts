// `server-only` paketi, react-server koşulu dışında import edildiğinde bilerek
// hata fırlatır — client component'e sızmayı build anında yakalamak için.
// Vitest bu koşulu uygulamadığı ve testler zaten sunucu tarafını çalıştırdığı
// için test ortamında bu boş modüle yönlendirilir (bkz. vitest.config.mts).
export {};
