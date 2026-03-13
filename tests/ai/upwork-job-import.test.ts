// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { extractUpworkJobPageSnapshot, isUpworkJobUrl } from "@/src/lib/job-import/upwork";

const SAMPLE_PROPOSAL_HTML = `
  <html>
    <head>
      <title>Submit a Proposal - Upwork</title>
    </head>
    <body>
      <h1>Submit a Proposal</h1>
      <div class="fe-proposal-settings">
        <div class="air3-token">Remaining balance: 40 Connects</div>
      </div>
      <div class="fe-job-details">
        <section class="air3-card-section">
          <div class="content">
            <h2>Job details</h2>
            <h3 class="h5">Full-Stack Developer for Innovative Medical Application</h3>
            <ul class="list-inline">
              <li><div class="air3-token text-body-sm mb-0">Full Stack Development</div></li>
            </ul>
            <div class="description text-body-sm">
              <span class="air3-truncation">
                <span tabindex="-1">
                  <span id="air3-truncation-1">
                    We are seeking 2 talented Full-Stack Developers to join our team and help build and maintain a cutting-edge medical application designed for healthcare professionals. You will be responsible for both front-end and back-end development of multiple healthcare related projects, ensuring the application supports complex workflows and secure integrations.
                  </span>
                </span>
                <span class="air3-truncation-labels">
                  <button aria-expanded="true" aria-controls="air3-truncation-1" type="button" class="air3-truncation-btn">
                    <span>less</span>
                  </button>
                </span>
              </span>
            </div>
            <a data-test="open-original-posting" href="/jobs/~022032420924356894371" target="_blank">
              View job posting
            </a>
          </div>
          <div class="sidebar">
            <small>Hourly range</small>
            <strong>$50.00 - $70.00</strong>
            <small>Hourly</small>
          </div>
        </section>
      </div>
      <div class="fe-proposal-boost-proposal">
        <div class="air3-token">80 Connects</div>
      </div>
    </body>
  </html>
`;

describe("Upwork job import helpers", () => {
  it("detects supported Upwork Submit Proposal URLs only", () => {
    expect(isUpworkJobUrl("https://www.upwork.com/nx/proposals/job/~022032420924356894371/apply/")).toBe(true);
    expect(isUpworkJobUrl("https://www.upwork.com/freelance-jobs/apply/Example_~01/")).toBe(false);
    expect(isUpworkJobUrl("https://www.upwork.com/jobs/~022032420924356894371")).toBe(false);
    expect(isUpworkJobUrl("https://example.com/jobs/123")).toBe(false);
  });

  it("extracts a reusable proposal-page snapshot for the extension", () => {
    const result = extractUpworkJobPageSnapshot({
      url: "https://www.upwork.com/nx/proposals/job/~022032420924356894371/apply/",
      pageTitle: "Submit a Proposal - Upwork",
      html: SAMPLE_PROPOSAL_HTML
    });

    expect(result).not.toBeNull();
    expect(result?.jobTitle).toBe("Full-Stack Developer for Innovative Medical Application");
    expect(result?.jobDescription).toContain("cutting-edge medical application");
    expect(result?.jobDescription).not.toContain("less");
    expect(result?.sourceUrl).toBe("https://www.upwork.com/jobs/~022032420924356894371");
    expect(result?.metadata.skillsCount).toBe(1);
    expect(result?.metadata.projectType).toBe("hourly");
  });

  it("rejects proposal pages without a usable description", () => {
    const result = extractUpworkJobPageSnapshot({
      url: "https://www.upwork.com/nx/proposals/job/~022032420924356894371/apply/",
      pageTitle: "Submit a Proposal - Upwork",
      html: `
        <html>
          <body>
            <div class="fe-job-details">
              <div class="content">
                <h3 class="h5">Short page</h3>
              </div>
            </div>
          </body>
        </html>
      `
    });

    expect(result).toBeNull();
  });
});
