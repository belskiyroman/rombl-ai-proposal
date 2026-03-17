import { spawnSync } from "node:child_process";

const requiredKeys = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_REASONING_MODEL"
];

const missing = requiredKeys.filter((key) => {
  const value = process.env[key];
  return typeof value !== "string" || value.length === 0;
});

if (missing.length > 0) {
  console.error(`Missing required values in .env.selfhosted: ${missing.join(", ")}`);
  process.exit(1);
}

const npxBinary = process.platform === "win32" ? "npx.cmd" : "npx";

for (const key of requiredKeys) {
  const value = process.env[key];
  const result = spawnSync(
    npxBinary,
    ["convex", "env", "set", key, value, "--env-file", ".env.selfhosted"],
    {
      stdio: "inherit",
      env: process.env
    }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
