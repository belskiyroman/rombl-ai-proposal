export function ensurePerformanceGlobal(): void {
  if (typeof globalThis.performance !== "undefined") {
    return;
  }

  const fallbackPerformance = {
    now: () => Date.now(),
    timeOrigin: Date.now()
  } as Performance;

  Object.defineProperty(globalThis, "performance", {
    value: fallbackPerformance,
    configurable: true,
    writable: true
  });
}

export function ensureRuntimeGlobals(): void {
  ensurePerformanceGlobal();
}
