import { extractUpworkJobPageSnapshot, type ExtractedUpworkJobPage } from "../../src/lib/job-import/upwork";

export const unsupportedProposalPageMessage = "This page does not look like a supported Upwork Submit Proposal page.";
export const fullDescriptionCaptureErrorMessage =
  "Could not expand the full job description on this Upwork proposal page. Reload the page and try again.";

const defaultExpandTimeoutMs = 1000;
const defaultPollIntervalMs = 50;

export async function captureUpworkProposalPage(args: {
  url: string;
  pageTitle: string;
  doc?: Document;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<ExtractedUpworkJobPage | null> {
  const doc = args.doc ?? document;
  await ensureProposalDescriptionExpanded(doc, {
    timeoutMs: args.timeoutMs,
    pollIntervalMs: args.pollIntervalMs
  });

  return extractUpworkJobPageSnapshot({
    url: args.url,
    pageTitle: args.pageTitle,
    html: doc.documentElement.outerHTML
  });
}

export async function ensureProposalDescriptionExpanded(
  doc: Document,
  options: {
    timeoutMs?: number;
    pollIntervalMs?: number;
  } = {}
): Promise<void> {
  const jobDetailsRoot = getProposalJobDetailsRoot(doc);
  if (!jobDetailsRoot) {
    return;
  }

  const descriptionBlock = getProposalDescriptionBlock(jobDetailsRoot);
  if (!descriptionBlock) {
    return;
  }

  const truncationToggle = getProposalDescriptionToggle(jobDetailsRoot);
  if (!truncationToggle || isExpanded(truncationToggle)) {
    return;
  }

  const initialLength = normalizeText(descriptionBlock.textContent).length;
  truncationToggle.click();

  const expanded = await waitForCondition(
    () => {
      const nextDescriptionBlock = getProposalDescriptionBlock(jobDetailsRoot);
      const nextLength = normalizeText(nextDescriptionBlock?.textContent).length;
      const nextToggle = getProposalDescriptionToggle(jobDetailsRoot);

      return isExpanded(nextToggle) || nextLength > initialLength;
    },
    options.timeoutMs ?? defaultExpandTimeoutMs,
    options.pollIntervalMs ?? defaultPollIntervalMs
  );

  if (!expanded) {
    throw new Error(fullDescriptionCaptureErrorMessage);
  }
}

function getProposalJobDetailsRoot(doc: Document): Element | null {
  return doc.querySelector(".fe-job-details");
}

function getProposalDescriptionBlock(root: ParentNode): Element | null {
  return root.querySelector(".content .description") ?? root.querySelector(".description");
}

function getProposalDescriptionToggle(root: ParentNode): HTMLButtonElement | null {
  return root.querySelector(
    '.description button.air3-truncation-btn[aria-controls], .description button[data-ev-label="truncation_toggle"][aria-controls]'
  );
}

function isExpanded(toggle: HTMLButtonElement | null): boolean {
  return toggle?.getAttribute("aria-expanded") === "true";
}

function normalizeText(text: string | null | undefined): string {
  return text?.replace(/\s+/g, " ").trim() ?? "";
}

async function waitForCondition(
  condition: () => boolean,
  timeoutMs: number,
  pollIntervalMs: number
): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    if (condition()) {
      return true;
    }

    await delay(pollIntervalMs);
  }

  return condition();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
