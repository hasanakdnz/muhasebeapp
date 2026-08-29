import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

export const metadata: Metadata = { title: "Çek & Senet · Muhasebe" };

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Çek & Senet" description="Portföy ve tahsilat durumu." />
      <PhasePlaceholder faz="Faz 4 — Çek/Senet Yönetimi" />
    </div>
  );
}
