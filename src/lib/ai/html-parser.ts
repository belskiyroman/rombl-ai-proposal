/**
 * Upwork Job HTML Parser
 *
 * Extracts structured job data from raw Upwork job listing HTML
 * using the browser's DOMParser API (zero dependencies).
 */

export interface ParsedJobData {
    title: string;
    text: string;
    skills: string[];
    type: "hourly" | "fixedPrice" | "hourly/fixedPrice";
    clientLocation: string;
    clientReview: number;
    clientReviewAmount: number;
    clientTotalSpent: number;
}

/**
 * Parse raw Upwork job listing HTML and extract job-relevant fields.
 *
 * Uses multiple selector strategies to be resilient against minor DOM changes.
 * Fields that cannot be found default to safe empty/zero values.
 */
export function parseUpworkJobHtml(html: string): ParsedJobData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    return {
        title: extractTitle(doc),
        text: extractDescription(doc),
        skills: extractSkills(doc),
        type: extractProjectType(doc),
        clientLocation: extractClientLocation(doc),
        clientReview: extractClientReview(doc),
        clientReviewAmount: extractClientReviewAmount(doc),
        clientTotalSpent: extractClientTotalSpent(doc),
    };
}

// ---------- Extractors ----------

function extractTitle(doc: Document): string {
    // Strategy 1: data-test attribute
    const dataTest = doc.querySelector('[data-test="job-title"]');
    if (dataTest?.textContent?.trim()) return dataTest.textContent.trim();

    // Strategy 2: <title> tag (contains " - Upwork" suffix typically)
    const titleEl = doc.querySelector("title");
    if (titleEl?.textContent?.trim()) {
        return titleEl.textContent
            .replace(/\s*[-|]\s*Upwork.*$/i, "")
            .replace(/&amp;/g, "&")
            .trim();
    }

    // Strategy 3: first large heading in main content
    const headings = doc.querySelectorAll("h1, h2, h3, h4, h5");
    for (const h of headings) {
        const text = h.textContent?.trim() ?? "";
        if (text.length > 5 && text.length < 200) return text;
    }

    return "";
}

function extractDescription(doc: Document): string {
    // Strategy 1: data-test="Description" or "UpCDescription"
    const dataDesc =
        doc.querySelector('[data-test="Description"]') ??
        doc.querySelector('[data-test="UpCDescription"]');
    if (dataDesc) {
        const text = htmlToReadableText(dataDesc);
        if (text.length > 10) return cleanText(text);
    }

    // Strategy 2: class containing "description" in a card/section
    const descByClass = doc.querySelector(
        '[class*="description"], [class*="Description"]'
    );
    if (descByClass) {
        const text = htmlToReadableText(descByClass);
        if (text.length > 10) return cleanText(text);
    }

    // Strategy 3: section with "description" heading
    const sections = doc.querySelectorAll("section, .up-card-section, [class*='card-section']");
    for (const section of sections) {
        const heading = section.querySelector("h2, h3, h4, h5, header");
        if (heading?.textContent?.toLowerCase().includes("description")) {
            // Get the content excluding the heading
            const content = Array.from(section.children)
                .filter((el) => el !== heading)
                .map((el) => el.textContent?.trim())
                .filter(Boolean)
                .join("\n");
            if (content.length > 20) return cleanText(content);
        }
    }

    // Strategy 4: Look for the largest text block
    const paragraphs = doc.querySelectorAll("p, div.break");
    let longestText = "";
    for (const p of paragraphs) {
        const text = p.textContent?.trim() ?? "";
        if (text.length > longestText.length) longestText = text;
    }
    if (longestText.length > 50) return cleanText(longestText);

    return "";
}

