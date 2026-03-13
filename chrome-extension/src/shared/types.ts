export interface ExtensionCapturedJob {
  sourceSite: "upwork";
  sourceUrl: string;
  pageTitle: string;
  jobTitle: string;
  jobDescription: string;
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
    approvalStatus: "APPROVED" | "NEEDS_REVISION";
    createdAt: number;
  } | null;
  errorMessage: string | null;
}

export type ContentExtractionRequest = {
  type: "extract-job";
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
