import fs from "node:fs/promises";
import path from "node:path";

export const PRIMARY_TONE = "consultative";

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Seed candidate field "${fieldName}" must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeStringArray(values, fieldName) {
  if (!Array.isArray(values)) {
    throw new Error(`Seed candidate field "${fieldName}" must be an array.`);
  }

  const normalized = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  if (normalized.length === 0) {
    throw new Error(`Seed candidate field "${fieldName}" must contain at least one value.`);
  }

  return [...new Set(normalized)];
}

function normalizeCandidateId(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error("Seed candidate field \"candidateId\" must be a positive integer.");
  }

  return value;
}

function buildSeedNotes(baseNotes, toneProfileValues) {
  const additionalToneSignals = toneProfileValues.filter((tone) => tone !== PRIMARY_TONE);
  const toneNotes = additionalToneSignals.length > 0
    ? `Additional tone signals: ${additionalToneSignals.join(", ")}.`
    : undefined;

  return [baseNotes, toneNotes].filter((value) => typeof value === "string" && value.length > 0).join("\n\n") || undefined;
}

export function normalizeCandidateSeed(rawCandidate) {
  const toneProfileValues = normalizeStringArray(rawCandidate.toneProfile, "toneProfile");
  const baseNotes = normalizeOptionalString(rawCandidate.notes);
  const githubUrl = normalizeOptionalString(rawCandidate.githubUrl);
  const websiteUrl = normalizeOptionalString(rawCandidate.websiteUrl);
  const portfolioUrl = normalizeOptionalString(rawCandidate.portfolioUrl);

  return {
    candidateId: normalizeCandidateId(rawCandidate.candidateId),
    displayName: assertNonEmptyString(rawCandidate.displayName, "displayName"),
    positioningSummary: assertNonEmptyString(rawCandidate.positioningSummary, "positioningSummary"),
    toneProfile: PRIMARY_TONE,
    coreDomains: normalizeStringArray(rawCandidate.coreDomains, "coreDomains"),
    preferredCtaStyle: assertNonEmptyString(rawCandidate.preferredCtaStyle, "preferredCtaStyle"),
    metadata: {
      seniority: normalizeOptionalString(rawCandidate.seniority),
      availability: normalizeOptionalString(rawCandidate.availability),
      location: normalizeOptionalString(rawCandidate.location),
      notes: buildSeedNotes(baseNotes, toneProfileValues),
      externalProfiles: {
        githubUrl,
        websiteUrl,
        portfolioUrl
      }
    },
    rawEvidenceText: normalizeOptionalString(rawCandidate.evidence)
  };
}

export async function loadCandidateSeedFiles(seedDirectory) {
  const entries = await fs.readdir(seedDirectory, {
    withFileTypes: true
  });

  const seedFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(seedDirectory, entry.name))
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    seedFiles.map(async (seedFile) => {
      const raw = await fs.readFile(seedFile, "utf8");
      return {
        filePath: seedFile,
        rawCandidate: JSON.parse(raw)
      };
    })
  );
}
