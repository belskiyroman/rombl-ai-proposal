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

describe("generation page routing + layout", () => {
  it("implements app/generate/page.tsx with search param parsing", () => {
    expect(fileExists("app/generate/page.tsx")).toBe(true);
    const source = readFile("app/generate/page.tsx");

    expect(source).toContain("searchParams");
    expect(source).toContain("contextId");
    expect(source).toContain("GenerationForm");
    expect(source).toContain("GeneratedResult");
  });
});

describe("generation form", () => {
  it("provides a strongly-typed GenerationForm using shadcn Form + Textarea", () => {
    expect(fileExists("src/components/GenerationForm.tsx")).toBe(true);
    const source = readFile("src/components/GenerationForm.tsx");

    expect(source).toContain("react-hook-form");
    expect(source).toContain("@hookform/resolvers/zod");
    expect(source).toContain("zodResolver");
    expect(source).toContain("api.generate.createProposal");
    expect(source).toContain('from "@/src/components/ui/form"');
    expect(source).toContain("<FormField");
    expect(source).toContain("<Textarea");
    expect(source).toContain("Generate Proposal");
    expect(source).toContain("Context Locked: Job #");
    expect(source).toContain("Profile");
    expect(source).toContain("Auto (Latest)");
    expect(source).toContain("api.members.listMembers");
  });

  it("shows long-running agent workflow loading message", () => {
    const source = readFile("src/components/GenerationForm.tsx");

    expect(source).toContain("Agents are working");
    expect(source).toContain("Retrieving Context");
    expect(source).toContain("Drafting");
    expect(source).toContain("Reviewing");
    expect(source).toContain("<Skeleton");
  });
});

describe("generated result", () => {
  it("implements editable output + copy-to-clipboard with toast", () => {
    expect(fileExists("src/components/GeneratedResult.tsx")).toBe(true);
    const source = readFile("src/components/GeneratedResult.tsx");

    expect(source).toContain("<Textarea");
    expect(source).toContain("navigator.clipboard.writeText");
    expect(source).toContain("Copy to Clipboard");
    expect(source).toContain("useToast");
  });
});
