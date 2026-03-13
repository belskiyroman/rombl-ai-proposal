import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { extensionCandidatesResponseSchema } from "@/src/lib/extension-api";

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

export async function GET() {
  const candidates = await fetchQuery(api.profiles.listCandidateProfiles, {});
  const response = extensionCandidatesResponseSchema.parse({
    candidates
  });

  return Response.json(response, {
    status: 200,
    headers: corsHeaders
  });
}
