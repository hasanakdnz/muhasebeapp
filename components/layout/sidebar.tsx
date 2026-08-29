"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/navigation";
import type { Role } from "@/lib/generated/prisma/enums";

/**
 * DESIGN.md "Sidebar":
 * 232px, açık (`paper`) zemin — koyu blok değil. Ayrım için sağında tek border.
 * Aktif öğe `surface-muted` zeminle hafifçe vurgulanır ve DESIGN.md'nin
 * "Seçili anlar" listesindeki gibi vurgu bir öğeden diğerine KAYARAK hareket
 * eder (kaybolup yeniden belirmez), `base` (200ms) süresinde.
 */
export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = React.useMemo(
    () => NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN"),
    [role]
  );

  const activeIndex = items.findIndex(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  const listRef = React.useRef<HTMLUListElement>(null);
  const [indicator, setIndicator] = React.useState<{
    top: number;
    height: number;
  } | null>(null);
  // İlk ölçümde kaydırma animasyonu çalışmasın — gösterge doğrudan yerinde belirir.
  const [settled, setSettled] = React.useState(false);

  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || activeIndex < 0) {
      setIndicator(null);
      return;
    }
    // children[] yerine açıkça <li> seçilir: listeye ileride başka bir düğüm
    // eklenirse ölçüm bir satır kaymasın.
    const el = list.querySelectorAll(":scope > li")[activeIndex];
    if (!(el instanceof HTMLElement)) return;
    setIndicator({ top: el.offsetTop, height: el.offsetHeight });
  }, [activeIndex, items.length]);

  React.useEffect(() => {
    if (indicator && !settled) {
      const id = requestAnimationFrame(() => setSettled(true));
      return () => cancelAnimationFrame(id);
    }
  }, [indicator, settled]);

  return (
    // sticky + self-start: flex kabında `align-items: stretch` yüksekliği
    // içeriğe eşitler ve sticky'nin kayacağı alan kalmazdı. Uzun ekstre/tablo
    // sayfalarında gezinme görünürden çıkmamalı.
    <aside className="sticky top-0 h-screen w-sidebar shrink-0 self-start overflow-y-auto border-r border-border bg-paper">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="px-6 py-8">
          <span className="text-heading-md text-ink">Muhasebe</span>
        </div>

        <nav className="px-3" aria-label="Ana menü">
          {/* Gösterge <ul> DIŞINDA durur: <ul> içinde <div> geçersiz HTML'dir
              ve listeyi kirletip <li> ölçümünü kaydırır. */}
          <div className="relative">
            {indicator && (
              <div
                aria-hidden
                className={cn(
                  "absolute inset-x-0 top-0 rounded-app bg-surface-muted",
                  settled &&
                    "transition-[transform,height] duration-200 ease-enter"
                )}
                style={{
                  transform: `translateY(${indicator.top}px)`,
                  height: `${indicator.height}px`,
                }}
              />
            )}

            <ul ref={listRef}>
              {items.map((item, index) => {
                const Icon = item.icon;
                const isActive = index === activeIndex;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-app px-3 py-2.5",
                        "text-body-md transition-colors duration-120 ease-enter",
                        isActive
                          ? "font-medium text-ink"
                          : "text-muted hover:text-ink"
                      )}
                    >
                      <Icon className="size-[18px] shrink-0 stroke-[1.5]" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </div>
    </aside>
  );
}
