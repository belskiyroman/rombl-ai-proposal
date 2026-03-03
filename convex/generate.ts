import { actionGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { createOpenAIAgentRunners } from "../src/lib/ai/agents";
import { generateEmbedding } from "../src/lib/ai/embeddings";
import { runProposalGraph } from "../src/lib/ai/graph";
import {
  createInitialState,
  defaultMaxRevisions,
  type ProposalGraphState,
  type RagContextItem
} from "../src/lib/ai/state";

export interface GenerateProposalArgs {
  newJobDescription: string;
  maxRevisions?: number;
  embeddingModel?: string;
  chatModel?: string;
}

export interface GenerateProposalResult {
  finalProposal: string;
  criticStatus: "APPROVED" | "NEEDS_REVISION";
  critiquePoints?: string[];
  executionTrace: string[];
  state: ProposalGraphState;
}

export interface GenerateProposalDependencies {
  embed: (input: string) => Promise<number[]>;
  searchRag: (embedding: number[], jobDescription: string) => Promise<RagContextItem[]>;
  runGraph: (initialState: ProposalGraphState) => Promise<ProposalGraphState>;
}

export async function runGenerateProposal(
  args: GenerateProposalArgs,
  dependencies: GenerateProposalDependencies
): Promise<GenerateProposalResult> {
  const embedding = await dependencies.embed(args.newJobDescription);
  const ragContext = await dependencies.searchRag(embedding, args.newJobDescription);

  const initialState: ProposalGraphState = {
    ...createInitialState(args.newJobDescription),
    ragContext,
    maxRevisions: args.maxRevisions ?? defaultMaxRevisions
  };

  const state = await dependencies.runGraph(initialState);
  const criticStatus = state.criticFeedback?.status ?? "NEEDS_REVISION";

  return {
    finalProposal: state.proposalDraft,
    criticStatus,
    critiquePoints: state.criticFeedback?.critique_points,
    executionTrace: state.executionTrace,
    state
  };
}

export const searchSimilarPairs = queryGeneric({
  args: {
    embedding: v.array(v.float64()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 4, 8));
    const docs = await ctx.db.query("jobProposalPairs").take(200);

    return docs
      .map((doc) => ({
        jobText: doc.jobText,
        proposalText: doc.proposalText,
        similarity: cosineSimilarity(args.embedding, doc.embedding)
      }))
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, limit);
  }
});

function cosineSimilarity(left: number[], right: number[]): number {
  const size = Math.min(left.length, right.length);
  if (size === 0) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < size; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export const generateProposal = actionGeneric({
  args: {
    newJobDescription: v.string(),
    maxRevisions: v.optional(v.number()),
    embeddingModel: v.optional(v.string()),
    chatModel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const runners = createOpenAIAgentRunners(args.chatModel);

    return runGenerateProposal(args, {
      embed: (input) =>
        generateEmbedding(input, {
          model: args.embeddingModel
        }),
      searchRag: (embedding) =>
        (ctx.runQuery as (query: unknown, args: unknown) => Promise<RagContextItem[]>)(searchSimilarPairs, {
          embedding,
          limit: 4
        }),
      runGraph: (initialState) =>
        runProposalGraph(initialState, {
          analyzer: {
            analyzer: runners.analyzer
          },
          writer: {
            writer: runners.writer
          },
          critic: {
            critic: runners.critic
          }
        })
    });
  }
});
