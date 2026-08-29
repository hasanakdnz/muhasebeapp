import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // `@/*` alias'ı tsconfig.json'dan okunur.
    tsconfigPaths: true,
    alias: {
      // Sunucu-yalnız modüller testte de çalışabilmeli; ayrıntı için stub'a bak.
      "server-only": path.resolve("tests/helpers/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // Entegrasyon testleri geçici veritabanı kurduğu için varsayılan 5sn yetmez.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
