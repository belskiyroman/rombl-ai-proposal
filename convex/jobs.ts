import { actionGeneric, internalMutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

import { createOpenAIAgentRunners } from "../src/lib/ai/agents";
import { runAnalyzerOnlyGraph } from "../src/lib/ai/graph";
import { generateEmbedding } from "../src/lib/ai/embeddings";
import { normalizeJobDescription } from "../src/lib/ai/job-description-normalizer";
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
  jobLink: v.optional(v.string()),
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
  fastModel?: string;
  reasoningModel?: string;
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

type RunMutationInvoker = (mutation: unknown, args: unknown) => Promise<string>;

interface PairListProcessedProposal {
  _id: string;
  externalProposalId: number;
  externalJobId?: number;
  memberId: number;
  viewed: boolean;
  interview: boolean;
  offer: boolean;
  price: string;
  priceAmount: number;
  agency: boolean;
  text?: string;
  rawJobId: string;
  styleProfileId: string;
  createdAt: number;
}

interface PairListRawJob {
  _id: string;
  externalJobId?: number;
  title: string;
  clientLocation: string;
  clientReview: number;
  clientTotalSpent: number;
  techStack: string[];
}

interface PairListStyleProfile {
  _id: string;
  memberId: number;
  memberName: string;
  memberLocation: string;
  jss: number;
  talentBadge?: string;
}

export interface PairListItem {
  processedProposalId: string;
  rawJobId: string;
  styleProfileId: string;
  createdAt: number;
  job: {
    externalJobId: number;
    title: string;
    clientLocation: string;
    clientReview: number;
    clientTotalSpent: number;
    techStack: string[];
  };
  proposal: {
    externalProposalId: number;
    externalJobId: number;
    memberId: number;
    viewed: boolean;
    interview: boolean;
    offer: boolean;
    agency: boolean;
    price: string;
    priceAmount: number;
  };
  styleProfile: {
    memberId: number;
    memberName: string;
    memberLocation: string;
    jss: number;
    talentBadge?: string;
  };
}

export function buildPairsList({
  processedProposals,
  rawJobs,
  styleProfiles
}: {
  processedProposals: PairListProcessedProposal[];
  rawJobs: PairListRawJob[];
  styleProfiles: PairListStyleProfile[];
}): PairListItem[] {
  const rawJobsById = new Map(rawJobs.map((job) => [String(job._id), job]));
  const styleProfilesById = new Map(styleProfiles.map((profile) => [String(profile._id), profile]));
  const pairs: PairListItem[] = [];

  for (const proposal of processedProposals) {
    const rawJob = rawJobsById.get(String(proposal.rawJobId));
    const styleProfile = styleProfilesById.get(String(proposal.styleProfileId));

    if (!rawJob || !styleProfile) {
      continue;
    }

    const resolvedExternalJobId =
      rawJob.externalJobId ?? proposal.externalJobId ?? proposal.externalProposalId;

    pairs.push({
      processedProposalId: String(proposal._id),
      rawJobId: String(rawJob._id),
      styleProfileId: String(styleProfile._id),
      createdAt: proposal.createdAt,
      job: {
        externalJobId: resolvedExternalJobId,
        title: rawJob.title,
        clientLocation: rawJob.clientLocation,
        clientReview: rawJob.clientReview,
        clientTotalSpent: rawJob.clientTotalSpent,
        techStack: rawJob.techStack
      },
      proposal: {
        externalProposalId: proposal.externalProposalId,
        externalJobId: proposal.externalJobId ?? resolvedExternalJobId,
        memberId: proposal.memberId,
        viewed: proposal.viewed,
        interview: proposal.interview,
        offer: proposal.offer,
        agency: proposal.agency,
        price: proposal.price,
        priceAmount: proposal.priceAmount
      },
      styleProfile: {
        memberId: styleProfile.memberId,
        memberName: styleProfile.memberName,
        memberLocation: styleProfile.memberLocation,
        jss: styleProfile.jss,
        talentBadge: styleProfile.talentBadge
      }
    });
  }

  return pairs.sort((left, right) => right.createdAt - left.createdAt);
}

export function createIngestionMutationAdapters(runMutation: RunMutationInvoker): Pick<
  IngestJobProposalPairDependencies,
  "insertRawJob" | "insertStyleProfile" | "insertProcessedProposal"
> {
  return {
    insertRawJob: (document) => runMutation(internal.jobs.insertRawJobRecord, { document }),
    insertStyleProfile: (document) => runMutation(internal.jobs.insertStyleProfileRecord, { document }),
    insertProcessedProposal: (document) =>
      runMutation(internal.jobs.insertProcessedProposalRecord, {
        document
      })
  };
}

export const getPairs = queryGeneric({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 100));
    const processedProposals = await ctx.db
      .query("processed_proposals")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);

    if (processedProposals.length === 0) {
      return [];
    }

    const rawJobIds = [...new Set(processedProposals.map((proposal) => proposal.rawJobId))];
    const styleProfileIds = [...new Set(processedProposals.map((proposal) => proposal.styleProfileId))];

    const [rawJobs, styleProfiles] = await Promise.all([
      Promise.all(rawJobIds.map((id) => ctx.db.get(id))),
      Promise.all(styleProfileIds.map((id) => ctx.db.get(id)))
    ]);

    return buildPairsList({
      processedProposals: processedProposals.map((proposal) => ({
        _id: String(proposal._id),
        externalProposalId: proposal.externalProposalId,
        externalJobId: proposal.externalJobId,
        memberId: proposal.memberId,
        viewed: proposal.viewed,
        interview: proposal.interview,
        offer: proposal.offer,
        price: proposal.price,
        priceAmount: proposal.priceAmount,
        agency: proposal.agency,
        rawJobId: String(proposal.rawJobId),
        styleProfileId: String(proposal.styleProfileId),
        createdAt: proposal.createdAt
      })),
      rawJobs: rawJobs
        .filter((job): job is NonNullable<typeof job> => job !== null)
        .map((job) => ({
          _id: String(job._id),
          externalJobId: job.externalJobId,
          title: job.title,
          clientLocation: job.clientLocation,
          clientReview: job.clientReview,
          clientTotalSpent: job.clientTotalSpent,
          techStack: job.techStack
        })),
      styleProfiles: styleProfiles
        .filter((profile): profile is NonNullable<typeof profile> => profile !== null)
        .map((profile) => ({
          _id: String(profile._id),
          memberId: profile.memberId,
          memberName: profile.memberName,
          memberLocation: profile.memberLocation,
          jss: profile.jss,
          talentBadge: profile.talentBadge
        }))
    });
  }
});

