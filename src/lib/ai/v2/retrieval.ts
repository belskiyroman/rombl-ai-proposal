import type { CaseQuality, EvidenceType, FragmentType, JobUnderstanding, OutcomeSignals } from "./schemas";
import { qualitySelectionScore, rankSimilarityCandidates, scoreOutcomeSignals, selectClusterDiverseTopK } from "./similarity";

export interface RetrievedHistoricalCase {
  _id: string;
  clusterId?: string | null;
  candidateId: number;
  canonical: boolean;
  jobTitle: string;
  jobExtract: {
    projectType: string;
    domain: string;
    requiredSkills: string[];
    optionalSkills: string[];
    stack: string[];
    clientNeeds: string[];
    summary: string;
  };
  proposalExtract: {
    hook: string;
    valueProposition: string;
    proofPoints: string[];
    tone: string;
  };
  quality: CaseQuality;
  outcome?: OutcomeSignals;
}

export interface RetrievedFragment {
  _id: string;
  clusterId?: string | null;
  candidateId: number;
  fragmentType: FragmentType;
  text: string;
  tags: string[];
  specificityScore: number;
  genericnessScore: number;
  qualityScore: number;
  retrievalEligible: boolean;
}

export interface RetrievedEvidence {
  _id: string;
  candidateId: number;
  type: EvidenceType;
  text: string;
  tags: string[];
  techStack: string[];
  domains: string[];
  confidence: number;
  active: boolean;
  source: "candidate_profile" | "case_inference";
}

export interface VectorScoreMatch {
  id: string;
  score: number;
}

export interface RankedHistoricalCase extends RetrievedHistoricalCase {
  finalScore: number;
  semanticScore: number;
}

