"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Tarayıcının yazdırma penceresini açar; oradan "PDF olarak kaydet" seçilir. */
export function YazdirButonu() {
  return (
    <Button onClick={() => window.print()}>
      <Printer />
      Yazdır
    </Button>
  );
}
