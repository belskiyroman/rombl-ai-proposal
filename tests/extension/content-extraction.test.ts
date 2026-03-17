// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  captureUpworkProposalPage,
  fillProposalSubmission,
  fillProposalCoverLetter,
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
          <div class="questions-area">
            <div class="form-group">
              <label class="label">Include a link to your GitHub profile and/or website</label>
              <textarea></textarea>
            </div>
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
    expect(result?.proposalQuestions).toEqual([
      {
        position: 1,
        prompt: "Include a link to your GitHub profile and/or website"
      }
    ]);
  });

  it("waits for a proposal page that finishes rendering after capture starts", async () => {
    const doc = parseHtml(`
      <html>
        <head><title>Submit a Proposal - Upwork</title></head>
        <body></body>
      </html>
    `);

    window.setTimeout(() => {
      doc.body.innerHTML = `
        <div class="fe-job-details">
          <div class="content">
            <h3 class="h5">AI Developer Needed for Custom CRM System</h3>
            <div class="description text-body-sm">
              <span class="air3-truncation is-expanded">
                <span tabindex="-1">
                  <span id="air3-truncation-1">
                    We are seeking an experienced AI developer to help us create a customized CRM system tailored to our business needs. The ideal candidate will have a strong background in artificial intelligence, software development, and CRM systems.
                  </span>
                </span>
                <span class="air3-truncation-labels">
                  <button aria-expanded="true" aria-controls="air3-truncation-1" type="button" class="air3-truncation-btn">
                    <span>less</span>
                  </button>
                </span>
              </span>
            </div>
            <a data-test="open-original-posting" href="/jobs/~022033587657732197097">View job posting</a>
          </div>
          <div class="sidebar"><small>Hourly</small></div>
        </div>
        <div class="questions-area">
          <div class="form-group">
            <label class="label">Describe your recent experience with similar projects</label>
            <textarea></textarea>
          </div>
          <div class="form-group">
            <label class="label">Include a link to your GitHub profile and/or website</label>
            <textarea></textarea>
          </div>
        </div>
      `;
    }, 5);

    const result = await captureUpworkProposalPage({
      url: "https://www.upwork.com/nx/proposals/job/~022033587657732197097/apply/",
      pageTitle: "Submit a Proposal - Upwork",
      doc,
      timeoutMs: 100,
      pollIntervalMs: 1
    });

    expect(result?.jobTitle).toBe("AI Developer Needed for Custom CRM System");
    expect(result?.jobDescription).toContain("customized CRM system");
    expect(result?.proposalQuestions).toEqual([
      {
        position: 1,
        prompt: "Describe your recent experience with similar projects"
      },
      {
        position: 2,
        prompt: "Include a link to your GitHub profile and/or website"
      }
    ]);
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

  it("fills the proposal cover letter textarea and emits input events", () => {
    const doc = parseHtml(`
      <html>
        <body>
          <div class="form-group">
            <label id="cover_letter_label" class="label">Cover Letter</label>
            <div class="air3-textarea textarea-wrapper p-0">
              <textarea
                rows="10"
                aria-labelledby="cover_letter_label"
                class="air3-textarea inner-textarea"
              ></textarea>
            </div>
          </div>
        </body>
      </html>
    `);

    const textarea = doc.querySelector<HTMLTextAreaElement>("textarea");
    let inputEvents = 0;
    let changeEvents = 0;
    textarea?.addEventListener("input", () => {
      inputEvents += 1;
    });
    textarea?.addEventListener("change", () => {
      changeEvents += 1;
    });

    fillProposalCoverLetter(doc, "Grounded cover letter text");

    expect(textarea?.value).toBe("Grounded cover letter text");
    expect(inputEvents).toBe(1);
    expect(changeEvents).toBe(1);
  });

  it("fills the cover letter and proposal questions in order, leaving unresolved prompts blank", () => {
    const doc = parseHtml(`
      <html>
        <body>
          <div class="form-group">
            <label id="cover_letter_label" class="label">Cover Letter</label>
            <div class="air3-textarea textarea-wrapper p-0">
              <textarea rows="10" aria-labelledby="cover_letter_label" class="air3-textarea inner-textarea"></textarea>
            </div>
          </div>
          <div class="questions-area">
            <div class="form-group">
              <label class="label">GitHub</label>
              <textarea></textarea>
            </div>
            <div class="form-group">
              <label class="label">Expected hourly rate</label>
              <textarea></textarea>
            </div>
          </div>
        </body>
      </html>
    `);

    const textareas = doc.querySelectorAll<HTMLTextAreaElement>("textarea");
    fillProposalSubmission(doc, {
      coverLetter: "Grounded cover letter text",
      questionAnswers: [
        {
          position: 1,
          prompt: "GitHub",
          answer: "https://github.com/example"
        }
      ],
      unresolvedQuestions: [
        {
          position: 2,
          prompt: "Expected hourly rate",
          reason: "No grounded rate data is available."
        }
      ]
    });

    expect(textareas[0]?.value).toBe("Grounded cover letter text");
    expect(textareas[1]?.value).toBe("https://github.com/example");
    expect(textareas[2]?.value).toBe("");
  });

  it("fails when the proposal cover letter field is missing", () => {
    const doc = parseHtml("<html><body></body></html>");

    expect(() => fillProposalCoverLetter(doc, "Grounded cover letter text")).toThrow(
      "Could not find the Upwork cover letter field on this proposal page."
    );
  });
});
