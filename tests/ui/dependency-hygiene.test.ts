import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  dependencies?: Record<string, string>;
};

function readPackageJson(): PackageJson {
  const packagePath = path.join(process.cwd(), "package.json");
  return JSON.parse(fs.readFileSync(packagePath, "utf-8")) as PackageJson;
}

describe("frontend dependency hygiene", () => {
  it("keeps only Radix packages used by shadcn wrappers", () => {
    const packageJson = readPackageJson();
    const deps = packageJson.dependencies ?? {};

    expect(deps["@radix-ui/react-slot"]).toBeTruthy();
    expect(deps["@radix-ui/react-label"]).toBeTruthy();
    expect(deps["@radix-ui/react-toast"]).toBeTruthy();

    expect(deps["@radix-ui/react-select"]).toBeUndefined();
    expect(deps["@radix-ui/react-separator"]).toBeUndefined();
    expect(deps["@radix-ui/react-tabs"]).toBeUndefined();
  });

  it("does not keep legacy toast dependencies", () => {
    const packageJson = readPackageJson();
    const deps = packageJson.dependencies ?? {};

    expect(deps.sonner).toBeUndefined();
  });
});
