import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { extensionGenerateStatusQuerySchema, extensionGenerateStatusResponseSchema } from "@/src/lib/extension-api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
} as const;

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = extensionGenerateStatusQuerySchema.safeParse({
    id: searchParams.get("id")
  });

  if (!parsed.success) {
    return Response.json(
      {
        message: "Missing or invalid progress id"
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }

  const progress = await fetchQuery(api.generate.getGenerationProgressById, {
    id: parsed.data.id
  });

  if (!progress) {
    return Response.json(
      {
        message: "Generation progress not found"
      },
      {
        status: 404,
        headers: corsHeaders
      }
    );
  }

  const result =
    progress.generationRunId == null
      ? null
      : await fetchQuery(api.runs.getGenerationRunById, {
          id: progress.generationRunId
        });

  const response = extensionGenerateStatusResponseSchema.parse({
    progress,
    result:
      result == null
        ? null
        : {
            generationRunId: result.generationRunId,
            finalProposal: result.finalProposal,
            approvalStatus: result.approvalStatus,
            createdAt: result.createdAt
          }
  });

  return Response.json(response, {
    status: 200,
    headers: corsHeaders
  });
}
