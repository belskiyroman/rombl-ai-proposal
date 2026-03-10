import { z } from "zod";

export const candidateProfileFormSchema = z.object({
  candidateId: z.coerce.number().int().positive("Candidate ID must be positive"),
  displayName: z.string().trim().min(1, "Display name is required"),
  positioningSummary: z.string().trim().min(40, "Add a richer positioning summary"),
  toneProfile: z.enum(["concise", "consultative", "confident", "technical", "founder-like"]),
  coreDomains: z.array(z.string().trim().min(1)).min(1, "Add at least one domain"),
  preferredCtaStyle: z.string().trim().min(1, "Preferred CTA style is required"),
  seniority: z.string().trim().optional(),
  availability: z.string().trim().optional(),
  location: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

export const candidateEvidenceFormSchema = z.object({
  candidateId: z.coerce.number().int().positive("Candidate ID must be positive"),
  rawEvidenceText: z.string().trim().min(20, "Paste candidate evidence or experience notes")
});

export const historicalCaseFormSchema = z.object({
  candidateId: z.coerce.number().int().positive("Candidate ID must be positive"),
  jobTitle: z.string().trim().min(1, "Job title is required"),
  jobDescription: z.string().trim().min(40, "Provide the full job description"),
  proposalText: z.string().trim().min(40, "Provide the historical proposal"),
  reply: z.boolean(),
  interview: z.boolean(),
  hired: z.boolean()
});

export type CandidateProfileFormValues = z.infer<typeof candidateProfileFormSchema>;
export type CandidateEvidenceFormValues = z.infer<typeof candidateEvidenceFormSchema>;
export type HistoricalCaseFormValues = z.infer<typeof historicalCaseFormSchema>;
