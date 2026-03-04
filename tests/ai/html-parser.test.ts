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

const EMPTY_HTML = `<html><head></head><body></body></html>`;

describe("parseUpworkJobHtml", () => {
    describe("title extraction", () => {
        it("extracts title from data-test attribute", () => {
            const result = parseUpworkJobHtml(SAMPLE_HTML_FULL);
            expect(result.title).toBe("B2B Saas Sales - Lead Generation & Telemarketing");
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
