import {
  buildExtensionCandidatesApiUrl,
  buildExtensionGenerateApiUrl,
  buildExtensionGenerateStatusApiUrl,
  buildGenerationRunUrl,
  buildJobPreviewMeta,
  parseExtensionCandidatesResponse,
  parseExtensionGenerateResponse,
  parseExtensionGenerateStatusResponse,
  validateExtensionGenerateRequest
} from "./shared/helpers";
import { clearStoredPanelState, getStoredAppBaseUrl, getStoredPanelState, setStoredPanelState } from "./shared/storage";
import type {
  ContentExtractionResponse,
  ContentFillSubmissionResponse,
  ExtensionCapturedJob,
  ExtensionPanelState
} from "./shared/types";
import { isUpworkJobUrl } from "../../src/lib/job-import/upwork";

type CandidateSummary = ReturnType<typeof parseExtensionCandidatesResponse>["candidates"][number];

const pollIntervalMs = 1500;

function queryRequired<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Side panel is missing required DOM node: ${selector}`);
  }

  return element;
}

const panelStatus = queryRequired<HTMLParagraphElement>("#panelStatus");
const sourceLink = queryRequired<HTMLAnchorElement>("#sourceLink");
const sourceMeta = queryRequired<HTMLParagraphElement>("#sourceMeta");
const candidateSelect = queryRequired<HTMLSelectElement>("#candidateSelect");
const jobTitleInput = queryRequired<HTMLInputElement>("#jobTitle");
const jobDescriptionInput = queryRequired<HTMLTextAreaElement>("#jobDescription");
const proposalQuestionsSection = queryRequired<HTMLElement>("#proposalQuestionsSection");
const proposalQuestionsCount = queryRequired<HTMLSpanElement>("#proposalQuestionsCount");
const proposalQuestionsEditor = queryRequired<HTMLElement>("#proposalQuestionsEditor");
const generateButton = queryRequired<HTMLButtonElement>("#generateButton");
const refreshCaptureButton = queryRequired<HTMLButtonElement>("#refreshCaptureButton");
const progressCard = queryRequired<HTMLElement>("#progressCard");
const progressSummary = queryRequired<HTMLParagraphElement>("#progressSummary");
const progressSteps = queryRequired<HTMLUListElement>("#progressSteps");
const resultCard = queryRequired<HTMLElement>("#resultCard");
const resultBadge = queryRequired<HTMLSpanElement>("#resultBadge");
const proposalOutput = queryRequired<HTMLElement>("#proposalOutput");
const questionAnswersSection = queryRequired<HTMLElement>("#questionAnswersSection");
const questionAnswersOutput = queryRequired<HTMLElement>("#questionAnswersOutput");
const unresolvedQuestionsSection = queryRequired<HTMLElement>("#unresolvedQuestionsSection");
const unresolvedQuestionsOutput = queryRequired<HTMLUListElement>("#unresolvedQuestionsOutput");
const fillCoverLetterButton = queryRequired<HTMLButtonElement>("#fillCoverLetterButton");
const copyProposalButton = queryRequired<HTMLButtonElement>("#copyProposalButton");
const openRunButton = queryRequired<HTMLButtonElement>("#openRunButton");
const openOptionsButton = queryRequired<HTMLButtonElement>("#openOptionsButton");

let appBaseUrl: string | null = null;
let activeTabId: number | null = null;
let panelState: ExtensionPanelState | null = null;
let candidates: CandidateSummary[] = [];
let pollTimeout: number | null = null;

openOptionsButton.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

candidateSelect.addEventListener("change", () => {
  if (!panelState) {
    return;
  }

  const nextCandidateId = candidateSelect.value ? Number(candidateSelect.value) : null;
  panelState = {
    ...panelState,
    selectedCandidateId: Number.isFinite(nextCandidateId) ? nextCandidateId : null
  };
  void persistAndRender();
});

jobTitleInput.addEventListener("input", () => {
  updateCapturedJob({
    jobTitle: jobTitleInput.value
  });
});

jobDescriptionInput.addEventListener("input", () => {
  updateCapturedJob({
    jobDescription: jobDescriptionInput.value
  });
});

proposalQuestionsEditor.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) {
    return;
  }

  const position = Number(target.dataset.position);
  if (!Number.isFinite(position) || position <= 0 || !panelState?.capturedJob) {
    return;
  }

  updateCapturedJob({
    proposalQuestions: panelState.capturedJob.proposalQuestions.map((question) =>
      question.position === position ? { ...question, prompt: target.value } : question
    )
  });
});

generateButton.addEventListener("click", () => {
  void startGeneration();
});

refreshCaptureButton.addEventListener("click", () => {
  void refreshCapture();
});

copyProposalButton.addEventListener("click", () => {
  void copyProposal();
});

fillCoverLetterButton.addEventListener("click", () => {
  void autofillSubmission();
});

openRunButton.addEventListener("click", () => {
  void openRunInApp();
});

chrome.tabs.onActivated.addListener(() => {
  void initializeForActiveTab();
});

void initialize();

async function initialize() {
  appBaseUrl = await getStoredAppBaseUrl();
  await initializeForActiveTab();
}

async function initializeForActiveTab() {
  stopPolling();
  candidates = [];

  const activeTab = await getActiveTab();
  if (!activeTab?.id) {
    activeTabId = null;
    panelState = null;
    render();
    return;
  }

  activeTabId = activeTab.id;

  if (appBaseUrl) {
    try {
      candidates = await loadCandidates(appBaseUrl);
    } catch (error) {
      panelState = buildEmptyPanelState(activeTab.id);
      panelState.errorMessage = error instanceof Error ? error.message : "Failed to load candidates from the app.";
      render();
      return;
    }
  }

  const restoredState = await getStoredPanelState(activeTab.id);
  if (restoredState) {
    panelState = restoredState;
  } else {
    panelState = buildEmptyPanelState(activeTab.id);
    await captureActiveTab(activeTab.id);
  }

  render();

  if (panelState?.activeProgressId) {
    schedulePoll(250);
  }
}

function buildEmptyPanelState(tabId: number): ExtensionPanelState {
  return {
    tabId,
    capturedJob: null,
    selectedCandidateId: null,
    activeProgressId: null,
    autofillStatus: null,
    latestStatus: null,
    finalResult: null,
    errorMessage: null
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  return tab;
}

async function captureActiveTab(tabId: number) {
  const tab = await chrome.tabs.get(tabId);

  if (!tab.url || !isUpworkJobUrl(tab.url)) {
    panelState = buildEmptyPanelState(tabId);
    panelState.errorMessage = "This panel supports Upwork Submit Proposal pages only.";
    await persistAndRender();
    return;
  }

  let response: ContentExtractionResponse;
  try {
    response = await chrome.tabs.sendMessage(tabId, {
      type: "extract-job"
    });
  } catch {
    panelState = buildEmptyPanelState(tabId);
    panelState.errorMessage = "Reload the Upwork Submit Proposal page once so the content script can attach.";
    await persistAndRender();
    return;
  }

  if (response.status !== "success") {
    panelState = buildEmptyPanelState(tabId);
    panelState.errorMessage = response.message;
    await persistAndRender();
    return;
  }

  panelState = {
    tabId,
    capturedJob: response.payload,
    selectedCandidateId: null,
    activeProgressId: null,
    autofillStatus: null,
    latestStatus: null,
    finalResult: null,
    errorMessage: null
  };
  await persistAndRender();
}

async function refreshCapture() {
  if (activeTabId == null) {
    return;
  }

  stopPolling();
  await clearStoredPanelState(activeTabId);
  panelState = buildEmptyPanelState(activeTabId);
  render();
  await captureActiveTab(activeTabId);
}

function updateCapturedJob(
  patch: Partial<Pick<ExtensionCapturedJob, "jobTitle" | "jobDescription" | "proposalQuestions">>
) {
  if (!panelState?.capturedJob || isGenerationRunning()) {
    return;
  }

  panelState = {
    ...panelState,
    capturedJob: {
      ...panelState.capturedJob,
      ...patch
    },
    activeProgressId: null,
    autofillStatus: null,
    latestStatus: null,
    finalResult: null,
    errorMessage: null
  };
  void persistAndRender();
}

function isGenerationRunning(): boolean {
  return panelState?.activeProgressId != null;
}

async function loadCandidates(baseUrl: string): Promise<CandidateSummary[]> {
  const response = await fetch(buildExtensionCandidatesApiUrl(baseUrl), {
    headers: {
      "Content-Type": "application/json"
    }
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(typeof json?.message === "string" ? json.message : "Failed to load candidates.");
  }

  return parseExtensionCandidatesResponse(json).candidates;
}

async function startGeneration() {
  if (!panelState?.capturedJob || !appBaseUrl) {
    return;
  }

  if (panelState.selectedCandidateId == null) {
    panelState = {
      ...panelState,
      errorMessage: "Select a candidate before generation."
    };
    await persistAndRender();
    return;
  }

  const payload = validateExtensionGenerateRequest({
    candidateId: panelState.selectedCandidateId,
    title: panelState.capturedJob.jobTitle,
    description: panelState.capturedJob.jobDescription,
    proposalQuestions: panelState.capturedJob.proposalQuestions.map((question, index) => ({
      position: index + 1,
      prompt: question.prompt.trim()
    })),
    sourceSite: panelState.capturedJob.sourceSite,
    sourceUrl: panelState.capturedJob.sourceUrl
  });

  const response = await fetch(buildExtensionGenerateApiUrl(appBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const json = await response.json();

  if (!response.ok) {
    panelState = {
      ...panelState,
      errorMessage: typeof json?.message === "string" ? json.message : "Failed to start generation."
    };
    await persistAndRender();
    return;
  }

  const parsed = parseExtensionGenerateResponse(json);
  panelState = {
    ...panelState,
    activeProgressId: parsed.progressId,
    autofillStatus: null,
    latestStatus: {
      status: "QUEUED",
      currentStepLabel: null,
      steps: []
    },
    finalResult: null,
    errorMessage: null
  };
  await persistAndRender();
  schedulePoll(250);
}

function schedulePoll(delayMs: number = pollIntervalMs) {
  stopPolling();
  pollTimeout = window.setTimeout(() => {
    void pollGenerationStatus();
  }, delayMs);
}

function stopPolling() {
  if (pollTimeout !== null) {
    window.clearTimeout(pollTimeout);
    pollTimeout = null;
  }
}

async function pollGenerationStatus() {
  if (!panelState?.activeProgressId || !appBaseUrl) {
    stopPolling();
    return;
  }

  const response = await fetch(buildExtensionGenerateStatusApiUrl(appBaseUrl, panelState.activeProgressId), {
    headers: {
      "Content-Type": "application/json"
    }
  });
  const json = await response.json();

  if (!response.ok) {
    panelState = {
      ...panelState,
      activeProgressId: null,
      latestStatus: null,
      errorMessage: typeof json?.message === "string" ? json.message : "Failed to load generation status."
    };
    await persistAndRender();
    return;
  }

  const parsed = parseExtensionGenerateStatusResponse(json);
  const nextFinalResult = parsed.result ?? panelState.finalResult;
  panelState = {
    ...panelState,
    latestStatus: parsed.progress
      ? {
          status: parsed.progress.status,
          currentStepLabel: parsed.progress.currentStep?.label ?? null,
          startedAt: parsed.progress.startedAt,
          totalDurationMs: parsed.progress.totalDurationMs,
          errorMessage: parsed.progress.errorMessage,
          steps: parsed.progress.steps.map((step) => ({
            step: step.step,
            label: step.label,
            status: step.status,
            durationMs: step.durationMs
          }))
        }
      : panelState.latestStatus,
    finalResult: nextFinalResult,
    errorMessage: parsed.progress?.status === "FAILED" ? parsed.progress.errorMessage ?? "Generation failed." : null
  };

  if (parsed.result) {
    panelState.activeProgressId = null;
    await autofillSubmission(parsed.result);
    return;
  }

  if (parsed.progress?.status === "FAILED") {
    panelState.activeProgressId = null;
    await persistAndRender();
    return;
  }

  await persistAndRender();
  schedulePoll();
}

async function copyProposal() {
  if (!panelState?.finalResult) {
    return;
  }

  await navigator.clipboard.writeText(panelState.finalResult.finalProposal);
  setStatus("Proposal copied to clipboard.");
}

async function openRunInApp() {
  if (!panelState?.finalResult || !appBaseUrl) {
    return;
  }

  await chrome.tabs.create({
    url: buildGenerationRunUrl(appBaseUrl, panelState.finalResult.generationRunId)
  });
}

async function autofillSubmission(
  submission: ExtensionPanelState["finalResult"] | null = panelState?.finalResult ?? null
) {
  const currentState = panelState;
  if (!currentState || !submission || activeTabId == null || !submission.finalProposal) {
    return;
  }

  let response: ContentFillSubmissionResponse;
  try {
    response = await chrome.tabs.sendMessage(activeTabId, {
      type: "fill-generated-submission",
      payload: {
        coverLetter: submission.finalProposal,
        questionAnswers: submission.questionAnswers,
        unresolvedQuestions: submission.unresolvedQuestions
      }
    });
  } catch {
    panelState = {
      ...currentState,
      autofillStatus: {
        status: "FAILED",
        message: "Reload the Upwork Submit Proposal page once so the submission fields can be filled."
      }
    };
    await persistAndRender();
    return;
  }

  panelState = {
    ...currentState,
    autofillStatus:
      response.status === "success"
        ? {
            status: "SUCCESS",
            message:
              submission.unresolvedQuestions.length > 0
                ? `Cover letter and available question answers filled. ${submission.unresolvedQuestions.length} question(s) still need manual input.`
                : "Cover letter and proposal question answers filled on the current Upwork proposal page."
          }
        : {
            status: "FAILED",
            message: response.message
          }
  };
  await persistAndRender();
}

async function persistAndRender() {
  if (panelState) {
    await setStoredPanelState(panelState.tabId, panelState);
  }

  render();
}

function render() {
  const capturedJob = panelState?.capturedJob ?? null;
  const latestStatus = panelState?.latestStatus ?? null;
  const finalResult = panelState?.finalResult ?? null;
  const isRunning = isGenerationRunning();

  setStatus(buildTopLevelStatus());

  sourceMeta.textContent = capturedJob ? buildJobPreviewMeta(capturedJob) : "No captured Upwork proposal page for this tab yet.";
  if (capturedJob) {
    sourceLink.href = capturedJob.sourceUrl;
    sourceLink.classList.remove("is-hidden");
  } else {
    sourceLink.classList.add("is-hidden");
    sourceLink.removeAttribute("href");
  }

  jobTitleInput.value = capturedJob?.jobTitle ?? "";
  jobDescriptionInput.value = capturedJob?.jobDescription ?? "";
  proposalQuestionsSection.classList.toggle("is-hidden", !capturedJob || capturedJob.proposalQuestions.length === 0);
  proposalQuestionsCount.textContent = capturedJob ? `${capturedJob.proposalQuestions.length} total` : "";
  proposalQuestionsEditor.innerHTML = "";
  if (capturedJob) {
    for (const question of capturedJob.proposalQuestions) {
      const wrapper = document.createElement("label");
      wrapper.className = "field-stack";

      const label = document.createElement("span");
      label.className = "field-label";
      label.textContent = `Question ${question.position}`;

      const textarea = document.createElement("textarea");
      textarea.className = "text-area";
      textarea.rows = 3;
      textarea.value = question.prompt;
      textarea.dataset.position = String(question.position);
      textarea.disabled = isRunning;

      wrapper.append(label, textarea);
      proposalQuestionsEditor.append(wrapper);
    }
  }

  candidateSelect.innerHTML = '<option value="">Select candidate</option>';
  for (const candidate of candidates) {
    const option = document.createElement("option");
    option.value = String(candidate.candidateId);
    option.textContent = `${candidate.displayName} #${candidate.candidateId}`;
    option.selected = panelState?.selectedCandidateId === candidate.candidateId;
    candidateSelect.append(option);
  }

  candidateSelect.disabled = isRunning || candidates.length === 0;
  jobTitleInput.disabled = isRunning || !capturedJob;
  jobDescriptionInput.disabled = isRunning || !capturedJob;
  refreshCaptureButton.disabled = isRunning || activeTabId == null;
  generateButton.disabled =
    isRunning ||
    !capturedJob ||
    !appBaseUrl ||
    panelState?.selectedCandidateId == null ||
    capturedJob.jobDescription.trim().length < 30;

  progressCard.classList.toggle("is-hidden", latestStatus == null);
  if (latestStatus) {
    progressSummary.textContent = buildProgressSummary(latestStatus);
    progressSteps.innerHTML = "";
    for (const step of latestStatus.steps) {
      const item = document.createElement("li");
      item.className = `progress-item progress-item-${step.status.toLowerCase()}`;
      item.textContent =
        step.durationMs != null
          ? `${step.label} · ${(step.durationMs / 1000).toFixed(1)}s`
          : `${step.label} · ${step.status.toLowerCase()}`;
      progressSteps.append(item);
    }
  } else {
    progressSummary.textContent = "";
    progressSteps.innerHTML = "";
  }

  resultCard.classList.toggle("is-hidden", finalResult == null);
  if (finalResult) {
    resultBadge.textContent = finalResult.approvalStatus;
    resultBadge.className = `result-badge result-badge-${finalResult.approvalStatus.toLowerCase()}`;
    proposalOutput.textContent = finalResult.finalProposal;
    questionAnswersSection.classList.toggle("is-hidden", finalResult.questionAnswers.length === 0);
    questionAnswersOutput.innerHTML = "";
    for (const answer of finalResult.questionAnswers) {
      const wrapper = document.createElement("div");
      wrapper.className = "status-card";
      const prompt = document.createElement("p");
      prompt.className = "preview-meta";
      prompt.textContent = `Question ${answer.position}: ${answer.prompt}`;
      const body = document.createElement("pre");
      body.className = "proposal-output";
      body.textContent = answer.answer;
      wrapper.append(prompt, body);
      questionAnswersOutput.append(wrapper);
    }

    unresolvedQuestionsSection.classList.toggle("is-hidden", finalResult.unresolvedQuestions.length === 0);
    unresolvedQuestionsOutput.innerHTML = "";
    for (const unresolved of finalResult.unresolvedQuestions) {
      const item = document.createElement("li");
      item.className = "progress-item progress-item-failed";
      item.textContent = `${unresolved.prompt} · ${unresolved.reason}`;
      unresolvedQuestionsOutput.append(item);
    }
  } else {
    resultBadge.textContent = "";
    proposalOutput.textContent = "";
    questionAnswersSection.classList.add("is-hidden");
    questionAnswersOutput.innerHTML = "";
    unresolvedQuestionsSection.classList.add("is-hidden");
    unresolvedQuestionsOutput.innerHTML = "";
  }

  openRunButton.disabled = finalResult == null || !appBaseUrl;
  fillCoverLetterButton.disabled = isRunning || finalResult == null || activeTabId == null;
  copyProposalButton.disabled = finalResult == null;
}

