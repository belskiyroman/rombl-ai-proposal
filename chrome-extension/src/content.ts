import {
  captureUpworkProposalPage,
  fillProposalSubmission,
  unsupportedProposalPageMessage
} from "./content-extraction";

import type {
  ContentExtractionRequest,
  ContentExtractionResponse,
  ContentFillSubmissionRequest,
  ContentFillSubmissionResponse
} from "./shared/types";

chrome.runtime.onMessage.addListener(
  (
    message: ContentExtractionRequest | ContentFillSubmissionRequest,
    _sender,
    sendResponse: (response: ContentExtractionResponse | ContentFillSubmissionResponse) => void
  ) => {
    if (message?.type === "extract-job") {
      void handleExtract(sendResponse);
      return true;
    }

    if (message?.type === "fill-generated-submission") {
      void handleFillSubmission(message, sendResponse);
      return true;
    }

    return false;
  }
);

async function handleExtract(sendResponse: (response: ContentExtractionResponse) => void) {
  try {
    const extracted = await captureUpworkProposalPage({
      url: window.location.href,
      pageTitle: document.title,
    });

    if (!extracted) {
      sendResponse({
        status: "unsupported",
        message: unsupportedProposalPageMessage
      } satisfies ContentExtractionResponse);
      return;
    }

    sendResponse({
      status: "success",
      payload: {
        sourceSite: extracted.sourceSite,
        sourceUrl: extracted.sourceUrl,
        pageTitle: extracted.pageTitle,
        jobTitle: extracted.jobTitle,
        jobDescription: extracted.jobDescription,
        proposalQuestions: extracted.proposalQuestions,
        capturedAt: Date.now(),
        parserMeta: extracted.metadata
      }
    } satisfies ContentExtractionResponse);
  } catch (error) {
    sendResponse({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to parse the current Upwork proposal page."
    } satisfies ContentExtractionResponse);
  }
}

async function handleFillSubmission(
  message: ContentFillSubmissionRequest,
  sendResponse: (response: ContentFillSubmissionResponse) => void
) {
  try {
    fillProposalSubmission(document, message.payload);
    sendResponse({
      status: "success"
    } satisfies ContentFillSubmissionResponse);
  } catch (error) {
    sendResponse({
      status: "error",
      message: error instanceof Error ? error.message : "Failed to fill the Upwork submission fields."
    } satisfies ContentFillSubmissionResponse);
  }
}
