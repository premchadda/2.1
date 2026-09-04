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

// 1. Render backend service: build backend only (skip frontend & admin vite builds)
if (isRender) {
  console.log(
    "[build] Render environment detected. Building backend service only...",
  );
  run("npx turbo build --filter=trstprep-backend --no-daemon");
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
  run("npx turbo build --filter=trstprep-backend --no-daemon");
  process.exit(0);
}

// 3. Default monorepo build
console.log("[build] Running full monorepo build...");
run("npx turbo build --no-daemon");
