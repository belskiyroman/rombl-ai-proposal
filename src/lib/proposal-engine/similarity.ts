import type { CaseQuality, OutcomeSignals } from "./schemas";

export interface SimilarityCandidate {
  id: string;
  clusterId?: string | null;
  semanticScore: number;
  skillOverlapScore: number;
  domainProjectScore: number;
  qualityScore: number;
  outcomeScore: number;
}

export interface RankedSimilarityCandidate extends SimilarityCandidate {
  finalScore: number;
}

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9+\-.#/ ]+/gi, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
}

export function buildFrequencyMap(tokens: string[]): Map<string, number> {
  const frequency = new Map<string, number>();

  for (const token of tokens) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }

  return frequency;
}

export function cosineSimilarity(left: string, right: string): number {
  const leftMap = buildFrequencyMap(tokenize(left));
  const rightMap = buildFrequencyMap(tokenize(right));

  if (leftMap.size === 0 || rightMap.size === 0) {
    return 0;
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const value of leftMap.values()) {
    leftMagnitude += value * value;
  }

  for (const value of rightMap.values()) {
    rightMagnitude += value * value;
  }

  for (const [token, leftValue] of leftMap.entries()) {
    const rightValue = rightMap.get(token) ?? 0;
    dotProduct += leftValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function createTrigrams(input: string): string[] {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized.length < 3) {
    return normalized ? [normalized] : [];
  }

  const trigrams: string[] = [];

  for (let index = 0; index <= normalized.length - 3; index += 1) {
    trigrams.push(normalized.slice(index, index + 3));
  }

  return trigrams;
}

export function trigramOverlap(left: string, right: string): number {
  const leftSet = new Set(createTrigrams(left));
  const rightSet = new Set(createTrigrams(right));

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const trigram of leftSet) {
    if (rightSet.has(trigram)) {
      intersection += 1;
    }
  }

  return intersection / Math.max(leftSet.size, rightSet.size);
}

export function scoreOutcomeSignals(outcome: OutcomeSignals | null | undefined): number {
  if (!outcome) {
    return 0;
  }

  let score = 0;
  if (outcome.reply) {
    score += 0.25;
  }
  if (outcome.interview) {
    score += 0.35;
  }
  if (outcome.hired) {
    score += 0.4;
  }

  return Math.min(score, 1);
}

export function qualitySelectionScore(quality: Pick<CaseQuality, "overall" | "humanScore">): number {
  return Math.min(1, Math.max(0, quality.overall * 0.7 + quality.humanScore * 0.3));
}

export function weightedCaseScore(candidate: SimilarityCandidate): number {
  return (
    candidate.semanticScore * 0.45 +
    candidate.skillOverlapScore * 0.2 +
    candidate.domainProjectScore * 0.15 +
    candidate.qualityScore * 0.1 +
    candidate.outcomeScore * 0.1
  );
}

export function rankSimilarityCandidates(candidates: SimilarityCandidate[]): RankedSimilarityCandidate[] {
  return [...candidates]
    .map((candidate) => ({
      ...candidate,
      finalScore: weightedCaseScore(candidate)
    }))
    .sort((left, right) => right.finalScore - left.finalScore);
}

export function selectClusterDiverseTopK<T extends { clusterId?: string | null }>(
  candidates: T[],
  limit: number
): T[] {
  const selected: T[] = [];
  const seenClusters = new Set<string>();

  for (const candidate of candidates) {
    const clusterId = candidate.clusterId?.trim();
    if (clusterId && seenClusters.has(clusterId)) {
      continue;
    }

    selected.push(candidate);

    if (clusterId) {
      seenClusters.add(clusterId);
    }

    if (selected.length === limit) {
      break;
    }
  }

  return selected;
}
