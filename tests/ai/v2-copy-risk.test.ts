import { describe, expect, it } from "vitest";

import { assessCopyRisk } from "@/src/lib/ai/v2/copy-risk";

describe("assessCopyRisk", () => {
  it("flags a draft that is too close to a retrieved fragment", () => {
    const result = assessCopyRisk(
      "I have built SaaS MVPs with Next.js and Node.js and can own architecture from day one.",
      [
        {
          id: "fragment-1",
          type: "fragment",
          text: "I have built SaaS MVPs with Next.js and Node.js and can own architecture from day one."
        }
      ]
    );

    expect(result.triggered).toBe(true);
    expect(result.matchedFragmentIds).toContain("fragment-1");
  });

  it("allows a sufficiently distinct draft", () => {
    const result = assessCopyRisk("I can help turn the current scope into an execution plan and build path.", [
      {
        id: "case-1",
        type: "case",
        text: "We built a health-tech dashboard with strict HIPAA controls."
      }
    ]);

    expect(result.triggered).toBe(false);
  });
});
