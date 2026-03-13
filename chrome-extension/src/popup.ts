import { buildJobPreviewDescription, buildJobPreviewMeta } from "./shared/helpers";
import { getStoredAppBaseUrl } from "./shared/storage";
import type { BackgroundOpenResponse, ContentExtractionResponse, ExtensionCapturedJob } from "./shared/types";
import { isUpworkJobUrl } from "../../src/lib/job-import/upwork";

function queryRequired<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Popup UI is missing required DOM node: ${selector}`);
  }

  return element;
}

const statusText = queryRequired<HTMLParagraphElement>("#statusText");
const previewCard = queryRequired<HTMLElement>("#previewCard");
const previewMeta = queryRequired<HTMLParagraphElement>("#previewMeta");
const previewTitle = queryRequired<HTMLHeadingElement>("#previewTitle");
const previewDescription = queryRequired<HTMLParagraphElement>("#previewDescription");
const openGeneratorButton = queryRequired<HTMLButtonElement>("#openGeneratorButton");
const refreshButton = queryRequired<HTMLButtonElement>("#refreshButton");
const openOptionsButton = queryRequired<HTMLButtonElement>("#openOptionsButton");

let capturedJob: ExtensionCapturedJob | null = null;

openOptionsButton.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

refreshButton.addEventListener("click", () => {
  void loadCapturedJob();
});

openGeneratorButton.addEventListener("click", () => {
  void openInGenerator();
});

void loadCapturedJob();

async function loadCapturedJob() {
  capturedJob = null;
  openGeneratorButton.disabled = true;
  previewCard.classList.add("is-hidden");

  const appBaseUrl = await getStoredAppBaseUrl();
  if (!appBaseUrl) {
    setStatus("Configure the generator app URL before importing from Upwork proposal pages.");
    return;
  }

  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });

  if (!tab?.id || !tab.url) {
    setStatus("No active browser tab is available.");
    return;
  }

  if (!isUpworkJobUrl(tab.url)) {
    setStatus("This version supports Upwork Submit Proposal pages only.");
    return;
  }

  let response: ContentExtractionResponse;
  try {
    response = await chrome.tabs.sendMessage(tab.id, {
      type: "extract-job"
    });
  } catch {
    setStatus("Reload the Upwork Submit Proposal page once so the content script can attach.");
    return;
  }

  if (response.status !== "success") {
    setStatus(response.message);
    return;
  }

  capturedJob = response.payload;
  openGeneratorButton.disabled = false;
  previewMeta.textContent = buildJobPreviewMeta(capturedJob);
  previewTitle.textContent = capturedJob.jobTitle;
  previewDescription.textContent = buildJobPreviewDescription(capturedJob);
  previewCard.classList.remove("is-hidden");
  setStatus("Proposal page captured successfully. Open it in the generator when ready.");
}

async function openInGenerator() {
  if (!capturedJob) {
    setStatus("Capture a supported Upwork Submit Proposal page before opening the generator.");
    return;
  }

  openGeneratorButton.disabled = true;
  setStatus("Creating a handoff in the app...");

  const response = (await chrome.runtime.sendMessage({
    type: "open-in-generator",
    payload: capturedJob
  })) as BackgroundOpenResponse;

  if (response.status === "error") {
    openGeneratorButton.disabled = false;
    setStatus(response.message);
    return;
  }

  setStatus("Opened the generator in a new tab.");
  window.close();
}

function setStatus(message: string) {
  statusText.textContent = message;
}
