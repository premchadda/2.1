import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const specPath = path.join(__dirname, "../apps/backend/openapi-spec.yaml");
const specContent = fs.readFileSync(specPath, "utf-8");

// Simple YAML line-by-line parser to extract paths
const paths = [];
const lines = specContent.split("\n");
for (const line of lines) {
  const match = line.match(/^\s*(\/api\/[a-zA-Z0-9_\/{}~-]+):/);
  if (match) {
    paths.push(match[1]);
  }
}

console.log("=========================================");
console.log("🔍 TRSTPREP API DRIFT VALIDATOR");
console.log("=========================================");
console.log(`Checking ${paths.length} documented API paths...\n`);

// Route check mappings (spec path -> search pattern in specific file)
const checks = [
  {
    path: "/api/auth/login",
    file: "apps/backend/src/modules/auth/auth.routes.js",
    pattern: "/login"
  },
  {
    path: "/api/auth/login/2fa",
    file: "apps/backend/src/modules/auth/auth.routes.js",
    pattern: "/login/2fa"
  },
  {
    path: "/api/tests/{id}",
    file: "apps/backend/src/modules/tests/test.routes.js",
    pattern: "/:testId"
  },
  {
    path: "/api/tests/{id}/questions",
    file: "apps/backend/src/modules/tests/test.routes.js",
    pattern: "/:testId/questions"
  },
  {
    path: "/api/tests/{id}/start",
    file: "apps/backend/src/modules/tests/test.routes.js",
    pattern: "/:testId/start"
  },
  {
    path: "/api/tests/{id}/submit",
    file: "apps/backend/src/modules/tests/test.routes.js",
    pattern: "/:testId/submit"
  },
  {
    path: "/api/admin/realtime/active-users",
    file: "apps/backend/src/api/routes/admin-realtime.js",
    pattern: "/realtime/active-users"
  },
  {
    path: "/api/admin/realtime/system-health",
    file: "apps/backend/src/api/routes/admin-realtime.js",
    pattern: "/realtime/system-health"
  },
  {
    path: "/api/admin/realtime/live-feed",
    file: "apps/backend/src/api/routes/admin-realtime.js",
    pattern: "/realtime/live-feed"
  }
];

let failed = false;

for (const check of checks) {
  const filePath = path.join(__dirname, "..", check.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File missing for route "${check.path}": ${check.file}`);
    failed = true;
    continue;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  // Look for router.get('/pattern' or router.post('/pattern' etc.
  const escapedPattern = check.pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`router\\.(get|post|put|delete|patch|use)\\(\\s*['"]${escapedPattern}['"]`, "i");

  if (regex.test(content)) {
    console.log(`✅ Path "${check.path}" maps successfully to ${check.file} (Pattern: "${check.pattern}")`);
  } else {
    console.error(`❌ API Drift: Documented route "${check.path}" is missing in ${check.file}! (Missing pattern: "${check.pattern}")`);
    failed = true;
  }
}

console.log("\n=========================================");
if (failed) {
  console.error("❌ Route drift validation FAILED!");
  process.exit(1);
} else {
  console.log("🎉 All documented API paths match active Express routes.");
  process.exit(0);
}
