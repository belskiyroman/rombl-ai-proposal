import type { ExtensionPanelState } from "./types";

const appBaseUrlStorageKey = "appBaseUrl";
const panelStatePrefix = "panelState:";

export async function getStoredAppBaseUrl(): Promise<string | null> {
  const stored = await chrome.storage.local.get(appBaseUrlStorageKey);
  const value = stored[appBaseUrlStorageKey];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function setStoredAppBaseUrl(appBaseUrl: string): Promise<void> {
  await chrome.storage.local.set({
    [appBaseUrlStorageKey]: appBaseUrl
  });
}

function buildPanelStateKey(tabId: number): string {
  return `${panelStatePrefix}${tabId}`;
}

export async function getStoredPanelState(tabId: number): Promise<ExtensionPanelState | null> {
  const key = buildPanelStateKey(tabId);
  const stored = await chrome.storage.session.get(key);
  const value = stored[key] as ExtensionPanelState | undefined;

  return value ?? null;
}

export async function setStoredPanelState(tabId: number, state: ExtensionPanelState): Promise<void> {
  await chrome.storage.session.set({
    [buildPanelStateKey(tabId)]: state
  });
}

export async function clearStoredPanelState(tabId: number): Promise<void> {
  await chrome.storage.session.remove(buildPanelStateKey(tabId));
}
