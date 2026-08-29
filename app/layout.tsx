import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// DESIGN.md: tek yazı ailesi. Mono'nun tek gerekçesi işlevsel — finansal
// tablolarda basamak hizalaması. latin-ext, Türkçe karakterler (ğ ş ı İ ç ö ü)
// için gereklidir.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"], // Bold (700) bu sistemde kullanılmaz.
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Muhasebe",
  description: "KOBİ'ler için ön muhasebe ve finans takip uygulaması",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={`${plexSans.variable} ${plexMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