function normalizeSet(values: string[]): Set<string> {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function skillOverlap(left: string[], right: string[]): number {
  const leftSet = normalizeSet(left);
  const rightSet = normalizeSet(right);

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const skill of leftSet) {
    if (rightSet.has(skill)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftSet.size, rightSet.size);
}

function domainProjectMatch(jobUnderstanding: JobUnderstanding, candidate: RetrievedHistoricalCase): number {
  const domainMatch =
    candidate.jobExtract.domain.trim().toLowerCase() === jobUnderstanding.jobSummary.trim().toLowerCase() ? 1 : 0;

  const projectSignals = normalizeSet(jobUnderstanding.clientNeeds);
  const candidateSignals = normalizeSet([candidate.jobExtract.projectType, ...candidate.jobExtract.clientNeeds]);

  let overlap = 0;
  for (const signal of projectSignals) {
    if (candidateSignals.has(signal)) {
      overlap += 1;
    }
  }

  const projectMatch = projectSignals.size === 0 ? 0 : overlap / projectSignals.size;
  return Math.min(1, Math.max(domainMatch, projectMatch));
}

export function rerankHistoricalCases(args: {
  jobUnderstanding: JobUnderstanding;
  candidates: RetrievedHistoricalCase[];
  summaryMatches: VectorScoreMatch[];
  needsMatches: VectorScoreMatch[];
  limit?: number;
}): RankedHistoricalCase[] {
  const summaryMap = new Map(args.summaryMatches.map((match) => [match.id, match.score]));
  const needsMap = new Map(args.needsMatches.map((match) => [match.id, match.score]));

  const ranked = rankSimilarityCandidates(
    args.candidates.map((candidate) => {
      const semanticScore = Math.max(summaryMap.get(candidate._id) ?? 0, needsMap.get(candidate._id) ?? 0);
      const skillOverlapScore = skillOverlap(
        args.jobUnderstanding.mustHaveSkills,
        [...candidate.jobExtract.requiredSkills, ...candidate.jobExtract.stack]
      );

      return {
        id: candidate._id,
        clusterId: candidate.clusterId,
        semanticScore,
        skillOverlapScore,
        domainProjectScore: domainProjectMatch(args.jobUnderstanding, candidate),
        qualityScore: qualitySelectionScore(candidate.quality),
        outcomeScore: scoreOutcomeSignals(candidate.outcome)
      };
    })
  );

  const rankedCases = ranked
    .map((candidate) => {
      const historicalCase = args.candidates.find((item) => item._id === candidate.id);
      if (!historicalCase) {
        return null;
      }

      return {
        ...historicalCase,
        finalScore: candidate.finalScore,
        semanticScore: candidate.semanticScore
      } satisfies RankedHistoricalCase;
    })
    .filter((candidate): candidate is RankedHistoricalCase => candidate !== null);

  return selectClusterDiverseTopK(rankedCases, args.limit ?? 3);
}

function rankFragmentsByType(
  fragments: RetrievedFragment[],
  preferredTags: string[],
  limit: number
): RetrievedFragment[] {
  const preferredTagSet = normalizeSet(preferredTags);

  const ranked = [...fragments]
    .filter((fragment) => fragment.retrievalEligible)
    .sort((left, right) => {
      const leftTagScore = left.tags.filter((tag) => preferredTagSet.has(tag.toLowerCase())).length;
      const rightTagScore = right.tags.filter((tag) => preferredTagSet.has(tag.toLowerCase())).length;
      const leftScore = left.qualityScore * 0.5 + left.specificityScore * 0.35 + leftTagScore * 0.15 - left.genericnessScore * 0.2;
      const rightScore = right.qualityScore * 0.5 + right.specificityScore * 0.35 + rightTagScore * 0.15 - right.genericnessScore * 0.2;

      return rightScore - leftScore;
    });

  return selectClusterDiverseTopK(ranked, limit);
}

export function selectFragmentSignals(args: {
  jobUnderstanding: JobUnderstanding;
  fragments: RetrievedFragment[];
}): {
  openings: RetrievedFragment[];
  proofs: RetrievedFragment[];
  closings: RetrievedFragment[];
} {
  const tags = [...args.jobUnderstanding.clientNeeds, ...args.jobUnderstanding.mustHaveSkills];

  return {
    openings: rankFragmentsByType(
      args.fragments.filter((fragment) => fragment.fragmentType === "opening"),
      tags,
      2
    ),
    proofs: rankFragmentsByType(
      args.fragments.filter((fragment) => fragment.fragmentType === "proof"),
      tags,
      3
    ),
    closings: rankFragmentsByType(
      args.fragments.filter((fragment) => fragment.fragmentType === "closing"),
      [...tags, args.jobUnderstanding.proposalStrategy.tone],
      1
    )
  };
}

function evidencePriority(evidence: RetrievedEvidence): number {
  if (evidence.source === "candidate_profile") {
    return 0.15;
  }

  return 0;
}

function evidenceCoverageKey(type: EvidenceType): "projectImpact" | "tech" | "responsibilityDomain" | "other" {
  if (type === "project" || type === "impact") {
    return "projectImpact";
  }
  if (type === "tech") {
    return "tech";
  }
  if (type === "responsibility" || type === "domain") {
    return "responsibilityDomain";
  }
  return "other";
}

export function selectEvidenceSignals(args: {
  jobUnderstanding: JobUnderstanding;
  evidenceCandidates: RetrievedEvidence[];
}): RetrievedEvidence[] {
  const preferredTags = normalizeSet([
    ...args.jobUnderstanding.clientNeeds,
    ...args.jobUnderstanding.mustHaveSkills,
    ...args.jobUnderstanding.niceToHaveSkills
  ]);

  const ranked = [...args.evidenceCandidates]
    .filter((evidence) => evidence.active)
    .sort((left, right) => {
      const leftTagScore =
        left.tags.filter((tag) => preferredTags.has(tag.toLowerCase())).length +
        left.techStack.filter((tag) => preferredTags.has(tag.toLowerCase())).length;
      const rightTagScore =
        right.tags.filter((tag) => preferredTags.has(tag.toLowerCase())).length +
        right.techStack.filter((tag) => preferredTags.has(tag.toLowerCase())).length;

      const leftScore = left.confidence * 0.5 + leftTagScore * 0.25 + evidencePriority(left);
      const rightScore = right.confidence * 0.5 + rightTagScore * 0.25 + evidencePriority(right);

      return rightScore - leftScore;
    });

  const selected: RetrievedEvidence[] = [];
  const typeCounts = new Map<EvidenceType, number>();

  function canAdd(evidence: RetrievedEvidence): boolean {
    return (typeCounts.get(evidence.type) ?? 0) < 2;
  }

  function addEvidence(evidence: RetrievedEvidence) {
    if (!canAdd(evidence) || selected.some((item) => item._id === evidence._id)) {
      return;
    }

    selected.push(evidence);
    typeCounts.set(evidence.type, (typeCounts.get(evidence.type) ?? 0) + 1);
  }

  const requiredCoverage: Array<"projectImpact" | "tech" | "responsibilityDomain"> = [
    "projectImpact",
    "projectImpact",
    "tech",
    "responsibilityDomain"
  ];

  for (const coverageKey of requiredCoverage) {
    const match = ranked.find((evidence) => evidenceCoverageKey(evidence.type) === coverageKey && canAdd(evidence));
    if (match) {
      addEvidence(match);
    }
  }

  for (const candidate of ranked) {
    if (selected.length >= 4) {
      break;
    }

    addEvidence(candidate);
  }

  return selected.slice(0, 4);
}
