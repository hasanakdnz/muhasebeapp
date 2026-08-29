import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // middleware zaten koruyor; burada ikinci kez doğrulanır çünkü sayfa
  // içerikleri session'a (rol) doğrudan bağımlı.
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar role={session.user.role} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header user={session.user} />
        {/* Sayfa geçişlerinde en fazla hafif bir fade (150ms) — DESIGN.md */}
        <main className="animate-page-in flex-1 p-container">{children}</main>
      </div>
    </div>
  );
}
