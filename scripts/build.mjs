import { execSync } from "child_process";

// Detect deployment environment
const isRender = Boolean(
  process.env.RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.IS_PULL_REQUEST,
);
const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILDER);

function run(cmd) {
  console.log(`[build] Executing: ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", env: process.env });
  } catch (err) {
    process.exit(err.status || 1);
  }
}

// 1. Render backend service: backend has no compilation/build step
if (isRender) {
  console.log(
    "[build] Render environment detected. Backend is pure Node.js (no build step required).",
  );
  process.exit(0);
}


// 2. Production install check (if devDependencies like Vite were omitted)
let hasVite = false;
try {
  execSync("npx vite --version", { stdio: "ignore" });
  hasVite = true;
} catch {
  hasVite = false;
}

if (!hasVite && process.env.NODE_ENV === "production") {
  console.log(
    "[build] Vite not found in production environment. Building backend only...",
  );
  run("turbo build --filter=trstprep-backend");
  process.exit(0);
}

// 3. Default monorepo build
console.log("[build] Running full monorepo build...");
run("turbo build");