export const getPairDetail = queryGeneric({
  args: {
    id: v.id("processed_proposals")
  },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.id);
    if (!proposal) return null;

    const job = await ctx.db.get(proposal.rawJobId);
    if (!job) return null;

    const styleProfile = await ctx.db.get(proposal.styleProfileId);
    if (!styleProfile) return null;

    return {
      processedProposalId: proposal._id,
      createdAt: proposal.createdAt,
      job: {
        jobLink: job.jobLink ?? "",
        title: job.title,
        clientLocation: job.clientLocation,
        clientReview: job.clientReview,
        clientReviewAmount: job.clientReviewAmount,
        clientTotalSpent: job.clientTotalSpent,
        skills: job.skills,
        text: job.text,
        type: job.projectType
      },
      proposal: {
        id: proposal.externalProposalId,
        price: proposal.price,
        viewed: proposal.viewed,
        interview: proposal.interview,
        offer: proposal.offer,
        agency: proposal.agency,
        text: proposal.text,
        memberId: proposal.memberId
      },
      member: {
        id: styleProfile.memberId,
        name: styleProfile.memberName,
        location: styleProfile.memberLocation,
        jss: styleProfile.jss,
        talentBadge: styleProfile.talentBadge ?? "",
        agency: styleProfile.agency,
        agencyName: styleProfile.agencyName ?? ""
      }
    };
  }
});

export async function runIngestJobProposalPair(
  args: IngestJobProposalPairArgs,
  dependencies: IngestJobProposalPairDependencies
): Promise<IngestJobProposalPairResult> {
  const parsedInput = ingestionInputSchema.parse({
    ...args,
    source: args.source ?? "manual"
  });
  const createdAt = (dependencies.now ?? Date.now)();
  const normalizedJob = normalizeJobDescription(parsedInput.job.text);
  if (normalizedJob.metadata.wasTruncated) {
    console.warn(
      `[jobs.ingestJobProposalPair] Truncated job description from ${normalizedJob.metadata.originalLength} to ${normalizedJob.metadata.finalLength} chars.`
    );
  }

  const [embedding, analyzerResult] = await Promise.all([
    dependencies.embed(normalizedJob.text),
    dependencies.runAnalyzerGraph({
      newJobDescription: normalizedJob.text,
      ragContext: [
        {
          jobText: normalizedJob.text,
          proposalText: parsedInput.proposal.text,
          similarity: 1
        }
      ]
    })
  ]);

  const rawJobDocument = rawJobDocumentSchema.parse({
    source: parsedInput.source,
    jobLink: parsedInput.job.jobLink,
    clientLocation: parsedInput.job.clientLocation,
    clientReview: parsedInput.job.clientReview,
    clientReviewAmount: parsedInput.job.clientReviewAmount,
    clientTotalSpent: parsedInput.job.clientTotalSpent,
    projectType: parsedInput.job.type,
    skills: parsedInput.job.skills,
    title: parsedInput.job.title,
    text: normalizedJob.text,
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

export const insertRawJobRecord = internalMutationGeneric({
  args: {
    document: v.object({
      source: sourceValidator,
      externalJobId: v.optional(v.float64()),
      jobLink: v.optional(v.string()),
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

export const insertStyleProfileRecord = internalMutationGeneric({
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

export const insertProcessedProposalRecord = internalMutationGeneric({
  args: {
    document: v.object({
      source: sourceValidator,
      externalProposalId: v.float64(),
      externalJobId: v.optional(v.float64()),
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
    fastModel: v.optional(v.string()),
    reasoningModel: v.optional(v.string()),
    chatModel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const runners = createOpenAIAgentRunners({
      fastModel: args.fastModel ?? args.chatModel,
      reasoningModel: args.reasoningModel ?? args.chatModel
    });
    const mutationAdapters = createIngestionMutationAdapters(
      (mutation, mutationArgs) =>
        (ctx.runMutation as (mutationRef: unknown, args: unknown) => Promise<string>)(mutation, mutationArgs)
    );

    return runIngestJobProposalPair(
      {
        source: args.source ?? "manual",
        job: {
          jobLink: args.job.jobLink,
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
        ...mutationAdapters
      }
    );
  }
});
