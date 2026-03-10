import type { CopyRisk } from "./schemas";
import { cosineSimilarity, trigramOverlap } from "./similarity";

export interface CopyRiskReference {
  id: string;
  type: "case" | "fragment";
  text: string;
}

export interface CopyRiskThresholds {
  paragraphCosineThreshold?: number;
  trigramOverlapThreshold?: number;
}

const defaultParagraphCosineThreshold = 0.96;
const defaultTrigramOverlapThreshold = 0.35;

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function assessCopyRisk(
  draft: string,
  references: CopyRiskReference[],
  thresholds: CopyRiskThresholds = {}
): CopyRisk {
  const paragraphCosineThreshold = thresholds.paragraphCosineThreshold ?? defaultParagraphCosineThreshold;
  const trigramOverlapThreshold = thresholds.trigramOverlapThreshold ?? defaultTrigramOverlapThreshold;

  const paragraphs = splitParagraphs(draft);
  let maxParagraphCosine = 0;
  let maxTrigramOverlap = 0;
  const matchedCaseIds = new Set<string>();
  const matchedFragmentIds = new Set<string>();
  const reasons = new Set<string>();

  for (const reference of references) {
    const referenceParagraphs = splitParagraphs(reference.text);
    const fullOverlap = trigramOverlap(draft, reference.text);
    maxTrigramOverlap = Math.max(maxTrigramOverlap, fullOverlap);

    if (fullOverlap >= trigramOverlapThreshold) {
      reasons.add(`High trigram overlap with ${reference.type} ${reference.id}`);
      if (reference.type === "case") {
        matchedCaseIds.add(reference.id);
      } else {
        matchedFragmentIds.add(reference.id);
      }
    }

    for (const paragraph of paragraphs) {
      for (const referenceParagraph of referenceParagraphs) {
        const cosine = cosineSimilarity(paragraph, referenceParagraph);
        maxParagraphCosine = Math.max(maxParagraphCosine, cosine);

        if (cosine >= paragraphCosineThreshold) {
          reasons.add(`Paragraph too close to ${reference.type} ${reference.id}`);
          if (reference.type === "case") {
            matchedCaseIds.add(reference.id);
          } else {
            matchedFragmentIds.add(reference.id);
          }
        }
      }
    }
  }

  return {
    triggered: reasons.size > 0,
    maxParagraphCosine,
    trigramOverlap: maxTrigramOverlap,
    matchedCaseIds: [...matchedCaseIds],
    matchedFragmentIds: [...matchedFragmentIds],
    reasons: [...reasons]
  };
}
