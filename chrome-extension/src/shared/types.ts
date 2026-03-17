export interface ExtensionCapturedJob {
  sourceSite: "upwork";
  sourceUrl: string;
  pageTitle: string;
  jobTitle: string;
  jobDescription: string;
  proposalQuestions: Array<{
    position: number;
    prompt: string;
  }>;
  capturedAt: number;
  parserMeta: {
    skillsCount: number;
    projectType: "hourly" | "fixedPrice" | "hourly/fixedPrice";
  };
}

export interface ExtensionPanelState {
  tabId: number;
  capturedJob: ExtensionCapturedJob | null;
  selectedCandidateId: number | null;
  activeProgressId: string | null;
  autofillStatus:
    | {
        status: "SUCCESS" | "FAILED";
        message: string;
      }
    | null;
  latestStatus: {
    status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
    currentStepLabel: string | null;
    startedAt?: number;
    totalDurationMs?: number;
    errorMessage?: string;
    steps: Array<{
      step: string;
      label: string;
      status: "RUNNING" | "COMPLETED" | "FAILED";
      durationMs?: number;
    }>;
  } | null;
  finalResult: {
    generationRunId: string;
    finalProposal: string;
    coverLetterCharCount: number;
    questionAnswers: Array<{
      position: number;
      prompt: string;
      answer: string;
    }>;
    unresolvedQuestions: Array<{
      position: number;
      prompt: string;
      reason: string;
    }>;
    approvalStatus: "APPROVED" | "NEEDS_REVISION";
    createdAt: number;
  } | null;
  errorMessage: string | null;
}

export type ContentExtractionRequest = {
  type: "extract-job";
};

export type ContentFillSubmissionRequest = {
  type: "fill-generated-submission";
  payload: {
    coverLetter: string;
    questionAnswers: Array<{
      position: number;
      prompt: string;
      answer: string;
    }>;
    unresolvedQuestions: Array<{
      position: number;
      prompt: string;
      reason: string;
    }>;
  };
};

export type ContentExtractionResponse =
  | {
      status: "success";
      payload: ExtensionCapturedJob;
    }
  | {
      status: "unsupported";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export type ContentFillSubmissionResponse =
  | {
      status: "success";
    }
  | {
      status: "error";
      message: string;
    };

export type BackgroundOpenRequest = {
  type: "open-in-generator";
  payload: ExtensionCapturedJob;
};

export type BackgroundOpenResponse =
  | {
      status: "success";
      handoffId: string;
      generateUrl: string;
    }
  | {
      status: "error";
      message: string;
    };

export type BackgroundPanelRequest = {
  type: "clear-tab-state";
  tabId: number;
};