function extractSkills(doc: Document): string[] {
    const skills: string[] = [];

    function addSkill(text: string | null | undefined) {
        const t = text?.trim();
        if (t && t.length > 0 && t.length < 60 && !skills.includes(t)) {
            skills.push(t);
        }
    }

    /**
     * Check if an element is a "leaf" skill element (the text is the skill itself)
     * vs a container (parent wrapping multiple skill children).
     * A container has multiple child elements whose combined text ≈ its textContent.
     */
    function extractFromElement(el: Element) {
        const childEls = el.querySelectorAll(
            "span, a, .air3-token, [class*='token'], [class*='badge'], [class*='tag']"
        );
        // If element has child elements that look like individual skills, extract each
        if (childEls.length > 1) {
            // Find leaf-level children (no nested skill-like children)
            for (const child of childEls) {
                const nestedChildren = child.querySelectorAll(
                    "span, a, .air3-token, [class*='token'], [class*='badge'], [class*='tag']"
                );
                if (nestedChildren.length === 0) {
                    addSkill(child.textContent);
                }
            }
        } else {
            // Leaf element — its text is the skill
            addSkill(el.textContent);
        }
    }

    // Strategy 1: data-test="Skill" / "skill" / "SkillsList"
    const skillEls = doc.querySelectorAll(
        '[data-test="Skill"], [data-test="skill"], [data-test*="skill"]:not([data-test*="SkillsList"])'
    );
    for (const el of skillEls) {
        addSkill(el.textContent);
    }
    if (skills.length > 0) return skills;

    // Strategy 2: Look for a "Skills" section and extract individual token/badge children
    const headings = doc.querySelectorAll("h2, h3, h4, h5, h6, strong, [class*='heading'], [class*='label']");
    for (const heading of headings) {
        const headingText = heading.textContent?.toLowerCase() ?? "";
        if (headingText.includes("skills") && headingText.length < 50) {
            // Find the nearest container (parent, sibling, or ancestor section)
            const container =
                heading.closest("section") ??
                heading.closest("[class*='card']") ??
                heading.closest("[class*='group']") ??
                heading.parentElement;
            if (container) {
                const tokens = container.querySelectorAll(
                    ".air3-token, [class*='skill-badge'], [class*='up-skill'], a[class*='token'], span[class*='badge'], span[class*='token']"
                );
                if (tokens.length > 0) {
                    for (const t of tokens) addSkill(t.textContent);
                } else {
                    // Fall back to all span/a leaf elements in the container
                    const spans = container.querySelectorAll("span, a");
                    for (const s of spans) {
                        if (s.children.length === 0 && s !== heading) {
                            addSkill(s.textContent);
                        }
                    }
                }
            }
            if (skills.length > 0) return skills;
        }
    }

    // Strategy 3: air3-token elements (common Upwork Air 3.0 pattern)
    const air3Tokens = doc.querySelectorAll(".air3-token");
    for (const el of air3Tokens) {
        if (el.children.length === 0 || el.querySelector("span")) {
            addSkill(el.textContent);
        }
    }
    if (skills.length > 0) return skills;

    // Strategy 4: skill badges by class — but only leaf elements or smart container extraction
    const badgeEls = doc.querySelectorAll(
        '[class*="skill"], [class*="Skill"], .up-skill-badge'
    );
    for (const el of badgeEls) {
        extractFromElement(el);
    }

    return skills;
}

function extractProjectType(doc: Document): "hourly" | "fixedPrice" | "hourly/fixedPrice" {
    const bodyText = doc.body?.textContent?.toLowerCase() ?? "";

    const hasHourly = /\bhourly\b/.test(bodyText);
    const hasFixed = /\bfixed[- ]?price\b/.test(bodyText);

    if (hasHourly && hasFixed) return "hourly/fixedPrice";
    if (hasHourly) return "hourly";
    return "fixedPrice";
}

