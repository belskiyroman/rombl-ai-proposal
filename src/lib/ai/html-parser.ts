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
    if (dataDesc?.textContent?.trim()) return cleanText(dataDesc.textContent);

    // Strategy 2: class containing "description" in a card/section
    const descByClass = doc.querySelector(
        '[class*="description"], [class*="Description"]'
    );
    if (descByClass?.textContent?.trim()) return cleanText(descByClass.textContent);

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

    // Strategy 1: data-test="skill" or similar
    const skillEls = doc.querySelectorAll(
        '[data-test="Skill"], [data-test="skill"], [data-test*="skill"]'
    );
    for (const el of skillEls) {
        const text = el.textContent?.trim();
        if (text && !skills.includes(text)) skills.push(text);
    }
    if (skills.length > 0) return skills;

    // Strategy 2: skill badges by class
    const badgeEls = doc.querySelectorAll(
        '[class*="skill"], .air3-token, [class*="Skill"], .up-skill-badge'
    );
    for (const el of badgeEls) {
        const text = el.textContent?.trim();
        if (text && text.length < 60 && !skills.includes(text)) skills.push(text);
    }
    if (skills.length > 0) return skills;

    // Strategy 3: look for a "Skills" section heading and grab siblings/children
    const allEls = doc.querySelectorAll("h2, h3, h4, h5, strong, [class*='heading']");
    for (const heading of allEls) {
        if (heading.textContent?.toLowerCase().includes("skills")) {
            const container =
                heading.closest("section") ??
                heading.closest("[class*='card']") ??
                heading.parentElement;
            if (container) {
                const spans = container.querySelectorAll("span, a, .air3-token");
                for (const s of spans) {
                    const t = s.textContent?.trim();
                    if (t && t.length < 60 && t !== heading.textContent?.trim() && !skills.includes(t)) {
                        skills.push(t);
                    }
                }
            }
            break;
        }
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

    // Strategy 3: scan for known country-flag icon nearby or text patterns
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
    const starsEl = doc.querySelector('[aria-label*="Rating"]');
    if (starsEl) {
        const match = starsEl.getAttribute("aria-label")?.match(/([\d.]+)/);
        if (match) return clamp(parseFloat(match[1]), 0, 5);
    }

    return 0;
}

function extractClientReviewAmount(doc: Document): number {
    // Look for review count pattern "(123 reviews)" or "123 reviews"
    const bodyText = doc.body?.textContent ?? "";
    const match = bodyText.match(/\(?\s*([\d,]+)\s*reviews?\s*\)?/i);
    if (match) return parseInt(match[1].replace(/,/g, ""), 10) || 0;

    return 0;
}

function extractClientTotalSpent(doc: Document): number {
    // Look for "$X.XXK+ spent" or "$X,XXX total spent" patterns
    const bodyText = doc.body?.textContent ?? "";

    // Pattern: "$50K+ total spent" or "$1.2M total spent"
    const kMatch = bodyText.match(/\$\s*([\d,.]+)\s*([KkMm])[\+]?\s*(?:total\s*)?spent/i);
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

    return 0;
}

// ---------- Helpers ----------

function cleanText(text: string): string {
    return text
        .replace(/\s+/g, " ")
        .replace(/\n\s*\n/g, "\n")
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
