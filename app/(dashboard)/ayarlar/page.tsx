import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

export const metadata: Metadata = { title: "Ayarlar · Muhasebe" };

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Ayarlar" description="Kullanıcılar ve yetkilendirme." />
      <PhasePlaceholder faz="Faz 8 — RBAC ince ayarları" />
    </div>
  );
}
