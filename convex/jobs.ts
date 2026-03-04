import { actionGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

import { createOpenAIAgentRunners } from "../src/lib/ai/agents";
import { runAnalyzerOnlyGraph } from "../src/lib/ai/graph";
import { generateEmbedding } from "../src/lib/ai/embeddings";
import { createInitialState, type RagContextItem } from "../src/lib/ai/state";
import {
  ingestionInputSchema,
  parseProposalPrice,
  processedProposalDocumentSchema,
  rawJobDocumentSchema,
  styleProfileDocumentSchema,
  type AnalyzerOutput,
  type IngestionInput,
  type ProcessedProposalDocument,
  type RawJobDocument,
  type StyleProfileDocument
} from "../src/lib/ai/types";

const sourceValidator = v.union(v.literal("manual"), v.literal("chrome_extension"));
const projectTypeValidator = v.union(v.literal("hourly"), v.literal("fixedPrice"), v.literal("hourly/fixedPrice"));
const writingStyleAnalysisValidator = v.object({
  formality: v.float64(),
  enthusiasm: v.float64(),
  keyVocabulary: v.array(v.string()),
  sentenceStructure: v.string()
});

const jobValidator = v.object({
  id: v.float64(),
  clientLocation: v.string(),
  clientReview: v.float64(),
  clientReviewAmount: v.float64(),
  clientTotalSpent: v.float64(),
  type: projectTypeValidator,
  skills: v.array(v.string()),
  title: v.string(),
  text: v.string()
});

const proposalValidator = v.object({
  id: v.float64(),
  jobId: v.float64(),
  viewed: v.boolean(),
  interview: v.boolean(),
  offer: v.boolean(),
  price: v.string(),
  agency: v.boolean(),
  memberId: v.float64(),
  text: v.string()
});

const memberValidator = v.object({
  id: v.float64(),
  name: v.string(),
  agency: v.boolean(),
  agencyName: v.optional(v.string()),
  talentBadge: v.optional(v.string()),
  jss: v.float64(),
  location: v.string()
});

export interface IngestJobProposalPairArgs extends IngestionInput {
  embeddingModel?: string;
  chatModel?: string;
}

export interface AnalyzerGraphOutput extends AnalyzerOutput {
  executionTrace: string[];
}

export interface IngestJobProposalPairResult {
  rawJobId: string;
  styleProfileId: string;
  processedProposalId: string;
  executionTrace: string[];
}

export interface IngestJobProposalPairDependencies {
  embed: (input: string) => Promise<number[]>;
  runAnalyzerGraph: (input: {
    newJobDescription: string;
    ragContext: RagContextItem[];
  }) => Promise<AnalyzerGraphOutput>;
  insertRawJob: (document: RawJobDocument) => Promise<string>;
  insertStyleProfile: (document: StyleProfileDocument) => Promise<string>;
  insertProcessedProposal: (document: ProcessedProposalDocument) => Promise<string>;
  now?: () => number;
}

export async function runIngestJobProposalPair(
  args: IngestJobProposalPairArgs,
  dependencies: IngestJobProposalPairDependencies
): Promise<IngestJobProposalPairResult> {
  const parsedInput = ingestionInputSchema.parse({
    ...args,
    source: args.source ?? "manual"
  });
  const createdAt = (dependencies.now ?? Date.now)();

  const [embedding, analyzerResult] = await Promise.all([
    dependencies.embed(parsedInput.job.text),
    dependencies.runAnalyzerGraph({
      newJobDescription: parsedInput.job.text,
      ragContext: [
        {
          jobText: parsedInput.job.text,
          proposalText: parsedInput.proposal.text,
          similarity: 1
        }
      ]
    })
  ]);

  const rawJobDocument = rawJobDocumentSchema.parse({
    source: parsedInput.source,
    externalJobId: parsedInput.job.id,
    clientLocation: parsedInput.job.clientLocation,
    clientReview: parsedInput.job.clientReview,
    clientReviewAmount: parsedInput.job.clientReviewAmount,
    clientTotalSpent: parsedInput.job.clientTotalSpent,
    projectType: parsedInput.job.type,
    skills: parsedInput.job.skills,
    title: parsedInput.job.title,
    text: parsedInput.job.text,
    embedding,
    techStack: analyzerResult.tech_stack,
    projectConstraints: analyzerResult.project_constraints,
    memberId: parsedInput.member.id,
    createdAt,
    updatedAt: createdAt
  });
  const rawJobId = await dependencies.insertRawJob(rawJobDocument);

  const styleProfileDocument = styleProfileDocumentSchema.parse({
    source: parsedInput.source,
    memberId: parsedInput.member.id,
    memberName: parsedInput.member.name,
    memberLocation: parsedInput.member.location,
    agency: parsedInput.member.agency,
    agencyName: parsedInput.member.agencyName,
    talentBadge: parsedInput.member.talentBadge,
    jss: parsedInput.member.jss,
    writingStyleAnalysis: {
      formality: analyzerResult.writing_style_analysis.formality,
      enthusiasm: analyzerResult.writing_style_analysis.enthusiasm,
      keyVocabulary: analyzerResult.writing_style_analysis.key_vocabulary,
      sentenceStructure: analyzerResult.writing_style_analysis.sentence_structure
    },
    keyVocabulary: analyzerResult.writing_style_analysis.key_vocabulary,
    sentenceStructure: analyzerResult.writing_style_analysis.sentence_structure,
    createdAt,
    updatedAt: createdAt
  });
  const styleProfileId = await dependencies.insertStyleProfile(styleProfileDocument);

  const processedProposalDocument = processedProposalDocumentSchema.parse({
    source: parsedInput.source,
    externalProposalId: parsedInput.proposal.id,
    externalJobId: parsedInput.job.id,
    memberId: parsedInput.member.id,
    viewed: parsedInput.proposal.viewed,
    interview: parsedInput.proposal.interview,
    offer: parsedInput.proposal.offer,
    price: parsedInput.proposal.price,
    priceAmount: parseProposalPrice(parsedInput.proposal.price),
    agency: parsedInput.proposal.agency,
    text: parsedInput.proposal.text,
    rawJobId,
    styleProfileId,
    createdAt,
    updatedAt: createdAt
  });
  const processedProposalId = await dependencies.insertProcessedProposal(processedProposalDocument);

  return {
    rawJobId,
    styleProfileId,
    processedProposalId,
    executionTrace: analyzerResult.executionTrace
  };
}

export const insertRawJobRecord = mutationGeneric({
  args: {
    document: v.object({
      source: sourceValidator,
      externalJobId: v.float64(),
      clientLocation: v.string(),
      clientReview: v.float64(),
      clientReviewAmount: v.float64(),
      clientTotalSpent: v.float64(),
      projectType: projectTypeValidator,
      skills: v.array(v.string()),
      title: v.string(),
      text: v.string(),
      embedding: v.array(v.float64()),
      techStack: v.array(v.string()),
      projectConstraints: v.array(v.string()),
      memberId: v.float64(),
      createdAt: v.float64(),
      updatedAt: v.float64()
    })
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("raw_jobs", args.document);
  }
});

export const insertStyleProfileRecord = mutationGeneric({
  args: {
    document: v.object({
      source: sourceValidator,
      memberId: v.float64(),
      memberName: v.string(),
      memberLocation: v.string(),
      agency: v.boolean(),
      agencyName: v.optional(v.string()),
      talentBadge: v.optional(v.string()),
      jss: v.float64(),
      writingStyleAnalysis: writingStyleAnalysisValidator,
      keyVocabulary: v.array(v.string()),
      sentenceStructure: v.string(),
      createdAt: v.float64(),
      updatedAt: v.float64()
    })
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("style_profiles", args.document);
  }
});

export const insertProcessedProposalRecord = mutationGeneric({
  args: {
    document: v.object({
      source: sourceValidator,
      externalProposalId: v.float64(),
      externalJobId: v.float64(),
      memberId: v.float64(),
      viewed: v.boolean(),
      interview: v.boolean(),
      offer: v.boolean(),
      price: v.string(),
      priceAmount: v.float64(),
      agency: v.boolean(),
      text: v.string(),
      rawJobId: v.id("raw_jobs"),
      styleProfileId: v.id("style_profiles"),
      createdAt: v.float64(),
      updatedAt: v.float64()
    })
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("processed_proposals", args.document);
  }
});

export const ingestJobProposalPair = actionGeneric({
  args: {
    source: v.optional(sourceValidator),
    job: jobValidator,
    proposal: proposalValidator,
    member: memberValidator,
    embeddingModel: v.optional(v.string()),
    chatModel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const runners = createOpenAIAgentRunners(args.chatModel);

    return runIngestJobProposalPair(
      {
        source: args.source ?? "manual",
        job: {
          id: args.job.id,
          clientLocation: args.job.clientLocation,
          clientReview: args.job.clientReview,
          clientReviewAmount: args.job.clientReviewAmount,
          clientTotalSpent: args.job.clientTotalSpent,
          type: args.job.type,
          skills: args.job.skills,
          title: args.job.title,
          text: args.job.text
        },
        proposal: {
          id: args.proposal.id,
          jobId: args.proposal.jobId,
          viewed: args.proposal.viewed,
          interview: args.proposal.interview,
          offer: args.proposal.offer,
          price: args.proposal.price,
          agency: args.proposal.agency,
          memberId: args.proposal.memberId,
          text: args.proposal.text
        },
        member: {
          id: args.member.id,
          name: args.member.name,
          agency: args.member.agency,
          agencyName: args.member.agencyName,
          talentBadge: args.member.talentBadge,
          jss: args.member.jss,
          location: args.member.location
        }
      },
      {
        embed: (input) =>
          generateEmbedding(input, {
            model: args.embeddingModel
          }),
        runAnalyzerGraph: async (graphInput) => {
          const state = await runAnalyzerOnlyGraph(
            {
              ...createInitialState(graphInput.newJobDescription),
              ragContext: graphInput.ragContext
            },
            {
              analyzer: {
                analyzer: runners.analyzer
              }
            }
          );

          if (!state.styleProfile) {
            throw new Error("Analyzer graph did not produce a style profile.");
          }

          return {
            ...state.styleProfile,
            executionTrace: state.executionTrace
          };
        },
        insertRawJob: (document) =>
          (ctx.runMutation as (mutation: unknown, args: unknown) => Promise<string>)(insertRawJobRecord, {
            document
          }),
        insertStyleProfile: (document) =>
          (ctx.runMutation as (mutation: unknown, args: unknown) => Promise<string>)(insertStyleProfileRecord, {
            document
          }),
        insertProcessedProposal: (document) =>
          (ctx.runMutation as (mutation: unknown, args: unknown) => Promise<string>)(insertProcessedProposalRecord, {
            document: {
              ...document,
              rawJobId: document.rawJobId as unknown as string,
              styleProfileId: document.styleProfileId as unknown as string
            }
          })
      }
    );
  }
});
