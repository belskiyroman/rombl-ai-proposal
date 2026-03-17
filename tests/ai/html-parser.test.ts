// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { parseUpworkJobHtml } from "@/src/lib/ai/html-parser";

// Minimal Upwork-like HTML fixtures for testing

const SAMPLE_HTML_FULL = `
<html>
<head>
    <title>B2B Saas Sales - Lead Generation &amp; Telemarketing</title>
</head>
<body>
    <div data-test="job-title">B2B Saas Sales - Lead Generation & Telemarketing</div>

    <div data-test="Description">
        <p>We are looking for a skilled B2B sales specialist to generate leads and conduct telemarketing campaigns for our SaaS product. The ideal candidate will have experience in cold calling, email outreach, and CRM management.</p>
    </div>

    <div class="skills-section">
        <span data-test="Skill">Lead Generation</span>
        <span data-test="Skill">Cold Calling</span>
        <span data-test="Skill">Telemarketing</span>
        <span data-test="Skill">B2B Sales</span>
        <span data-test="Skill">CRM</span>
    </div>

    <div class="project-details">
        <span>Fixed-price</span>
    </div>

    <div data-test="client-location">United States</div>

    <div data-test="client-rating">
        <span class="up-rating-text">4.8 of 5</span>
    </div>

    <span>(23 reviews)</span>
    <span>$50K+ total spent</span>
</body>
</html>
`;

const SAMPLE_HTML_HOURLY = `
<html>
<head><title>React Developer Needed - Upwork</title></head>
<body>
    <h4>React Developer Needed</h4>
    <div class="description">
        Build a React dashboard with charts and data tables.
    </div>
    <div class="skills">
        <span class="skill-badge">React</span>
        <span class="skill-badge">TypeScript</span>
        <span class="skill-badge">Tailwind CSS</span>
    </div>
    <span>Hourly</span>
    <div data-test="client-location">Ukraine</div>
    <span>(5 reviews)</span>
    <span>$1,234.56 spent</span>
</body>
</html>
`;

const SAMPLE_PROPOSAL_PAGE_HTML = `
<html>
<head><title>Submit a Proposal - Upwork</title></head>
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
                                We are seeking 2 talented Full-Stack Developers to join our team and help build and maintain a cutting-edge medical application designed for healthcare professionals.
                            </span>
                        </span>
                        <span class="air3-truncation-labels">
                            <button aria-expanded="true" aria-controls="air3-truncation-1" type="button" class="air3-truncation-btn">
                                <span>less</span>
                            </button>
                        </span>
                    </span>
                </div>
                <a data-test="open-original-posting" href="/jobs/~022032420924356894371">
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
    <div class="questions-area">
        <div class="form-group">
            <label class="label">Include a link to your GitHub profile and/or website</label>
            <textarea></textarea>
        </div>
    </div>
</body>
</html>
`;

const EMPTY_HTML = `<html><head></head><body></body></html>`;

