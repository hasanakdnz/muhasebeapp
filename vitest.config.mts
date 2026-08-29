import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // `@/*` alias'ı tsconfig.json'dan okunur.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
