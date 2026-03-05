import { parseUpworkJobHtml } from "./html-parser";

export const MAX_JOB_DESCRIPTION_CHARS = 12000;

export interface JobDescriptionNormalizationMetadata {
  wasHtml: boolean;
  usedUpworkParser: boolean;
  wasTruncated: boolean;
  originalLength: number;
  finalLength: number;
}

export interface NormalizedJobDescription {
  text: string;
  metadata: JobDescriptionNormalizationMetadata;
}

interface NormalizeJobDescriptionOptions {
  maxChars?: number;
}

const htmlEntityMap: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  "#x27": "'",
  "#x2f": "/",
  ndash: "-",
  mdash: "-",
  hellip: "...",
  copy: "(c)",
  reg: "(r)",
  trade: "(tm)"
};

export function normalizeJobDescription(
  input: string,
  options: NormalizeJobDescriptionOptions = {}
): NormalizedJobDescription {
  const source = input ?? "";
  const originalLength = source.length;
  const maxChars = options.maxChars ?? MAX_JOB_DESCRIPTION_CHARS;

  const wasHtml = isLikelyHtml(source);
  let usedUpworkParser = false;
  let normalizedText = normalizeWhitespace(source);

  if (wasHtml) {
    const parserResult = tryExtractWithUpworkParser(source);
    if (parserResult !== null) {
      normalizedText = parserResult;
      usedUpworkParser = true;
    } else {
      normalizedText = stripHtmlToText(source);
    }
  }

  if (!normalizedText) {
    normalizedText = normalizeWhitespace(source);
  }

  let wasTruncated = false;
  if (normalizedText.length > maxChars) {
    normalizedText = normalizedText.slice(0, maxChars).trimEnd();
    wasTruncated = true;
  }

  return {
    text: normalizedText,
    metadata: {
      wasHtml,
      usedUpworkParser,
      wasTruncated,
      originalLength,
      finalLength: normalizedText.length
    }
  };
}

function isLikelyHtml(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }

  return /<\s*!doctype\s+html/i.test(trimmed) || /<\s*html[\s>]/i.test(trimmed) || /<\s*(head|body|div|span|p|section|article|script|style)\b/i.test(trimmed);
}

function tryExtractWithUpworkParser(input: string): string | null {
  if (typeof DOMParser === "undefined") {
    return null;
  }

  try {
    const parsed = parseUpworkJobHtml(input);
    const parts: string[] = [];

    if (parsed.title.trim()) {
      parts.push(parsed.title.trim());
    }
    if (parsed.text.trim()) {
      parts.push(parsed.text.trim());
    }
    if (parsed.skills.length > 0) {
      parts.push(`Skills: ${parsed.skills.join(", ")}`);
    }

    const combined = normalizeWhitespace(parts.join("\n\n"));
    if (isWeakExtraction(parsed.title, parsed.text, parsed.skills, combined)) {
      return null;
    }
    return combined;
  } catch {
    return null;
  }
}

function isWeakExtraction(title: string, text: string, skills: string[], combined: string): boolean {
  const hasStrongDescription = text.trim().length >= 40;
  const hasUsefulTitleAndSkills = title.trim().length >= 10 && skills.length > 0;
  if (hasStrongDescription || hasUsefulTitleAndSkills) {
    return false;
  }

  return combined.length < 30;
}

function stripHtmlToText(input: string): string {
  const withoutHeavyBlocks = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<canvas\b[^>]*>[\s\S]*?<\/canvas>/gi, " ");

  const withLineBreaks = withoutHeavyBlocks
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|section|article|li|ul|ol|h[1-6]|tr|table)\s*>/gi, "\n");

  const noTags = withLineBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeCommonHtmlEntities(noTags);
  return normalizeWhitespace(decoded);
}

function decodeCommonHtmlEntities(input: string): string {
  return input.replace(/&([a-zA-Z0-9#]+);/g, (full, entity: string) => {
    const key = entity.toLowerCase();
    if (htmlEntityMap[key]) {
      return htmlEntityMap[key];
    }

    if (key.startsWith("#x")) {
      const codePoint = Number.parseInt(key.slice(2), 16);
      if (!Number.isNaN(codePoint)) {
        return String.fromCodePoint(codePoint);
      }
      return full;
    }

    if (key.startsWith("#")) {
      const codePoint = Number.parseInt(key.slice(1), 10);
      if (!Number.isNaN(codePoint)) {
        return String.fromCodePoint(codePoint);
      }
    }

    return full;
  });
}

function normalizeWhitespace(input: string): string {
  if (!input) {
    return "";
  }

  return input
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, lines) => line !== "" || (index > 0 && lines[index - 1] !== ""))
    .join("\n")
    .trim();
}
