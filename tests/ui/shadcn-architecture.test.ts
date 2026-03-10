import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = process.cwd();

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf-8");
}

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(workspaceRoot, relativePath));
}

describe("shadcn utility foundation", () => {
  it("provides src/lib/utils.ts with the cn helper", () => {
    expect(fileExists("src/lib/utils.ts")).toBe(true);
    const source = readFile("src/lib/utils.ts");

    expect(source).toContain('import { clsx, type ClassValue } from "clsx"');
    expect(source).toContain('import { twMerge } from "tailwind-merge"');
    expect(source).toContain("export function cn(...inputs: ClassValue[])");
  });

  it("keeps theme css variables in app/globals.css", () => {
    const source = readFile("app/globals.css");

    expect(source).toContain("--background:");
    expect(source).toContain("--foreground:");
    expect(source).toContain("--primary:");
    expect(source).toContain("--radius:");
  });
});

describe("shadcn wrapper scaffolding", () => {
  it("provides required UI wrappers under src/components/ui", () => {
    const requiredFiles = [
      "src/components/ui/button.tsx",
      "src/components/ui/input.tsx",
      "src/components/ui/textarea.tsx",
      "src/components/ui/card.tsx",
      "src/components/ui/badge.tsx",
      "src/components/ui/form.tsx",
      "src/components/ui/toast.tsx",
      "src/components/ui/toaster.tsx"
    ];

    for (const file of requiredFiles) {
      expect(fileExists(file), `${file} should exist`).toBe(true);
    }
  });
});

describe("candidate console UI", () => {
  it("uses shadcn forms, toast, and current ingestion actions without direct Radix imports", () => {
    expect(fileExists("src/components/IngestionForm.tsx")).toBe(true);
    const source = readFile("src/components/IngestionForm.tsx");

    expect(source).toContain('from "@/src/components/ui/form"');
    expect(source).toContain('from "@/src/hooks/use-toast"');
    expect(source).toContain("api.profiles.upsertCandidateProfile");
    expect(source).toContain("api.profiles.ingestCandidateEvidence");
    expect(source).toContain("api.cases.ingestHistoricalCase");
    expect(source).not.toContain("api.cases.backfillFromV1");
    expect(source).not.toContain("@radix-ui/react-");
  });

  it("renders candidate profile, evidence, and historical case modes", () => {
    const source = readFile("src/components/IngestionForm.tsx");

    expect(source).toContain("Candidate Console");
    expect(source).toContain("Candidate Profile");
    expect(source).toContain("Candidate Evidence");
    expect(source).toContain("Historical Case");
    expect(source).not.toContain("Backfill V1");
  });
});

describe("results and layout", () => {
  it("uses shadcn card/badge wrappers in ExtractionResults", () => {
    expect(fileExists("src/components/ExtractionResults.tsx")).toBe(true);
    const source = readFile("src/components/ExtractionResults.tsx");

    expect(source).toContain('from "@/src/components/ui/card"');
    expect(source).toContain('from "@/src/components/ui/badge"');
    expect(source).not.toContain("@radix-ui/react-");
  });

  it("mounts shadcn Toaster in root layout", () => {
    const layoutSource = readFile("app/layout.tsx");
    expect(layoutSource).toContain('from "@/src/components/ui/toaster"');
    expect(layoutSource).toContain("<Toaster />");
  });
});
