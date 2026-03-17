export const proposalEngineStepOrder = [
  "load_candidate_profile",
  "job_understanding",
  "retrieve_context",
  "select_evidence",
  "plan_proposal",
  "write_draft",
  "enforce_length",
  "critique",
  "revise_if_needed",
  "answer_questions"
] as const;

export type ProposalEngineStep = (typeof proposalEngineStepOrder)[number];

export type ProposalEngineProgressEventStatus = "started" | "completed";

export interface ProposalEngineProgressEvent {
  step: string;
  status: ProposalEngineProgressEventStatus;
  attempt: number;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
}

const proposalEngineStepLabels: Record<string, string> = {
  load_candidate_profile: "Load candidate profile",
  job_understanding: "Analyze job",
  retrieve_context: "Retrieve similar cases, fragments, and evidence",
  select_evidence: "Select grounded evidence",
  plan_proposal: "Build proposal plan",
  write_draft: "Write draft",
  enforce_length: "Fit cover letter to form limit",
  critique: "Evaluate draft",
  revise_if_needed: "Revise draft",
  answer_questions: "Answer proposal questions"
};

export function getProposalEngineStepLabel(step: string): string {
  return proposalEngineStepLabels[step] ?? step.replace(/_/g, " ");
}
