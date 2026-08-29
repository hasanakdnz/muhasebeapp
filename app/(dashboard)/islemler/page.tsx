import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

export const metadata: Metadata = { title: "İşlemler · Muhasebe" };

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="İşlemler" description="Satış ve alış kayıtları." />
      <PhasePlaceholder faz="Faz 3 — Satış/Alış İşlemleri" />
    </div>
  );
}
