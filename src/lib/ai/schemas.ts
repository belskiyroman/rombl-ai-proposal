import { z } from "zod";
import { analyzerOutputSchema } from "./types";

export { analyzerOutputSchema };

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
