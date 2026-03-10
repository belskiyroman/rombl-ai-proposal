import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Inter } from "next/font/google";

import { ConvexClientProvider } from "@/app/convex-client-provider";
import { MainNavigation } from "@/src/components/MainNavigation";
import { Toaster } from "@/src/components/ui/toaster";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rombl AI Proposal",
  description: "Structured Proposal Engine — grounded proposal generation with case library and evidence retrieval"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ConvexClientProvider>
          <div className="min-h-screen bg-background">
            {/* Gradient accent bar */}
            <div className="h-[2px] w-full bg-gradient-primary" />

            <header className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl sticky top-0 z-50">
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
                <Link href="/pairs" className="flex items-center gap-3 group transition-all duration-300">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-sm font-bold text-white shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
                    R
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-tight text-foreground">Structured Proposal Engine</p>
                    <p className="text-[11px] text-muted-foreground">Grounded case library + evidence-driven generation</p>
                  </div>
                </Link>
                <MainNavigation />
              </div>
            </header>
            {children}
          </div>
          <Toaster />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
