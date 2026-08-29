import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FileText, Landmark, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Raporlar · Muhasebe" };

const RAPORLAR = [
  {
    href: "/raporlar/kdv",
    baslik: "KDV raporu",
    aciklama:
      "Hesaplanan ve indirilecek KDV, ödenecek veya devreden tutar. Alışlar ve giderler birlikte.",
    icon: Receipt,
  },
  {
    href: "/raporlar/yaslandirma",
    baslik: "Yaşlandırma raporu",
    aciklama:
      "Açık faturaların vadeye göre 0-30 / 31-60 / 60+ gün kovalarına dağılımı.",
    icon: FileText,
  },
  {
    href: "/raporlar/ekstre",
    baslik: "Kasa / Banka ekstresi",
    aciklama: "Seçilen hesabın dönem içi hareketleri ve yürüyen bakiyesi.",
    icon: Landmark,
  },
  {
    href: "/raporlar/satis",
    baslik: "Satış performansı",
    aciklama: "Dönemsel satış-alış, aylık kırılım ve en çok satış yapılan cariler.",
    icon: BarChart3,
  },
] as const;

export default function RaporlarPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Raporlar"
        description="Dönem seçip Excel'e aktarabilir veya PDF olarak yazdırabilirsiniz."
      />

      <div className="grid gap-6 sm:grid-cols-2">
        {RAPORLAR.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.href} href={r.href} className="group">
              <Card className="h-full transition-colors duration-120 ease-enter group-hover:bg-surface-muted">
                <div className="flex items-start gap-4">
                  <Icon className="mt-1 size-5 shrink-0 stroke-[1.5] text-muted" />
                  <div className="flex flex-col gap-1">
                    <CardTitle>{r.baslik}</CardTitle>
                    <p className="text-body-md text-muted">{r.aciklama}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
