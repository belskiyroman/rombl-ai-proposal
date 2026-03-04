import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

import { ConvexClientProvider } from "@/app/convex-client-provider";
import { Toaster } from "sonner";
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
          {children}
          <Toaster richColors position="top-right" />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
