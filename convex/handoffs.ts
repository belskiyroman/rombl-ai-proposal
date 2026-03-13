import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

import { generationHandoffTtlMs, type GenerationHandoffLookupResult, type StoredGenerationHandoff } from "../src/lib/generation-handoff";

export function buildGenerationHandoffDocument(args: {
  sourceSite: "upwork";
  sourceUrl: string;
  pageTitle: string;
  jobTitle: string;
  jobDescription: string;
  capturedAt: number;
  createdAt: number;
}) {
  return {
    sourceSite: args.sourceSite,
    sourceUrl: args.sourceUrl,
    pageTitle: args.pageTitle,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
    capturedAt: args.capturedAt,
    createdAt: args.createdAt,
    expiresAt: args.createdAt + generationHandoffTtlMs
  };
}

export function resolveGenerationHandoffRecord(
  record: StoredGenerationHandoff | null,
  now: number
): GenerationHandoffLookupResult {
  if (!record) {
    return {
      status: "missing"
    };
  }

  if (record.expiresAt <= now) {
    return {
      status: "expired"
    };
  }

  return {
    status: "available",
    handoff: record
  };
}

export const createGenerationHandoff = mutationGeneric({
  args: {
    sourceSite: v.literal("upwork"),
    sourceUrl: v.string(),
    pageTitle: v.string(),
    jobTitle: v.string(),
    jobDescription: v.string(),
    capturedAt: v.float64()
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    const document = buildGenerationHandoffDocument({
      ...args,
      createdAt
    });

    const handoffId = await ctx.db.insert("generation_handoffs", document);
    return String(handoffId);
  }
});

export const getGenerationHandoff = queryGeneric({
  args: {
    id: v.string()
  },
  handler: async (ctx, args) => {
    const normalizedId = ctx.db.normalizeId("generation_handoffs", args.id);
    if (!normalizedId) {
      return {
        status: "invalid" as const
      };
    }

    const record = await ctx.db.get(normalizedId);
    const resolved = resolveGenerationHandoffRecord(
      record
        ? ({
            _id: String(record._id),
            ...record
          } satisfies StoredGenerationHandoff)
        : null,
      Date.now()
    );

    return resolved;
  }
});