describe("parseUpworkJobHtml", () => {
  describe("title extraction", () => {
    it("extracts title from data-test attribute", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_FULL);
      expect(result.title).toBe(
        "B2B Saas Sales - Lead Generation & Telemarketing",
      );
    });

    it("extracts title from <title> tag removing Upwork suffix", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_HOURLY);
      expect(result.title).toBe("React Developer Needed");
    });

    it("returns empty string for empty HTML", () => {
      const result = parseUpworkJobHtml(EMPTY_HTML);
      expect(result.title).toBe("");
    });
  });

  describe("description extraction", () => {
    it("extracts description from data-test='Description'", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_FULL);
      expect(result.text).toContain("B2B sales specialist");
      expect(result.text).toContain("CRM management");
    });

    it("extracts description from class-based selector", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_HOURLY);
      expect(result.text).toContain("React dashboard");
    });

    it("returns empty string for empty HTML", () => {
      const result = parseUpworkJobHtml(EMPTY_HTML);
      expect(result.text).toBe("");
    });
  });

  describe("proposal question extraction", () => {
    it("extracts ordered proposal questions from Submit Proposal pages", () => {
      const result = parseUpworkJobHtml(SAMPLE_PROPOSAL_PAGE_HTML);
      expect(result.proposalQuestions).toEqual([
        {
          position: 1,
          prompt: "Include a link to your GitHub profile and/or website"
        }
      ]);
    });
  });

  describe("skills extraction", () => {
    it("extracts skills from data-test='Skill' elements", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_FULL);
      expect(result.skills).toContain("Lead Generation");
      expect(result.skills).toContain("Cold Calling");
      expect(result.skills).toContain("B2B Sales");
      expect(result.skills.length).toBe(5);
    });

    it("extracts skills from class-based selectors", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_HOURLY);
      expect(result.skills).toContain("React");
      expect(result.skills).toContain("TypeScript");
      expect(result.skills).toContain("Tailwind CSS");
    });

    it("returns empty array for empty HTML", () => {
      const result = parseUpworkJobHtml(EMPTY_HTML);
      expect(result.skills).toEqual([]);
    });

    it("extracts individual skills from parent container (Upwork Air 3.0 pattern)", () => {
      const html = `<html><body>
                <div class="skills-list">
                    <h5>Skills and Expertise</h5>
                    <div class="air3-token-container">
                        <span class="air3-token">B2B Marketing</span>
                        <span class="air3-token">SaaS</span>
                        <span class="air3-token">Product Demonstration</span>
                        <span class="air3-token">Deal Closure</span>
                    </div>
                </div>
            </body></html>`;
      const result = parseUpworkJobHtml(html);
      expect(result.skills).toEqual([
        "B2B Marketing",
        "SaaS",
        "Product Demonstration",
        "Deal Closure",
      ]);
    });

    it("extracts skills from parent element with class*='skill' without concatenating", () => {
      const html = `<html><body>
                <div class="up-skill-wrapper">
                    <a class="up-skill-badge">React</a>
                    <a class="up-skill-badge">Node.js</a>
                    <a class="up-skill-badge">GraphQL</a>
                </div>
            </body></html>`;
      const result = parseUpworkJobHtml(html);
      expect(result.skills).toContain("React");
      expect(result.skills).toContain("Node.js");
      expect(result.skills).toContain("GraphQL");
      expect(result.skills.length).toBe(3);
    });
  });

  describe("project type extraction", () => {
    it("detects fixed-price project", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_FULL);
      expect(result.type).toBe("fixedPrice");
    });

    it("detects hourly project", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_HOURLY);
      expect(result.type).toBe("hourly");
    });

    it("defaults to fixedPrice for empty HTML", () => {
      const result = parseUpworkJobHtml(EMPTY_HTML);
      expect(result.type).toBe("fixedPrice");
    });
  });

  describe("client info extraction", () => {
    it("extracts and converts client location to country code", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_FULL);
      expect(result.clientLocation).toBe("US");
    });

    it("extracts client rating", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_FULL);
      expect(result.clientReview).toBe(4.8);
    });

    it("extracts review count", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_FULL);
      expect(result.clientReviewAmount).toBe(23);
    });

    it("extracts total spent with K multiplier", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_FULL);
      expect(result.clientTotalSpent).toBe(50000);
    });

    it("extracts total spent as dollar amount", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_HOURLY);
      expect(result.clientTotalSpent).toBe(1234.56);
    });

    it("extracts Ukraine as UA", () => {
      const result = parseUpworkJobHtml(SAMPLE_HTML_HOURLY);
      expect(result.clientLocation).toBe("UA");
    });
  });

  describe("jobLink extraction", () => {
    it("extracts jobLink from canonical link", () => {
      const html = `<html><head>
                <link rel="canonical" href="https://www.upwork.com/freelance-jobs/apply/Full-Stack-Engineer_~0123456789/">
            </head><body></body></html>`;
      const result = parseUpworkJobHtml(html);
      expect(result.jobLink).toBe(
        "https://www.upwork.com/freelance-jobs/apply/Full-Stack-Engineer_~0123456789/",
      );
    });

    it("extracts jobLink from og:url meta tag when canonical is missing", () => {
      const html = `<html><head>
                <meta property="og:url" content="https://www.upwork.com/freelance-jobs/apply/React-Dev_~9876543210/">
            </head><body></body></html>`;
      const result = parseUpworkJobHtml(html);
      expect(result.jobLink).toBe(
        "https://www.upwork.com/freelance-jobs/apply/React-Dev_~9876543210/",
      );
    });

    it("prefers canonical over og:url", () => {
      const html = `<html><head>
                <link rel="canonical" href="https://canonical.example.com/job">
                <meta property="og:url" content="https://og.example.com/job">
            </head><body></body></html>`;
      const result = parseUpworkJobHtml(html);
      expect(result.jobLink).toBe("https://canonical.example.com/job");
    });

    it("returns empty string for empty HTML", () => {
      const result = parseUpworkJobHtml(EMPTY_HTML);
      expect(result.jobLink).toBe("");
    });
  });

  describe("proposal page extraction", () => {
    it("prefers the job-details title over the page heading", () => {
      const result = parseUpworkJobHtml(SAMPLE_PROPOSAL_PAGE_HTML);
      expect(result.title).toBe("Full-Stack Developer for Innovative Medical Application");
    });

    it("extracts the proposal-page description without truncation labels", () => {
      const result = parseUpworkJobHtml(SAMPLE_PROPOSAL_PAGE_HTML);
      expect(result.text).toContain("cutting-edge medical application");
      expect(result.text).not.toContain("less");
    });

    it("scopes proposal-page skills and source links to job details only", () => {
      const result = parseUpworkJobHtml(SAMPLE_PROPOSAL_PAGE_HTML);
      expect(result.skills).toEqual(["Full Stack Development"]);
      expect(result.jobLink).toBe("/jobs/~022032420924356894371");
      expect(result.type).toBe("hourly");
    });
  });

  describe("edge cases", () => {
    it("handles garbage HTML without throwing", () => {
      expect(() => parseUpworkJobHtml("not html at all")).not.toThrow();
      const result = parseUpworkJobHtml("not html at all");
      expect(result.title).toBe("");
      expect(result.skills).toEqual([]);
    });

    it("handles HTML with only styles/scripts", () => {
      const cssOnly = `<html><head><style>body{color:red}</style></head><body><script>var x=1;</script></body></html>`;
      expect(() => parseUpworkJobHtml(cssOnly)).not.toThrow();
    });
  });
});
