import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

import { ConvexClientProvider } from "@/app/convex-client-provider";
import { MainNavigation } from "@/src/components/MainNavigation";
import { Toaster } from "@/src/components/ui/toaster";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rombl AI Proposal",
  description: "ProposalGen MVP — RAG-based Proposal Generation System"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexClientProvider>
          <div className="min-h-screen bg-background">
            <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                    R
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-tight">ProposalGen MVP</p>
                    <p className="text-xs text-muted-foreground">Navigation</p>
                  </div>
                </div>
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
