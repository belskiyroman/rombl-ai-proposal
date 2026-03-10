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
  it("renders the grounded generator page with GenerationForm and GeneratedResult", () => {
    expect(fileExists("app/generate/page.tsx")).toBe(true);
    const source = readFile("app/generate/page.tsx");

    expect(source).toContain("Grounded Generator");
    expect(source).toContain("GenerationForm");
    expect(source).toContain("GeneratedResult");
  });
});

describe("generation form", () => {
  it("uses V2 generation action and candidate profile query", () => {
    expect(fileExists("src/components/GenerationForm.tsx")).toBe(true);
    const source = readFile("src/components/GenerationForm.tsx");

    expect(source).toContain("react-hook-form");
    expect(source).toContain("zodResolver");
    expect(source).toContain("api.generate.createProposalV2");
    expect(source).toContain("api.profiles.listCandidateProfiles");
    expect(source).toContain("<FormField");
    expect(source).toContain("<Textarea");
    expect(source).toContain("Generate Proposal V2");
    expect(source).toContain("Candidate ID");
  });
});

describe("generated result", () => {
  it("surfaces selected evidence, proposal plan, and evaluator details", () => {
    expect(fileExists("src/components/GeneratedResult.tsx")).toBe(true);
    const source = readFile("src/components/GeneratedResult.tsx");

    expect(source).toContain("Selected Evidence");
    expect(source).toContain("Proposal Plan");
    expect(source).toContain("Evaluator");
    expect(source).toContain("navigator.clipboard.writeText");
  });
});
