import { maxProposalCoverLetterChars, type ProposalLengthBucket } from "./schemas";

export interface ProposalLengthBudget {
  softTargetChars: number;
  hardMaxChars: number;
}

export type DeterministicLengthReductionStrategy = "noop" | "drop_paragraphs" | "trim_sentences" | "hard_slice";

const proposalLengthSoftTargets: Record<ProposalLengthBucket, number> = {
  short: 1400,
  medium: 2600,
  long: 3800
};

function normalizeDraft(input: string): string {
  return input.replace(/\r\n/g, "\n").trim();
}

function joinParagraphs(paragraphs: string[]): string {
  return paragraphs
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .join("\n\n")
    .trim();
}

function splitParagraphs(input: string): string[] {
  return normalizeDraft(input)
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function looksLikeCtaParagraph(paragraph: string): boolean {
  return /happy to|glad to|open to|if helpful|if it makes sense|available to|let'?s|would love to|can share|can walk through|can outline|discuss next steps|talk through/i.test(
    paragraph
  );
}

function splitSentences(paragraph: string): string[] {
  const matches = paragraph.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g);
  return (matches ?? [paragraph]).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
}

function sliceAtBoundary(input: string, hardMaxChars: number): string {
  if (input.length <= hardMaxChars) {
    return input;
  }

  let sliced = input.slice(0, hardMaxChars).trimEnd();
  const boundary = Math.max(
    sliced.lastIndexOf("\n\n"),
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
    sliced.lastIndexOf("; "),
    sliced.lastIndexOf(": ")
  );

  if (boundary >= Math.floor(hardMaxChars * 0.7)) {
    sliced = sliced.slice(0, boundary + 1).trimEnd();
  }

  return sliced.replace(/[,:;\-]+$/g, "").trimEnd();
}

export function getProposalLengthBudget(lengthBucket: ProposalLengthBucket): ProposalLengthBudget {
  return {
    softTargetChars: proposalLengthSoftTargets[lengthBucket],
    hardMaxChars: maxProposalCoverLetterChars
  };
}

export function deterministicallyReduceCoverLetter(
  draft: string,
  hardMaxChars = maxProposalCoverLetterChars
): {
  output: string;
  strategy: DeterministicLengthReductionStrategy;
  wasReduced: boolean;
} {
  const normalizedDraft = normalizeDraft(draft);
  if (normalizedDraft.length <= hardMaxChars) {
    return {
      output: normalizedDraft,
      strategy: "noop",
      wasReduced: false
    };
  }

  const paragraphs = splitParagraphs(normalizedDraft);
  if (paragraphs.length === 0) {
    return {
      output: sliceAtBoundary(normalizedDraft, hardMaxChars),
      strategy: "hard_slice",
      wasReduced: true
    };
  }

  const firstParagraph = paragraphs[0] ?? "";
  const hasTrailingCta = paragraphs.length > 1 && looksLikeCtaParagraph(paragraphs.at(-1) ?? "");
  const trailingCta = hasTrailingCta ? (paragraphs.at(-1) ?? "") : null;
  let bodyParagraphs = paragraphs.slice(1, trailingCta ? -1 : undefined);
  let strategy: DeterministicLengthReductionStrategy = "drop_paragraphs";

  let current = joinParagraphs([firstParagraph, ...bodyParagraphs, ...(trailingCta ? [trailingCta] : [])]);
  while (current.length > hardMaxChars && bodyParagraphs.length > 0) {
    bodyParagraphs = bodyParagraphs.slice(0, -1);
    current = joinParagraphs([firstParagraph, ...bodyParagraphs, ...(trailingCta ? [trailingCta] : [])]);
  }

  if (current.length <= hardMaxChars) {
    return {
      output: current,
      strategy,
      wasReduced: true
    };
  }

  const paragraphsToTrim = [firstParagraph, ...bodyParagraphs, ...(trailingCta ? [trailingCta] : [])];
  const trimOrder = [
    ...bodyParagraphs.map((_, index) => index + 1).reverse(),
    0,
    ...(trailingCta ? [paragraphsToTrim.length - 1] : [])
  ];

  for (const paragraphIndex of trimOrder) {
    while (current.length > hardMaxChars) {
      const sentences = splitSentences(paragraphsToTrim[paragraphIndex] ?? "");
      if (sentences.length <= 1) {
        break;
      }

      sentences.pop();
      paragraphsToTrim[paragraphIndex] = sentences.join(" ");
      current = joinParagraphs(paragraphsToTrim);
      strategy = "trim_sentences";
    }
  }

  if (current.length <= hardMaxChars) {
    return {
      output: current,
      strategy,
      wasReduced: true
    };
  }

  return {
    output: sliceAtBoundary(current, hardMaxChars),
    strategy: "hard_slice",
    wasReduced: true
  };
}
