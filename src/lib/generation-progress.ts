export type GenerationProgressStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export interface GenerationProgressStep {
  step: string;
  label: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  attempt: number;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
}

export interface GenerationProgressCurrentStep {
  step: string;
  label: string;
  attempt: number;
  startedAt: number;
}

export interface GenerationProgressData {
  _id: string;
  candidateId: number;
  jobInput: {
    title?: string;
    description: string;
  };
  status: GenerationProgressStatus;
  currentStep: GenerationProgressCurrentStep | null;
  steps: GenerationProgressStep[];
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  totalDurationMs?: number;
  errorMessage?: string;
  generationRunId?: string | null;
}
