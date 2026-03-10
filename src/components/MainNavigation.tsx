"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/src/components/ui/button";
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
          <Button
            key={item.href}
            asChild
            size="sm"
            variant="ghost"
            className={cn("text-sm", isActive && "bg-accent text-accent-foreground")}
          >
            <Link href={item.href}>{item.label}</Link>
          </Button>
        );
      })}
    </nav>
  );
}
