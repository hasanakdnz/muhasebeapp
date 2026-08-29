import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

export const metadata: Metadata = { title: "Genel Bakış · Muhasebe" };

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Genel Bakış"
        description="Kasa, banka, alacak ve borç özetiniz."
      />
      <PhasePlaceholder faz="Faz 3 — Satış/Alış İşlemleri + Dashboard" />
    </div>
  );
}
