import { z } from "zod";

export const analyzerOutputSchema = z.object({
  tech_stack: z.array(z.string()),
  writing_style_analysis: z.object({
    formality: z.number().min(1).max(10),
    enthusiasm: z.number().min(1).max(10),
    key_vocabulary: z.array(z.string()),
    sentence_structure: z.string()
  }),
  project_constraints: z.array(z.string())
});

export const criticOutputSchema = z
  .object({
    status: z.enum(["APPROVED", "NEEDS_REVISION"]),
    critique_points: z.array(z.string()).optional()
  })
  .superRefine((value, context) => {
    if (value.status === "NEEDS_REVISION" && (!value.critique_points || value.critique_points.length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "critique_points must be provided when status is NEEDS_REVISION",
        path: ["critique_points"]
      });
    }
  });

export type AnalyzerOutput = z.infer<typeof analyzerOutputSchema>;
export type CriticOutput = z.infer<typeof criticOutputSchema>;
