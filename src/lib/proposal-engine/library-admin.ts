import { newCaseBeatsRepresentative } from "./offline";
import { qualitySelectionScore } from "./similarity";
import type { CaseQuality, OutcomeSignals, ProposalExtract } from "./schemas";

export interface LibraryAdminCase {
  _id: string;
  candidateId: number;
  clusterId?: string | null;
  canonical: boolean;
  jobTitle: string;
  normalizedProposalText: string;
  proposalExtract: Pick<ProposalExtract, "hook">;
  quality: Pick<CaseQuality, "overall" | "humanScore" | "specificityScore" | "genericnessScore">;
  outcome?: OutcomeSignals;
  createdAt: number;
  updatedAt: number;
}

export function selectRepresentativeCase<T extends LibraryAdminCase>(cases: T[]): T | null {
  if (cases.length === 0) {
    return null;
  }

  let representative = cases[0];

  for (const candidate of cases.slice(1)) {
    if (
      newCaseBeatsRepresentative(
        {
          id: representative._id,
          clusterId: representative.clusterId ?? representative._id,
          normalizedProposalText: representative.normalizedProposalText,
          quality: {
            specificityScore: representative.quality.specificityScore,
            genericnessScore: representative.quality.genericnessScore
          },
          outcome: representative.outcome
        },
        {
          normalizedProposalText: candidate.normalizedProposalText,
          quality: {
            specificityScore: candidate.quality.specificityScore,
            genericnessScore: candidate.quality.genericnessScore
          },
          outcome: candidate.outcome
        }
      )
    ) {
      representative = candidate;
    }
  }

  return representative;
}

export function computeClusterQualityScore(caseRecord: Pick<LibraryAdminCase, "quality">): number {
  return qualitySelectionScore({
    overall: caseRecord.quality.overall,
    humanScore: caseRecord.quality.humanScore
  });
}

export function sortClusterCases<T extends LibraryAdminCase>(cases: T[], representativeId?: string | null): T[] {
  return [...cases].sort((left, right) => {
    const leftIsRepresentative = representativeId ? left._id === representativeId : left.canonical;
    const rightIsRepresentative = representativeId ? right._id === representativeId : right.canonical;

    if (leftIsRepresentative !== rightIsRepresentative) {
      return leftIsRepresentative ? -1 : 1;
    }

    return right.updatedAt - left.updatedAt;
  });
}
