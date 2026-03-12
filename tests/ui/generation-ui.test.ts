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
    expect(source).toContain("/generate/history");
    expect(source).toContain("GenerationForm");
    expect(source).toContain("GeneratedResult");
  });

  it("adds dedicated saved-run history routes", () => {
    expect(fileExists("app/generate/history/page.tsx")).toBe(true);
    expect(fileExists("app/generate/history/[id]/page.tsx")).toBe(true);

    const listSource = readFile("app/generate/history/page.tsx");
    const detailSource = readFile("app/generate/history/[id]/page.tsx");

    expect(listSource).toContain("api.runs.listGenerationRuns");
    expect(listSource).toContain("Saved Proposal Runs");
    expect(detailSource).toContain("api.runs.getGenerationRun");
    expect(detailSource).toContain("Saved Run Detail");
  });
});

describe("generation form", () => {
  it("uses the generation action, progress session, and candidate profile query", () => {
    expect(fileExists("src/components/GenerationForm.tsx")).toBe(true);
    expect(fileExists("src/components/GenerationProgressCard.tsx")).toBe(true);
    const source = readFile("src/components/GenerationForm.tsx");
    const progressSource = readFile("src/components/GenerationProgressCard.tsx");

    expect(source).toContain("react-hook-form");
    expect(source).toContain("zodResolver");
    expect(source).toContain("api.generate.createProposal");
    expect(source).toContain("api.generate.createGenerationProgress");
    expect(source).toContain("api.generate.getGenerationProgress");
    expect(source).toContain("api.profiles.listCandidateProfiles");
    expect(source).toContain("GenerationProgressCard");
    expect(source).toContain("<FormField");
    expect(source).toContain("<Textarea");
    expect(source).toContain("Generate Proposal");
    expect(source).toContain("Candidate ID");
    expect(progressSource).toContain("Generation Progress");
    expect(progressSource).toContain("proposalEngineStepOrder");
    expect(progressSource).toContain("Open Saved Run");
  });
});

describe("generated result", () => {
  it("uses the shared snapshot renderer for live and saved views", () => {
    expect(fileExists("src/components/GeneratedResult.tsx")).toBe(true);
    expect(fileExists("src/components/GenerationSnapshotView.tsx")).toBe(true);

    const wrapperSource = readFile("src/components/GeneratedResult.tsx");
    const source = readFile("src/components/GenerationSnapshotView.tsx");

    expect(wrapperSource).toContain("GenerationSnapshotView");
    expect(source).toContain("Selected Evidence");
    expect(source).toContain("Proposal Plan");
    expect(source).toContain("Evaluator");
    expect(source).toContain("Execution Trace");
    expect(source).toContain("Telemetry");
    expect(source).toContain("Exact per-step timing and token usage");
    expect(source).toContain("Evidence Candidates");
    expect(source).toContain("navigator.clipboard.writeText");
  });
});
