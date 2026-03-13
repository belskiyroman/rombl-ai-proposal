import { fetchMutation } from "convex/nextjs";
import { ZodError } from "zod";

import { api } from "@/convex/_generated/api";
import { extensionGenerateRequestSchema, extensionGenerateResponseSchema } from "@/src/lib/extension-api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
} as const;

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function POST(request: Request) {
  try {
    const payload = extensionGenerateRequestSchema.parse(await request.json());
    const result = await fetchMutation(api.generate.startProposalGeneration, {
      candidateId: payload.candidateId,
      jobInput: {
        title: payload.title,
        description: payload.description
      }
    });
    const response = extensionGenerateResponseSchema.parse(result);

    return Response.json(response, {
      status: 202,
      headers: corsHeaders
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        {
          message: "Invalid extension generation request",
          issues: error.issues.map((issue) => issue.message)
        },
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to start proposal generation";
    return Response.json(
      {
        message
      },
      {
        status: 502,
        headers: corsHeaders
      }
    );
  }
}
