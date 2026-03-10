import { normalizeJobDescription } from "../job-description-normalizer";
import type {
  CandidateEvidenceInputBlock,
  CaseQuality,
  FragmentRecord,
  JobExtract,
  OutcomeSignals,
  ProposalExtract
} from "./schemas";
import { fragmentRecordSchema } from "./schemas";
import { cosineSimilarity, scoreOutcomeSignals } from "./similarity";

export interface NormalizedHistoricalCase {
  normalizedJobDescription: string;
  normalizedProposalText: string;
}

export interface ExistingCanonicalCase {
  id: string;
  clusterId: string;
  normalizedProposalText: string;
  quality: Pick<CaseQuality, "specificityScore" | "genericnessScore">;
  outcome?: OutcomeSignals;
}

export interface ClusterDecision {
  clusterId: string | null;
  duplicateMethod: "exact" | "near_duplicate" | "new_cluster";
  similarity: number;
  representativeCaseId: string | null;
  newCaseBecomesRepresentative: boolean;
}

export function normalizeProposalText(input: string): string {
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

export function normalizeHistoricalCase(jobDescription: string, proposalText: string): NormalizedHistoricalCase {
  const normalizedJob = normalizeJobDescription(jobDescription);

  return {
    normalizedJobDescription: normalizedJob.text,
    normalizedProposalText: normalizeProposalText(proposalText)
  };
}

function extractTags(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function createProposalFragments(
  proposalExtract: ProposalExtract,
  quality: Pick<CaseQuality, "overall" | "specificityScore" | "genericnessScore">
): FragmentRecord[] {
  const records: FragmentRecord[] = [];

  records.push(
    fragmentRecordSchema.parse({
      fragmentType: "opening",
      text: proposalExtract.hook,
      tags: extractTags([proposalExtract.tone, ...proposalExtract.techMapping.slice(0, 2)]),
      specificityScore: proposalExtract.specificityScore,
      genericnessScore: proposalExtract.genericnessScore,
      qualityScore: quality.overall
    })
  );

  for (const proofPoint of extractTags([...proposalExtract.experienceClaims, ...proposalExtract.proofPoints])) {
    records.push(
      fragmentRecordSchema.parse({
        fragmentType: "proof",
        text: proofPoint,
        tags: extractTags([...proposalExtract.techMapping, proposalExtract.tone]),
        specificityScore: proposalExtract.specificityScore,
        genericnessScore: proposalExtract.genericnessScore,
        qualityScore: Math.min(1, (quality.overall + quality.specificityScore) / 2)
      })
    );
  }

  records.push(
    fragmentRecordSchema.parse({
      fragmentType: "closing",
      text: proposalExtract.cta,
      tags: extractTags([proposalExtract.tone, "cta"]),
      specificityScore: proposalExtract.specificityScore,
      genericnessScore: proposalExtract.genericnessScore,
      qualityScore: Math.min(1, Math.max(0, quality.overall - proposalExtract.genericnessScore * 0.25))
    })
  );

  return records;
}

export function deriveSeedEvidenceBlocks(
  proposalExtract: ProposalExtract,
  jobExtract: JobExtract
): CandidateEvidenceInputBlock[] {
  const blocks: CandidateEvidenceInputBlock[] = [];

  for (const claim of proposalExtract.experienceClaims.slice(0, 2)) {
    blocks.push({
      type: "project",
      text: claim,
      tags: extractTags([...jobExtract.stack.slice(0, 3), jobExtract.domain]),
      techStack: jobExtract.stack.slice(0, 4),
      domains: [jobExtract.domain]
    });
  }

  for (const proof of proposalExtract.proofPoints.slice(0, 2)) {
    blocks.push({
      type: "impact",
      text: proof,
      tags: extractTags([...jobExtract.clientNeeds, "proof"]),
      techStack: jobExtract.stack.slice(0, 3),
      domains: [jobExtract.domain]
    });
  }

  if (proposalExtract.techMapping[0]) {
    blocks.push({
      type: "tech",
      text: proposalExtract.techMapping.join(", "),
      tags: extractTags(jobExtract.stack),
      techStack: extractTags([...proposalExtract.techMapping, ...jobExtract.stack]),
      domains: [jobExtract.domain]
    });
  }

  if (jobExtract.softSignals[0]) {
    blocks.push({
      type: "responsibility",
      text: `Relevant ownership signals: ${jobExtract.softSignals.join(", ")}`,
      tags: extractTags([...jobExtract.softSignals, "ownership"]),
      techStack: jobExtract.stack.slice(0, 2),
      domains: [jobExtract.domain]
    });
  }

  return blocks;
}

function representativeTieBreaker(
  outcomeScore: number,
  genericnessScore: number,
  specificityScore: number,
  textLength: number
): number[] {
  return [outcomeScore, -genericnessScore, specificityScore, -textLength];
}

export function newCaseBeatsRepresentative(
  existingCase: ExistingCanonicalCase,
  nextCase: {
    normalizedProposalText: string;
    quality: Pick<CaseQuality, "specificityScore" | "genericnessScore">;
    outcome?: OutcomeSignals;
  }
): boolean {
  const existingScore = representativeTieBreaker(
    scoreOutcomeSignals(existingCase.outcome),
    existingCase.quality.genericnessScore,
    existingCase.quality.specificityScore,
    existingCase.normalizedProposalText.length
  );
  const nextScore = representativeTieBreaker(
    scoreOutcomeSignals(nextCase.outcome),
    nextCase.quality.genericnessScore,
    nextCase.quality.specificityScore,
    nextCase.normalizedProposalText.length
  );

  for (let index = 0; index < existingScore.length; index += 1) {
    if (nextScore[index] === existingScore[index]) {
      continue;
    }

    return nextScore[index] > existingScore[index];
  }

  return false;
}

export function decideClusterForProposal(
  normalizedProposalText: string,
  quality: Pick<CaseQuality, "specificityScore" | "genericnessScore">,
  outcome: OutcomeSignals,
  canonicalCases: ExistingCanonicalCase[],
  threshold = 0.92
): ClusterDecision {
  let bestMatch: ExistingCanonicalCase | null = null;
  let bestSimilarity = 0;

  for (const candidate of canonicalCases) {
    if (candidate.normalizedProposalText === normalizedProposalText) {
      return {
        clusterId: candidate.clusterId,
        duplicateMethod: "exact",
        similarity: 1,
        representativeCaseId: candidate.id,
        newCaseBecomesRepresentative: false
      };
    }

    const similarity = cosineSimilarity(candidate.normalizedProposalText, normalizedProposalText);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = candidate;
    }
  }

  if (!bestMatch || bestSimilarity < threshold) {
    return {
      clusterId: null,
      duplicateMethod: "new_cluster",
      similarity: bestSimilarity,
      representativeCaseId: null,
      newCaseBecomesRepresentative: true
    };
  }

  return {
    clusterId: bestMatch.clusterId,
    duplicateMethod: "near_duplicate",
    similarity: bestSimilarity,
    representativeCaseId: bestMatch.id,
    newCaseBecomesRepresentative: newCaseBeatsRepresentative(bestMatch, {
      normalizedProposalText,
      quality,
      outcome
    })
  };
}
