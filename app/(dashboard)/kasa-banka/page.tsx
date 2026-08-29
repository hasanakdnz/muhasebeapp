import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PhasePlaceholder } from "@/components/layout/phase-placeholder";

export const metadata: Metadata = { title: "Kasa & Banka · Muhasebe" };

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Kasa & Banka" description="Hesap tanımları ve hareketler." />
      <PhasePlaceholder faz="Faz 2 — Kasa/Banka Temel Takip" />
    </div>
  );
}
