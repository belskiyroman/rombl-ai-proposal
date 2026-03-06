import { z } from "zod";

/**
 * Zod schema for the Ingestion Form (react-hook-form).
 *
 * This is a frontend-friendly version of the schemas in `src/lib/ai/types.ts`.
 * Some server-side strict validations (e.g., country-code regex) are relaxed
 * to improve form UX — the Convex action will re-validate on the server.
 */

export const jobFormSchema = z.object({
    jobLink: z.string().trim().optional(),
    clientLocation: z.string().trim().min(1, "Required"),
    clientReview: z.coerce.number().min(0).max(5, "Max 5"),
    clientReviewAmount: z.coerce.number().int().nonnegative(),
    clientTotalSpent: z.coerce.number().nonnegative(),
    type: z.enum(["hourly", "fixedPrice", "hourly/fixedPrice"], {
        required_error: "Select project type"
    }),
    skills: z.array(z.string().trim().min(1)).min(1, "At least one skill required"),
    title: z.string().trim().min(1, "Required"),
    text: z.string().trim().min(1, "Required")
});

export const proposalFormSchema = z.object({
    id: z.coerce.number().int().nonnegative(),
    viewed: z.boolean(),
    interview: z.boolean(),
    offer: z.boolean(),
    price: z.string().trim().min(1, "Required"),
    agency: z.boolean(),
    memberId: z.coerce.number().int().positive({ message: "Member ID must be a positive integer" }),
    text: z.string().trim().min(1, "Required")
});

export const memberFormSchema = z.object({
    id: z.coerce.number().int().positive({ message: "Member ID must be a positive integer" }),
    name: z.string().trim().optional(),
    agency: z.boolean().optional(),
    agencyName: z.string().trim().optional(),
    talentBadge: z.string().trim().optional(),
    jss: z.coerce.number().min(0).max(100, "Max 100").optional(),
    location: z.string().trim().optional()
});

export const ingestionFormSchema = z.object({
    job: jobFormSchema,
    proposal: proposalFormSchema,
    member: memberFormSchema
});

export type IngestionFormValues = z.infer<typeof ingestionFormSchema>;

/**
 * Schema for the "Paste JSON" raw input mode.
 * Accepts a JSON string that should parse into IngestionFormValues.
 */
export const pasteJsonSchema = z.object({
    rawJson: z.string().min(1, "Paste JSON data")
});

export type PasteJsonValues = z.infer<typeof pasteJsonSchema>;

/**
 * Schema for the "Paste HTML" raw input mode.
 * Accepts raw Upwork job listing HTML to be parsed into job fields.
 */
export const pasteHtmlSchema = z.object({
    rawHtml: z.string().min(1, "Paste Upwork job HTML")
});

export type PasteHtmlValues = z.infer<typeof pasteHtmlSchema>;
