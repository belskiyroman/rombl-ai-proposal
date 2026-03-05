import { describe, expect, it } from "vitest";

import {
  MAX_JOB_DESCRIPTION_CHARS,
  normalizeJobDescription
} from "@/src/lib/ai/job-description-normalizer";

describe("normalizeJobDescription", () => {
  it("keeps plain text input semantically unchanged", () => {
    const input = "Need a React + Convex engineer for a marketplace MVP.";
    const result = normalizeJobDescription(input);

    expect(result.text).toBe(input);
    expect(result.metadata.wasHtml).toBe(false);
    expect(result.metadata.wasTruncated).toBe(false);
  });

  it("converts html input into readable text without tags or scripts", () => {
    const html = `
      <html>
        <head>
          <title>Senior React Developer</title>
          <script>window.__secret_payload = "do not leak";</script>
        </head>
        <body>
          <div data-test="Description">
            <p>Need React &amp; TypeScript engineer for dashboard delivery.</p>
          </div>
          <div>
            <span data-test="Skill">React</span>
            <span data-test="Skill">TypeScript</span>
          </div>
        </body>
      </html>
    `;

    const result = normalizeJobDescription(html);

    expect(result.metadata.wasHtml).toBe(true);
    expect(result.text).toContain("Senior React Developer");
    expect(result.text).toContain("Need React & TypeScript engineer");
    expect(result.text).not.toContain("do not leak");
    expect(result.text).not.toMatch(/<[^>]+>/);
  });

  it("removes massive script payloads when html is provided", () => {
    const payload = "x".repeat(8000);
    const html = `<html><head><script>${payload}</script></head><body><p>Backend API integration work.</p></body></html>`;

    const result = normalizeJobDescription(html);

    expect(result.text).toContain("Backend API integration work.");
    expect(result.text).not.toContain(payload);
  });

  it("auto-truncates overlong input and sets metadata", () => {
    const input = `Need delivery ${"x".repeat(MAX_JOB_DESCRIPTION_CHARS + 1000)}`;
    const result = normalizeJobDescription(input);

    expect(result.metadata.wasTruncated).toBe(true);
    expect(result.metadata.originalLength).toBe(input.length);
    expect(result.metadata.finalLength).toBe(MAX_JOB_DESCRIPTION_CHARS);
    expect(result.text.length).toBe(MAX_JOB_DESCRIPTION_CHARS);
  });
});
