import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";

import { ConvexClientProvider } from "@/app/convex-client-provider";
import { MainNavigation } from "@/src/components/MainNavigation";
import { Toaster } from "@/src/components/ui/toaster";
import "@/app/globals.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rombl AI Proposal",
  description: "Structured Proposal Engine — grounded proposal generation with case library and evidence retrieval"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.className}>
        <ConvexClientProvider>
          <div className="min-h-screen bg-background">
            <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
                <Link href="/pairs" className="flex items-center gap-3 transition-opacity hover:opacity-80">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                    R
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-tight">Structured Proposal Engine</p>
                    <p className="text-xs text-muted-foreground">Grounded case library + evidence-driven generation</p>
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
