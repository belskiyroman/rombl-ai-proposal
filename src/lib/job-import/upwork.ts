import { parseUpworkJobHtml } from "../ai/html-parser";

export interface ExtractedUpworkJobPage {
  sourceSite: "upwork";
  sourceUrl: string;
  pageTitle: string;
  jobTitle: string;
  jobDescription: string;
  metadata: {
    skillsCount: number;
    projectType: "hourly" | "fixedPrice" | "hourly/fixedPrice";
  };
}

export function isUpworkJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("upwork.com")) {
      return false;
    }

    return /^\/nx\/proposals\/job\/[^/]+\/apply\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function extractUpworkJobPageSnapshot(args: {
  url: string;
  pageTitle: string;
  html: string;
}): ExtractedUpworkJobPage | null {
  if (!isUpworkJobUrl(args.url)) {
    return null;
  }

  const parsed = parseUpworkJobHtml(args.html);
  const jobTitle = parsed.title.trim();
  const jobDescription = parsed.text.trim();
  const sourceUrl = resolveSourceUrl(parsed.jobLink.trim(), args.url);

  if (!jobTitle || /^submit a proposal$/i.test(jobTitle) || jobDescription.length < 40) {
    return null;
  }

  return {
    sourceSite: "upwork",
    sourceUrl,
    pageTitle: args.pageTitle.trim(),
    jobTitle,
    jobDescription,
    metadata: {
      skillsCount: parsed.skills.length,
      projectType: parsed.type
    }
  };
}

function resolveSourceUrl(candidate: string, fallbackUrl: string): string {
  if (!candidate) {
    return fallbackUrl;
  }

  try {
    return new URL(candidate, fallbackUrl).toString();
  } catch {
    return fallbackUrl;
  }
}
