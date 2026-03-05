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
  it("adds top-level navigation links in root layout", () => {
    expect(fileExists("app/layout.tsx")).toBe(true);
    expect(fileExists("src/components/MainNavigation.tsx")).toBe(true);

    const layoutSource = readFile("app/layout.tsx");
    const navSource = readFile("src/components/MainNavigation.tsx");

    expect(layoutSource).toContain("MainNavigation");
    expect(navSource).toContain('"/pairs"');
    expect(navSource).toContain('"/ingest"');
    expect(navSource).toContain('"/generate"');
    expect(navSource).toContain('variant="ghost"');
  });
});

describe("pairs list UI foundation", () => {
  it("provides shadcn table + skeleton wrappers", () => {
    expect(fileExists("src/components/ui/table.tsx")).toBe(true);
    expect(fileExists("src/components/ui/skeleton.tsx")).toBe(true);
  });

  it("implements pairs page with query, loading, empty, and row actions", () => {
    expect(fileExists("app/pairs/page.tsx")).toBe(true);
    const source = readFile("app/pairs/page.tsx");

    expect(source).toContain('useQuery(api.jobs.getPairs');
    expect(source).toContain("<Skeleton");
    expect(source).toContain("<Table");
    expect(source).toContain("<Badge");
    expect(source).toContain("No pairs ingested yet");
    expect(source).toContain('href="/ingest"');
    expect(source).toContain("/generate?contextId=");
    expect(source).toContain("Generate from this");
  });

  it("provides generator placeholder page route", () => {
    expect(fileExists("app/generate/page.tsx")).toBe(true);
    const source = readFile("app/generate/page.tsx");
    expect(source).toContain("Generator");
  });
});
