import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

export const metadata: Metadata = { title: "Cariler · Muhasebe" };

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Cariler" description="Müşteri ve tedarikçi hesapları." />
      <PhasePlaceholder faz="Faz 1 — Cari Hesap Yönetimi" />
    </div>
  );
}
