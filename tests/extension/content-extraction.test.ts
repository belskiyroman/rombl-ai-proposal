// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  captureUpworkProposalPage,
  fullDescriptionCaptureErrorMessage
} from "@/chrome-extension/src/content-extraction";

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("content extraction", () => {
  it("captures proposal pages without a truncation control", async () => {
    const doc = parseHtml(`
      <html>
        <head><title>Submit a Proposal - Upwork</title></head>
        <body>
          <div class="fe-job-details">
            <div class="content">
              <h3 class="h5">Senior Next.js Engineer</h3>
              <div class="description">
                We need a senior engineer to own the architecture, delivery, and integrations for a production SaaS dashboard.
              </div>
              <a data-test="open-original-posting" href="/jobs/~01">View job posting</a>
            </div>
            <div class="sidebar"><small>Hourly</small></div>
          </div>
        </body>
      </html>
    `);

    const result = await captureUpworkProposalPage({
      url: "https://www.upwork.com/nx/proposals/job/~01/apply/",
      pageTitle: "Submit a Proposal - Upwork",
      doc
    });

    expect(result?.jobTitle).toBe("Senior Next.js Engineer");
    expect(result?.jobDescription).toContain("production SaaS dashboard");
  });

  it("expands truncated proposal descriptions before capture", async () => {
    const doc = parseHtml(`
      <html>
        <head><title>Submit a Proposal - Upwork</title></head>
        <body>
          <div class="fe-job-details">
            <div class="content">
              <h3 class="h5">Senior Next.js Engineer</h3>
              <div class="description">
                <span class="air3-truncation">
                  <span id="air3-truncation-1">Short summary only…</span>
                  <span class="air3-truncation-labels">
                    <button
                      aria-expanded="false"
                      aria-controls="air3-truncation-1"
                      type="button"
                      class="air3-truncation-btn"
                    >
                      <span>more</span>
                    </button>
                  </span>
                </span>
              </div>
              <a data-test="open-original-posting" href="/jobs/~01">View job posting</a>
            </div>
            <div class="sidebar"><small>Hourly</small></div>
          </div>
        </body>
      </html>
    `);

    const toggle = doc.querySelector<HTMLButtonElement>(".air3-truncation-btn");
    const textNode = doc.getElementById("air3-truncation-1");
    toggle?.addEventListener("click", () => {
      toggle.setAttribute("aria-expanded", "true");
      if (textNode) {
        textNode.textContent =
          "We need a senior engineer to own the architecture, delivery, and integrations for a production SaaS dashboard.";
      }
    });

    const result = await captureUpworkProposalPage({
      url: "https://www.upwork.com/nx/proposals/job/~01/apply/",
      pageTitle: "Submit a Proposal - Upwork",
      doc,
      timeoutMs: 50,
      pollIntervalMs: 1
    });

    expect(result?.jobDescription).toContain("production SaaS dashboard");
    expect(result?.jobDescription).not.toContain("more");
  });

  it("fails capture when a truncated description cannot be expanded", async () => {
    const doc = parseHtml(`
      <html>
        <head><title>Submit a Proposal - Upwork</title></head>
        <body>
          <div class="fe-job-details">
            <div class="content">
              <h3 class="h5">Senior Next.js Engineer</h3>
              <div class="description">
                <span class="air3-truncation">
                  <span id="air3-truncation-1">Short summary only…</span>
                  <span class="air3-truncation-labels">
                    <button
                      aria-expanded="false"
                      aria-controls="air3-truncation-1"
                      type="button"
                      class="air3-truncation-btn"
                    >
                      <span>more</span>
                    </button>
                  </span>
                </span>
              </div>
              <a data-test="open-original-posting" href="/jobs/~01">View job posting</a>
            </div>
            <div class="sidebar"><small>Hourly</small></div>
          </div>
        </body>
      </html>
    `);

    await expect(
      captureUpworkProposalPage({
        url: "https://www.upwork.com/nx/proposals/job/~01/apply/",
        pageTitle: "Submit a Proposal - Upwork",
        doc,
        timeoutMs: 10,
        pollIntervalMs: 1
      })
    ).rejects.toThrow(fullDescriptionCaptureErrorMessage);
  });
});
