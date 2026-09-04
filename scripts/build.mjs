import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect deployment environment
const isRender = Boolean(
  process.env.RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.IS_PULL_REQUEST,
);
const isVercel = Boolean(process.env.VERCEL || process.env.NOW_BUILDER);

function run(cmd, opts = {}) {
  console.log(`[build] Executing: ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", env: process.env, ...opts });
  } catch (err) {
    process.exit(err.status || 1);
  }
}

// 1. Render backend service: ensure production dependencies are installed for apps/backend
if (isRender) {
  console.log(
    "[build] Render environment detected. Ensuring backend dependencies are installed...",
  );
  const backendDir = path.resolve(__dirname, "../apps/backend");
  let installed = false;

  // Try pnpm first if available
  try {
    console.log("[build] Attempting pnpm install for backend...");
    execSync("pnpm install --prod --filter trstprep-backend", {
      stdio: "inherit",
      env: process.env,
    });
    installed = true;
  } catch (pnpmErr) {
    console.log(
      `[build] pnpm install notice (${pnpmErr.message}). Installing via npm in apps/backend...`,
    );
  }

  // Fallback to npm in apps/backend
  if (!installed) {
    try {
      console.log("[build] Running npm install --omit=dev in apps/backend...");
      execSync("npm install --omit=dev", {
        cwd: backendDir,
        stdio: "inherit",
        env: process.env,
      });
      installed = true;
    } catch (npmErr) {
      console.error(
        "[build] Failed to install backend dependencies via npm:",
        npmErr.message,
      );
      process.exit(1);
    }
  }

  console.log("[build] Backend dependencies installed successfully.");
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