function extractClientLocation(doc: Document): string {
    // Strategy 1: data-test attributes for client location
    const locEl =
        doc.querySelector('[data-test="client-location"]') ??
        doc.querySelector('[data-test="ClientLocation"]') ??
        doc.querySelector('[data-qa="client-location"]');
    if (locEl?.textContent?.trim()) {
        return countryToCode(locEl.textContent.trim());
    }

    // Strategy 2: Look for location near client info section
    const clientSections = doc.querySelectorAll(
        '[data-test*="client"], [class*="client"], [class*="Client"]'
    );
    for (const section of clientSections) {
        const locationEl = section.querySelector('[class*="location"], [class*="Location"]');
        if (locationEl?.textContent?.trim()) {
            return countryToCode(locationEl.textContent.trim());
        }
    }

    // Strategy 3: Look for country flag image with country name in data-v-* or alt
    const flagImgs = doc.querySelectorAll('img[alt][src*="flag"], [class*="flag"]');
    for (const img of flagImgs) {
        const alt = img.getAttribute("alt")?.trim();
        if (alt) return countryToCode(alt);
    }

    // Strategy 4: Look for text pattern near "Location" label
    const bodyText = doc.body?.textContent ?? "";
    const locMatch = bodyText.match(/(?:location|country)[:\s]+([A-Za-z][A-Za-z ]+?)(?:\s*[\n|•·,]|$)/im);
    if (locMatch?.[1]) return countryToCode(locMatch[1].trim());

    // Strategy 5: scan innerHTML for known country-flag icon nearby or text patterns
    const allText = doc.body?.innerHTML ?? "";
    const countryMatch = allText.match(
        /client\s+(?:location|country)[^<]*?<[^>]*>([^<]+)/i
    );
    if (countryMatch?.[1]) return countryToCode(countryMatch[1].trim());

    return "";
}

function extractClientReview(doc: Document): number {
    // Strategy 1: data-test rating
    const ratingEl =
        doc.querySelector('[data-test="client-rating"] .up-rating-text') ??
        doc.querySelector('[data-test="client-rating"]') ??
        doc.querySelector('[class*="rating"]');

    if (ratingEl?.textContent) {
        const match = ratingEl.textContent.match(/([\d.]+)\s*(?:of\s*5|\/\s*5|\s*stars?)?/i);
        if (match) return clamp(parseFloat(match[1]), 0, 5);
    }

    // Strategy 2: aria-label on stars
    const starsEl = doc.querySelector('[aria-label*="Rating"], [aria-label*="rating"]');
    if (starsEl) {
        const match = starsEl.getAttribute("aria-label")?.match(/([\d.]+)/);
        if (match) return clamp(parseFloat(match[1]), 0, 5);
    }

    // Strategy 3: text pattern "X.X out of 5" or "Rating: X.X"
    const bodyText = doc.body?.textContent ?? "";
    const ratingMatch = bodyText.match(/(\d\.\d+)\s*(?:out of|of)\s*5/i);
    if (ratingMatch) return clamp(parseFloat(ratingMatch[1]), 0, 5);

    return 0;
}

function extractClientReviewAmount(doc: Document): number {
    const bodyText = doc.body?.textContent ?? "";

    // Pattern: "(123 reviews)" or "123 reviews" or "123 jobs posted"
    const match = bodyText.match(/\(?\s*([\d,]+)\s*reviews?\s*\)?/i);
    if (match) return parseInt(match[1].replace(/,/g, ""), 10) || 0;

    // Pattern: "X jobs posted" (alternative metric)
    const jobsMatch = bodyText.match(/(\d+)\s*jobs?\s*posted/i);
    if (jobsMatch) return parseInt(jobsMatch[1], 10) || 0;

    return 0;
}

function extractClientTotalSpent(doc: Document): number {
    const bodyText = doc.body?.textContent ?? "";

    // Pattern: "$50K+ total spent" or "$1.2M total spent" or "$50K+ spent"
    const kMatch = bodyText.match(/\$\s*([\d,.]+)\s*([KkMm])\+?\s*(?:total\s*)?spent/i);
    if (kMatch) {
        const num = parseFloat(kMatch[1].replace(/,/g, ""));
        const multiplier = kMatch[2].toLowerCase() === "m" ? 1_000_000 : 1_000;
        return num * multiplier;
    }

    // Pattern: "$50,000 total spent" or "$1,234.56 spent"
    const dollarMatch = bodyText.match(
        /\$\s*([\d,]+(?:\.\d+)?)\s*(?:total\s*)?spent/i
    );
    if (dollarMatch) return parseFloat(dollarMatch[1].replace(/,/g, "")) || 0;

    // Pattern: just "$50K+" near client section without "spent" keyword
    const shortKMatch = bodyText.match(/\$\s*([\d,.]+)\s*([KkMm])\+/i);
    if (shortKMatch) {
        const num = parseFloat(shortKMatch[1].replace(/,/g, ""));
        const multiplier = shortKMatch[2].toLowerCase() === "m" ? 1_000_000 : 1_000;
        return num * multiplier;
    }

    return 0;
}

