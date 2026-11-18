import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const node = process.execPath;
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const vitest = join(root, "node_modules", "vitest", "vitest.mjs");
const vite = join(root, "node_modules", "vite", "bin", "vite.js");

const checks = [
  ["서버 타입 검사", node, [tsc, "-p", "apps/server/tsconfig.json"], root],
  ["웹 타입 검사", node, [tsc, "-p", "apps/web/tsconfig.json"], root],
  ["공통 계약 타입 검사", node, [tsc, "-p", "packages/contracts/tsconfig.json"], root],
  ["테스트 지원 타입 검사", node, [tsc, "-p", "packages/test-support/tsconfig.json"], root],
  ["데모 도구 타입 검사", node, [tsc, "-p", "tools/demo-seed/tsconfig.json"], root],
  ["자동 테스트", node, [vitest, "run", "--passWithNoTests"], root],
  ["서버 빌드", node, [tsc, "-p", "apps/server/tsconfig.build.json"], root],
  ["웹 빌드", node, [vite, "build"], join(root, "apps", "web")],
];

for (const [label, executable, args, cwd] of checks) {
  console.log(`\n[검증] ${label}`);
  const result = spawnSync(executable, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[실패] ${label} (exit ${result.status ?? "unknown"})`);
    process.exit(result.status ?? 1);
  }
  console.log(`[통과] ${label}`);
}

console.log("\nBMPS 검증을 모두 통과했습니다.");
