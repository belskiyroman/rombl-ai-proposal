import { captureUpworkProposalPage, unsupportedProposalPageMessage } from "./content-extraction";

import type { ContentExtractionRequest, ContentExtractionResponse } from "./shared/types";

chrome.runtime.onMessage.addListener((message: ContentExtractionRequest, _sender, sendResponse) => {
  if (message?.type !== "extract-job") {
    return false;
  }

  void handleExtract(sendResponse);
  return true;
});

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