// ---------- Helpers ----------

/**
 * Convert an HTML element's innerHTML into readable plain text,
 * preserving block-level boundaries (paragraphs, divs, lists, headings)
 * as newlines — instead of collapsing everything like textContent does.
 */
function htmlToReadableText(el: Element): string {
    // Clone to avoid mutating the original DOM
    const clone = el.cloneNode(true) as Element;

    // Insert newline markers before/after block-level elements
    const blocks = clone.querySelectorAll(
        "p, div, br, li, h1, h2, h3, h4, h5, h6, ul, ol, tr, section, header, footer, article"
    );
    for (const block of blocks) {
        // Add newline before the block tag
        block.insertAdjacentText("beforebegin", "\n");
        // br is self-closing, others also get newline after
        if (block.tagName === "BR") continue;
        block.insertAdjacentText("afterend", "\n");
    }

    // Add dash before list items
    const listItems = clone.querySelectorAll("li");
    for (const li of listItems) {
        li.insertAdjacentText("afterbegin", "- ");
    }

    return clone.textContent ?? "";
}

function cleanText(text: string): string {
    return text
        // Normalize line endings
        .replace(/\r\n/g, "\n")
        // Convert bullet/diamond markers into newline + dash
        .replace(/\s*[◆◇✦⬥]\s*/g, "\n\n")
        .replace(/\s*[•●∙▪▸►]\s*/g, "\n- ")
        // Collapse runs of spaces (but not newlines) into one space
        .replace(/[^\S\n]+/g, " ")
        // Collapse 3+ newlines into 2
        .replace(/\n{3,}/g, "\n\n")
        // Trim each line
        .split("\n")
        .map((line) => line.trim())
        .filter((line, i, arr) => line !== "" || (i > 0 && arr[i - 1] !== ""))
        .join("\n")
        .trim();
}

function clamp(val: number, min: number, max: number): number {
    return Math.min(Math.max(val, min), max);
}

/** Best-effort country name → 2-3 letter code mapping */
const COUNTRY_CODES: Record<string, string> = {
    "united states": "US",
    usa: "US",
    "united kingdom": "GB",
    uk: "GB",
    canada: "CA",
    australia: "AU",
    germany: "DE",
    france: "FR",
    india: "IN",
    ukraine: "UA",
    israel: "IL",
    netherlands: "NL",
    spain: "ES",
    italy: "IT",
    brazil: "BR",
    japan: "JP",
    china: "CN",
    "south korea": "KR",
    singapore: "SG",
    "new zealand": "NZ",
    ireland: "IE",
    sweden: "SE",
    switzerland: "CH",
    poland: "PL",
    portugal: "PT",
    mexico: "MX",
    argentina: "AR",
    philippines: "PH",
    pakistan: "PK",
    bangladesh: "BD",
    nigeria: "NG",
    egypt: "EG",
    "saudi arabia": "SA",
    "united arab emirates": "AE",
    uae: "AE",
    turkey: "TR",
    indonesia: "ID",
    vietnam: "VN",
    thailand: "TH",
    malaysia: "MY",
    myanmar: "MM",
    colombia: "CO",
    chile: "CL",
    romania: "RO",
    "czech republic": "CZ",
    czechia: "CZ",
    hungary: "HU",
    austria: "AT",
    belgium: "BE",
    denmark: "DK",
    finland: "FI",
    norway: "NO",
    "south africa": "ZA",
    kenya: "KE",
};

function countryToCode(raw: string): string {
    const cleaned = raw.toLowerCase().trim();
    // Already a code?
    if (/^[A-Z]{2,3}$/i.test(cleaned)) return cleaned.toUpperCase();
    return COUNTRY_CODES[cleaned] ?? raw.slice(0, 3).toUpperCase();
}
