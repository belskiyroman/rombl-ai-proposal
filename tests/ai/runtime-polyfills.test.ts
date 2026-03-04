import { afterEach, describe, expect, it } from "vitest";

import { ensureRuntimeGlobals } from "@/src/lib/ai/runtime-polyfills";

const originalPerformance = globalThis.performance;

afterEach(() => {
  Object.defineProperty(globalThis, "performance", {
    value: originalPerformance,
    configurable: true,
    writable: true
  });
});

describe("ensureRuntimeGlobals", () => {
  it("polyfills performance when not available", () => {
    Object.defineProperty(globalThis, "performance", {
      value: undefined,
      configurable: true,
      writable: true
    });

    ensureRuntimeGlobals();

    expect(globalThis.performance).toBeDefined();
    expect(typeof globalThis.performance.now).toBe("function");
  });

  it("does not override an existing performance object", () => {
    const customPerformance = { now: () => 123 } as Performance;
    Object.defineProperty(globalThis, "performance", {
      value: customPerformance,
      configurable: true,
      writable: true
    });

    ensureRuntimeGlobals();

    expect(globalThis.performance).toBe(customPerformance);
  });
});
