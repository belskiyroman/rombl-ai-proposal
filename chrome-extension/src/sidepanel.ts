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
import type { ContentExtractionResponse, ExtensionCapturedJob, ExtensionPanelState } from "./shared/types";
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
const generateButton = queryRequired<HTMLButtonElement>("#generateButton");
const refreshCaptureButton = queryRequired<HTMLButtonElement>("#refreshCaptureButton");
const progressCard = queryRequired<HTMLElement>("#progressCard");
const progressSummary = queryRequired<HTMLParagraphElement>("#progressSummary");
const progressSteps = queryRequired<HTMLUListElement>("#progressSteps");
const resultCard = queryRequired<HTMLElement>("#resultCard");
const resultBadge = queryRequired<HTMLSpanElement>("#resultBadge");
const proposalOutput = queryRequired<HTMLElement>("#proposalOutput");
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

generateButton.addEventListener("click", () => {
  void startGeneration();
});

refreshCaptureButton.addEventListener("click", () => {
  void refreshCapture();
});

copyProposalButton.addEventListener("click", () => {
  void copyProposal();
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

function updateCapturedJob(patch: Partial<Pick<ExtensionCapturedJob, "jobTitle" | "jobDescription">>) {
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
    finalResult: parsed.result ?? panelState.finalResult,
    errorMessage: parsed.progress?.status === "FAILED" ? parsed.progress.errorMessage ?? "Generation failed." : null
  };

  if (parsed.result) {
    panelState.activeProgressId = null;
    await persistAndRender();
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
  } else {
    resultBadge.textContent = "";
    proposalOutput.textContent = "";
  }

  openRunButton.disabled = finalResult == null || !appBaseUrl;
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
    return "Proposal is ready. You can copy it or open the saved run in the app.";
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
