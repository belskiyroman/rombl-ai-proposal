import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

describe("health API", () => {
  it("returns a healthy status payload", async () => {
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ status: "ok" });
  });
});
