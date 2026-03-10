"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/src/lib/utils";

const navigationItems = [
  { href: "/pairs", label: "Library" },
  { href: "/ingest", label: "Candidates" },
  { href: "/generate", label: "Generate" }
] as const;

export function MainNavigation() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1" aria-label="Main">
      {navigationItems.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
              isActive
                ? "text-primary bg-primary/10 shadow-sm shadow-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            )}
          >
            {item.label}
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
