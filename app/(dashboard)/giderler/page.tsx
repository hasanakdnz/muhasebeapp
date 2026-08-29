import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

export const metadata: Metadata = { title: "Giderler · Muhasebe" };

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Giderler" description="Masraf kayıtları ve kategoriler." />
      <PhasePlaceholder faz="Faz 5 — Masraf Yönetimi" />
    </div>
  );
}