function buildTopLevelStatus(): string {
  if (!appBaseUrl) {
    return "Configure the app URL in extension settings before generating proposals.";
  }

  if (!panelState) {
    return "Loading side panel state…";
  }

  if (panelState.errorMessage) {
    return panelState.errorMessage;
  }

  if (panelState.finalResult) {
    if (panelState.autofillStatus?.status === "SUCCESS") {
      return `${panelState.autofillStatus.message} You can copy it or open the saved run in the app.`;
    }

    if (panelState.autofillStatus?.status === "FAILED") {
      return `${panelState.autofillStatus.message} You can retry filling, copy it, or open the saved run in the app.`;
    }

    return panelState.finalResult.unresolvedQuestions.length > 0
      ? "Proposal is ready. Fill the submission, then complete the flagged manual questions before sending."
      : "Proposal is ready. You can fill the submission, copy it, or open the saved run in the app.";
  }

  if (panelState.latestStatus) {
    return buildProgressSummary(panelState.latestStatus);
  }

  if (!panelState.capturedJob) {
    return "Capture a supported Upwork Submit Proposal page in this tab to begin.";
  }

  if (panelState.selectedCandidateId == null) {
    return "Review the parsed proposal page, then select a candidate before generation.";
  }

  return "Review the captured proposal page, then run generation when ready.";
}

function buildProgressSummary(status: NonNullable<ExtensionPanelState["latestStatus"]>): string {
  const duration =
    status.totalDurationMs != null
      ? `${(status.totalDurationMs / 1000).toFixed(1)}s total`
      : status.startedAt != null
        ? `${((Date.now() - status.startedAt) / 1000).toFixed(1)}s elapsed`
        : null;

  if (status.status === "FAILED") {
    return status.errorMessage ?? "Generation failed.";
  }

  if (status.status === "COMPLETED") {
    return duration ? `Generation completed. ${duration}.` : "Generation completed.";
  }

  if (status.currentStepLabel) {
    return duration ? `${status.currentStepLabel}. ${duration}.` : status.currentStepLabel;
  }

  return duration ? `Generation queued. ${duration}.` : "Generation queued.";
}

function setStatus(message: string) {
  panelStatus.textContent = message;
}
