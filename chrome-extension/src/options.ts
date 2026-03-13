import { normalizeAppBaseUrl, toChromeOriginPermissionPattern } from "./shared/helpers";
import { getStoredAppBaseUrl, setStoredAppBaseUrl } from "./shared/storage";

function queryRequired<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Options UI is missing required DOM node: ${selector}`);
  }

  return element;
}

const form = queryRequired<HTMLFormElement>("#settingsForm");
const input = queryRequired<HTMLInputElement>("#appBaseUrl");
const status = queryRequired<HTMLParagraphElement>("#settingsStatus");

void initializeOptions();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveOptions();
});

async function initializeOptions() {
  const appBaseUrl = await getStoredAppBaseUrl();
  if (appBaseUrl) {
    input.value = appBaseUrl;
    status.textContent = `Current app URL: ${appBaseUrl}`;
  } else {
    status.textContent = "No app URL configured yet.";
  }
}

async function saveOptions() {
  try {
    const normalizedBaseUrl = normalizeAppBaseUrl(input.value);
    const granted = await chrome.permissions.request({
      origins: [toChromeOriginPermissionPattern(normalizedBaseUrl)]
    });

    if (!granted) {
      throw new Error("App origin permission was denied.");
    }

    await setStoredAppBaseUrl(normalizedBaseUrl);
    status.className = "helper-text is-success";
    status.textContent = `Saved app URL: ${normalizedBaseUrl}`;
  } catch (error) {
    status.className = "helper-text is-error";
    status.textContent = error instanceof Error ? error.message : "Failed to save app URL.";
  }
}
