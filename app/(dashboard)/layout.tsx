import { redirect } from "next/navigation";
import { gecerliKullanici } from "@/lib/auth-guards";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // middleware zaten koruyor; burada ikinci kez doğrulanır çünkü sayfa
  // içerikleri role doğrudan bağımlı. Rol JWT'den DEĞİL veritabanından
  // okunur: silinen ya da yetkisi düşürülen kullanıcı eski token'la
  // gezinmeye devam edemesin (bkz. lib/auth-guards.ts).
  const kullanici = await gecerliKullanici();
  if (!kullanici) redirect("/login");

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar role={kullanici.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header user={kullanici} />
        {/* Sayfa geçişlerinde en fazla hafif bir fade (150ms) — DESIGN.md */}
        <main className="animate-page-in flex-1 p-container">{children}</main>
      </div>
    </div>
  );
}
