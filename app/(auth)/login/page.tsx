import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş · Muhasebe" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center p-container">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="text-heading-lg text-ink">Muhasebe</h1>
          <p className="text-body-md text-muted">
            Devam etmek için hesabınıza giriş yapın.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
