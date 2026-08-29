import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { FirmaForm } from "@/components/ayarlar/firma-form";
import { firmaGetir } from "@/lib/firma";
import { removeLogo, saveFirma } from "./actions";

export const metadata: Metadata = { title: "Ayarlar · Muhasebe" };

/**
 * Firma künyesi. Yalnızca yönetici erişir (middleware + lib/rbac.ts).
 * Buradaki bilgiler proforma/teklif çıktısının başlığını oluşturur.
 */
export default async function Page() {
  const firma = await firmaGetir();

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        title="Ayarlar"
        description="Firma bilgileri ve teklif çıktısında görünen künye."
      />

      <FirmaForm
        defaultValues={{
          unvan: firma.unvan,
          vknTckn: firma.vknTckn ?? "",
          vergiDairesi: firma.vergiDairesi ?? "",
          adres: firma.adres ?? "",
          telefon: firma.telefon ?? "",
          email: firma.email ?? "",
          iban: firma.iban ?? "",
        }}
        logoUrl={firma.logoUrl}
        logoAdi={firma.logoAdi}
        onSubmitAction={saveFirma}
        onRemoveLogoAction={removeLogo}
      />
    </div>
  );
}
