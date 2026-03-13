import { buildExtensionHandoffApiUrl, parseHandoffResponse, validateOutgoingHandoff } from "./shared/helpers";
import { clearStoredPanelState, getStoredAppBaseUrl } from "./shared/storage";
import type { BackgroundOpenRequest, BackgroundOpenResponse, BackgroundPanelRequest } from "./shared/types";

async function enableSidePanelOnActionClick() {
  await chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
}

void enableSidePanelOnActionClick();

chrome.runtime.onInstalled.addListener(() => {
  void enableSidePanelOnActionClick();
});

chrome.runtime.onStartup.addListener(() => {
  void enableSidePanelOnActionClick();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearStoredPanelState(tabId);
});

chrome.runtime.onMessage.addListener((message: BackgroundOpenRequest | BackgroundPanelRequest, _sender, sendResponse) => {
  if (message?.type === "clear-tab-state") {
    void clearStoredPanelState(message.tabId).then(() => sendResponse(true));
    return true;
  }

  if (message?.type !== "open-in-generator") {
    return false;
  }

  void handleOpenInGenerator(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown extension handoff error"
      } satisfies BackgroundOpenResponse);
    });

  return true;
});

async function handleOpenInGenerator(message: BackgroundOpenRequest): Promise<BackgroundOpenResponse> {
  const appBaseUrl = await getStoredAppBaseUrl();
  if (!appBaseUrl) {
    return {
      status: "error",
      message: "Configure the generator app URL before sending jobs."
    };
  }

  const payload = validateOutgoingHandoff(message.payload);
  const response = await fetch(buildExtensionHandoffApiUrl(appBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const json = await response.json();

  if (!response.ok) {
    return {
      status: "error",
      message: typeof json?.message === "string" ? json.message : "App handoff request failed."
    };
  }

  const parsed = parseHandoffResponse(json);
  await chrome.tabs.create({
    url: parsed.generateUrl
  });

  return {
    status: "success",
    handoffId: parsed.handoffId,
    generateUrl: parsed.generateUrl
  };
}
