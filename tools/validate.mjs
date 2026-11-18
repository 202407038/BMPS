import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const node = process.execPath;

const checks = [
  ["contracts type-check", [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"], join(root, "packages", "contracts")],
  ["server type-check", [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"], join(root, "apps", "server")],
  ["web type-check", [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"], join(root, "apps", "web")],
  ["support packages type-check", [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"], join(root, "packages", "test-support")],
  ["demo tool type-check", [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"], join(root, "tools", "demo-seed")],
  ["server tests", [join(root, "node_modules", "vitest", "vitest.mjs"), "run", "--reporter=verbose"], join(root, "apps", "server")],
  ["web production build", [join(root, "node_modules", "vite", "bin", "vite.js"), "build"], join(root, "apps", "web")],
];

let failed = false;
for (const [label, args, cwd] of checks) {
  console.log(`\n--- ${label} ---`);
  const result = spawnSync(node, args, { cwd, env: process.env, encoding: "utf8" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    failed = true;
    console.error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
  } else {
    console.log(`${label} passed.`);
  }
}

process.exitCode = failed ? 1 : 0;
