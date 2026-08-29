"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PDF dışa aktarım, ayrı bir PDF kütüphanesi yerine tarayıcının baskı
 * çıktısıyla yapılır (bkz. app/globals.css @media print). Çıktı DESIGN.md
 * tipografisini korur ve ekran öğeleri gizlenir.
 */
export function YazdirButonu() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer />
      PDF / Yazdır
    </Button>
  );
}
