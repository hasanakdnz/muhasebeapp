import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

export const metadata: Metadata = { title: "Raporlar · Muhasebe" };

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Raporlar" description="KDV, yaşlandırma ve ekstre raporları." />
      <PhasePlaceholder faz="Faz 7 — Raporlar" />
    </div>
  );
}
