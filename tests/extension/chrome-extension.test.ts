import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildExtensionCandidatesApiUrl,
  buildExtensionGenerateApiUrl,
  buildExtensionGenerateStatusApiUrl,
  buildExtensionHandoffApiUrl,
  buildGenerationRunUrl,
  buildJobPreviewDescription,
  buildJobPreviewMeta,
  normalizeAppBaseUrl,
  toChromeOriginPermissionPattern
} from "@/chrome-extension/src/shared/helpers";

const workspaceRoot = process.cwd();

describe("chrome extension helpers", () => {
  it("normalizes configured app URLs and builds handoff endpoints", () => {
    expect(normalizeAppBaseUrl("https://app.example.com/generate")).toBe("https://app.example.com");
    expect(buildExtensionHandoffApiUrl("http://localhost:3000/anything")).toBe(
      "http://localhost:3000/api/extension/handoffs"
    );
    expect(buildExtensionCandidatesApiUrl("http://localhost:3000")).toBe("http://localhost:3000/api/extension/candidates");
    expect(buildExtensionGenerateApiUrl("http://localhost:3000")).toBe("http://localhost:3000/api/extension/generate");
    expect(buildExtensionGenerateStatusApiUrl("http://localhost:3000", "progress_1")).toBe(
      "http://localhost:3000/api/extension/generate/status?id=progress_1"
    );
    expect(buildGenerationRunUrl("http://localhost:3000", "run_1")).toBe("http://localhost:3000/generate/history/run_1");
    expect(toChromeOriginPermissionPattern("http://localhost:3000")).toBe("http://localhost:3000/*");
  });

  it("formats popup preview content", () => {
    const meta = buildJobPreviewMeta({
      sourceSite: "upwork",
      sourceUrl: "https://www.upwork.com/jobs/~01",
      pageTitle: "Senior Engineer - Upwork",
      jobTitle: "Senior Engineer",
      jobDescription: "Build a production system with strong ownership and a grounded proposal workflow.",
      capturedAt: 1000,
      parserMeta: {
        skillsCount: 4,
        projectType: "hourly"
      }
    });

    expect(meta).toContain("UPWORK");
    expect(meta).toContain("hourly");
    expect(meta).toContain("4 skills");
    expect(
      buildJobPreviewDescription({
        sourceSite: "upwork",
        sourceUrl: "https://www.upwork.com/jobs/~01",
        pageTitle: "Senior Engineer - Upwork",
        jobTitle: "Senior Engineer",
        jobDescription: "x".repeat(400),
        capturedAt: 1000,
        parserMeta: {
          skillsCount: 4,
          projectType: "hourly"
        }
      }).length
    ).toBeLessThanOrEqual(280);
  });
});

describe("chrome extension scaffold", () => {
  it("ships the expected MV3 files", () => {
    const manifestPath = path.join(workspaceRoot, "chrome-extension/manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
      manifest_version: number;
      action?: { default_popup?: string };
      options_page?: string;
      background?: { service_worker?: string };
      permissions?: string[];
      side_panel?: { default_path?: string };
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.action?.default_popup).toBeUndefined();
    expect(manifest.permissions).toContain("sidePanel");
    expect(manifest.side_panel?.default_path).toBe("sidepanel.html");
    expect(manifest.options_page).toBe("options.html");
    expect(manifest.background?.service_worker).toBe("background.js");
  });
});
