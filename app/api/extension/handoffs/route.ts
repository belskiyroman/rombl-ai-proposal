import { fetchMutation } from "convex/nextjs";
import { ZodError } from "zod";

import { api } from "@/convex/_generated/api";
import { buildGenerateUrl, generationHandoffCreateRequestSchema, generationHandoffCreateResponseSchema } from "@/src/lib/generation-handoff";

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
    const payload = generationHandoffCreateRequestSchema.parse(await request.json());
    const handoffId = await fetchMutation(api.handoffs.createGenerationHandoff, payload);
    const generateUrl = buildGenerateUrl(new URL(request.url).origin, handoffId);
    const response = generationHandoffCreateResponseSchema.parse({
      handoffId,
      generateUrl
    });

    return Response.json(response, {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        {
          message: "Invalid extension handoff payload",
          issues: error.issues.map((issue) => issue.message)
        },
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to create handoff";

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
