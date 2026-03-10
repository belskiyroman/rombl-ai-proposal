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

describe("global navigation layout", () => {
  it("adds the library, candidate, and generate routes to navigation", () => {
    expect(fileExists("app/layout.tsx")).toBe(true);
    expect(fileExists("src/components/MainNavigation.tsx")).toBe(true);

    const layoutSource = readFile("app/layout.tsx");
    const navSource = readFile("src/components/MainNavigation.tsx");

    expect(layoutSource).toContain("Structured Proposal Engine");
    expect(navSource).toContain('"/pairs"');
    expect(navSource).toContain('"/ingest"');
    expect(navSource).toContain('"/generate"');
    expect(navSource).toContain("Library");
    expect(navSource).toContain("Candidates");
    expect(navSource).toContain("Generate");
  });
});

describe("library UI foundation", () => {
  it("keeps shadcn table + skeleton wrappers", () => {
    expect(fileExists("src/components/ui/table.tsx")).toBe(true);
    expect(fileExists("src/components/ui/skeleton.tsx")).toBe(true);
  });

  it("implements the canonical library page with CRUD-oriented management", () => {
    expect(fileExists("app/pairs/page.tsx")).toBe(true);
    const source = readFile("app/pairs/page.tsx");

    expect(source).toContain("api.profiles.listCandidateProfiles");
    expect(source).toContain("api.library.listCanonicalCases");
    expect(source).toContain("api.library.listClusters");
    expect(source).toContain("api.library.getHistoricalCaseDetail");
    expect(source).toContain("api.cases.deleteHistoricalCase");
    expect(source).toContain("Canonical Cases");
    expect(source).toContain("Duplicate Clusters");
    expect(source).toContain("New Historical Case");
    expect(source).toContain("Edit");
    expect(source).toContain("Delete");
    expect(source).toContain("<Badge");
  });

  it("keeps the generator route available from the app shell", () => {
    expect(fileExists("app/generate/page.tsx")).toBe(true);
    const source = readFile("app/generate/page.tsx");
    expect(source).toContain("Grounded Generator");
  });
});
