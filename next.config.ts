import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Fiş/dekont yüklemesi server action üzerinden gider; varsayılan 1 MB
      // limiti 10 MB'lık belgeyi reddederdi (bkz. lib/storage.ts).
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
