import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  ScrollText,
  Settings,
  TrendingDown,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Yetki politikası lib/rbac.ts ile aynı yeri işaret eder. */
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/cariler", label: "Cariler", icon: Users },
  { href: "/islemler", label: "İşlemler", icon: ArrowLeftRight },
  { href: "/kasa-banka", label: "Kasa & Banka", icon: Wallet },
  { href: "/cek-senet", label: "Çek & Senet", icon: ScrollText },
  { href: "/giderler", label: "Giderler", icon: TrendingDown },
  { href: "/raporlar", label: "Raporlar", icon: BarChart3 },
  { href: "/ayarlar", label: "Ayarlar", icon: Settings, adminOnly: true },
];
