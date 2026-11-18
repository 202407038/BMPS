import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const node = process.execPath;

function start(label, args, cwd) {
  const child = spawn(node, args, {
    cwd,
    env: { ...process.env, FORCE_COLOR: "1" },
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${label}] exited with code ${code}`);
    }
  });
  return child;
}

console.log("\n  BMPS demo is starting…");
console.log("  Web: http://localhost:5173");
console.log("  API: http://localhost:3000\n");

const server = start(
  "server",
  [join(root, "node_modules", "tsx", "dist", "cli.mjs"), "watch", "src/index.ts"],
  join(root, "apps", "server"),
);
const web = start(
  "web",
  [join(root, "node_modules", "vite", "bin", "vite.js"), "--host", "0.0.0.0"],
  join(root, "apps", "web"),
);

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.kill("SIGTERM");
  web.kill("SIGTERM");
  setTimeout(() => process.exit(0), 150);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
