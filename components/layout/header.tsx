import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/generated/prisma/enums";

const ROL_ETIKETI: Record<Role, string> = {
  ADMIN: "Yönetici",
  PERSONEL: "Personel",
};

export function Header({
  user,
}: {
  user: { name?: string | null; email?: string | null; role: Role };
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-4 border-b border-border px-container">
      <div className="flex items-center gap-3">
        <span className="text-body-md text-ink">
          {user.name ?? user.email}
        </span>
        <Badge variant="neutral">{ROL_ETIKETI[user.role]}</Badge>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button variant="text" type="submit" aria-label="Oturumu kapat">
          <LogOut />
          Çıkış
        </Button>
      </form>
    </header>
  );
}
