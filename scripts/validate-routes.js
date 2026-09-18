import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "apps/backend/src");
const ENTRY = path.join(SRC, "app-port5001.js");

// Tuneables (floors, not exact pins — the surface grows; floors catch regressions
// without brittle-failing on every new mount).
const EXPECTED_MIN_API_MOUNTS = 60; // canonical /api mounts in app-port5001.js (72 as of Sep 2026)
const EXPECTED_MIN_ADMIN_ROUTERS = 30; // admin-*.js router files under api/routes/

const entrySrc = fs.readFileSync(ENTRY, "utf-8");
let failed = false;
const fail = (msg) => {
  console.error(`❌ ${msg}`);
  failed = true;
};
const ok = (msg) => console.log(`✅ ${msg}`);

console.log("=========================================");
console.log("🔍 TRSTPREP API DRIFT VALIDATOR");
console.log("=========================================");

// ---------------------------------------------------------------------------
// 1. Parse app.use("/api...", <routerVar>) mounts from the composition root.
//    Simple line regex — no new deps.
// ---------------------------------------------------------------------------
const mountRe = /app\.use\(\s*["']([^"']+)["']\s*(.*?)\)\s*;/g;
const apiMounts = [];
let m;
while ((m = mountRe.exec(entrySrc)) !== null) {
  const mountPath = m[1];
  const rest = m[2] || "";
  if (!mountPath.startsWith("/api")) continue;
  // Router variable = last identifier in the arg list (after middlewares).
  const idents = rest.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [];
  const routerVar = idents.length ? idents[idents.length - 1] : "(unknown)";
  apiMounts.push({ mountPath, routerVar });
}

console.log(
  `\n— Composition root mounts: ${apiMounts.length} /api entries (floor: ${EXPECTED_MIN_API_MOUNTS})`,
);
if (apiMounts.length < EXPECTED_MIN_API_MOUNTS) {
  fail(
    `Only ${apiMounts.length} /api mounts found in app-port5001.js (expected >= ${EXPECTED_MIN_API_MOUNTS}). A router may have been unmounted.`,
  );
} else {
  ok(`${apiMounts.length} /api mounts present in app-port5001.js`);
}

// ---------------------------------------------------------------------------
// 2. Resolve each mounted router variable to its imported file and verify it
//    exists on disk. Catches "mounted but file deleted/renamed" drift.
// ---------------------------------------------------------------------------
console.log(`\n— Resolving ${apiMounts.length} mounted router targets...`);
// Build import map: `import <name> from "<rel>"` and `import { <name> } from "<rel>"`.
const importMap = new Map();
for (const line of entrySrc.split("\n")) {
  let im = line.match(
    /^\s*import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+["']([^"']+)["']/,
  );
  if (im) {
    importMap.set(im[1], im[2]);
    continue;
  }
  im = line.match(/^\s*import\s*\{([^}]+)\}\s*from\s+["']([^"']+)["']/);
  if (im) {
    for (const name of im[1].split(",").map((s) =>
      s
        .trim()
        .split(/\s+as\s+/)
        .pop()
        .trim(),
    )) {
      if (name) importMap.set(name, im[2]);
    }
  }
}

const resolveImport = (rel) => {
  if (!rel.startsWith(".")) return null; // bare package — nothing to check on disk
  let abs = path.resolve(SRC, rel);
  if (fs.existsSync(abs)) return abs;
  if (fs.existsSync(abs + ".js")) return abs + ".js";
  if (fs.existsSync(path.join(abs, "index.js")))
    return path.join(abs, "index.js");
  return null;
};

let unresolved = 0;
for (const { mountPath, routerVar } of apiMounts) {
  if (routerVar === "(unknown)") {
    console.log(
      `⚠️  ${mountPath}: no router identifier parsed (likely inline middleware) — skipped`,
    );
    continue;
  }
  // Middleware fns (limiters/guards) are not routers; only resolve vars with imports.
  if (!importMap.has(routerVar)) {
    // Mounted via function call result (e.g. mountExtractedRoutes) or inline — note + skip.
    if (/mount/i.test(routerVar)) {
      console.log(
        `ℹ️  ${mountPath}: mounted via ${routerVar}(...) — verified separately below`,
      );
    } else {
      console.log(
        `⚠️  ${mountPath}: "${routerVar}" has no import in entry (middleware?) — skipped`,
      );
    }
    continue;
  }
  const abs = resolveImport(importMap.get(routerVar));
  if (!abs) {
    fail(
      `${mountPath}: router "${routerVar}" imports "${importMap.get(routerVar)}" — file NOT FOUND on disk`,
    );
    unresolved++;
  }
}
if (!unresolved) ok("All imported router targets resolve to files on disk");

// ---------------------------------------------------------------------------
// 3. Admin routers: every admin-*.js router file must be reachable.
//    Current design: single canonical admin.js mounted via mountAdminRoutes()
//    (admin-routes-index.js), with extracted admin-* routers consolidated into
//    it — so reachability = imported (directly or transitively) by admin.js.
// ---------------------------------------------------------------------------
console.log("\n— Admin router coverage...");
const routesDir = path.join(SRC, "api/routes");
const adminFiles = fs
  .readdirSync(routesDir)
  .filter((f) => f.startsWith("admin-") && f.endsWith(".js"))
  .filter((f) => !["admin-routes-index.js", "admin-helpers.js"].includes(f))
  .sort();
console.log(
  `   Found ${adminFiles.length} admin router files (floor: ${EXPECTED_MIN_ADMIN_ROUTERS})`,
);
if (adminFiles.length < EXPECTED_MIN_ADMIN_ROUTERS) {
  fail(
    `Only ${adminFiles.length} admin router files (expected >= ${EXPECTED_MIN_ADMIN_ROUTERS})`,
  );
} else {
  ok(`${adminFiles.length} admin router files present`);
}

const adminJs = fs.readFileSync(path.join(routesDir, "admin.js"), "utf-8");
const adminIndexJs = fs.readFileSync(
  path.join(routesDir, "admin-routes-index.js"),
  "utf-8",
);
if (!/\/api\/admin/.test(entrySrc) && !/\/api\/admin/.test(adminIndexJs)) {
  fail(
    'No "/api/admin" mount found in app-port5001.js or admin-routes-index.js',
  );
} else {
  ok('"/api/admin" mount present (entry and/or mountAdminRoutes)');
}
let orphanAdmin = 0;
for (const f of adminFiles) {
  const base = f.replace(/\.js$/, "");
  // Referenced by filename fragment in admin.js (import path or comment) → reachable.
  if (!adminJs.includes(base)) {
    console.log(
      `⚠️  ${f}: not referenced by name in admin.js — verify it is wired (or intentionally standalone)`,
    );
    orphanAdmin++;
  }
}
if (!orphanAdmin) ok("All admin routers referenced from canonical admin.js");

// ---------------------------------------------------------------------------
// 4. Module routes: every modules/*/*.routes.js file must be imported by the
//    entry (i.e. no dormant unmounted module silently rotting).
//    Dormant modules are FATAL: an unmounted module means dead code shipping
//    (or a feature silently offline). Fix by mounting it in app-port5001.js
//    or deleting the file — do not demote this back to a warning.
//    (Admin-file "unreferenced" notes in section 3 stay warnings: extracted
//    admin-* routers are consolidated via mountAdminRoutes() and are logged
//    clearly above for manual review.)
// ---------------------------------------------------------------------------
console.log("\n— Module route coverage...");
const modulesDir = path.join(SRC, "modules");
const moduleRouteFiles = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.routes\.js$/.test(e.name)) moduleRouteFiles.push(p);
  }
};
if (fs.existsSync(modulesDir)) walk(modulesDir);
console.log(`   Found ${moduleRouteFiles.length} module route files`);
let unmounted = 0;
for (const abs of moduleRouteFiles) {
  const rel = path.relative(SRC, abs).replace(/\\/g, "/"); // e.g. modules/auth/auth.routes.js
  const short = rel.replace(/^modules\//, "").replace(/\.routes\.js$/, "");
  // Import path as written in entry: "./modules/<short>.routes.js" (or .routes variant)
  const imported =
    entrySrc.includes(`./${rel}`) ||
    entrySrc.includes(`./${rel.replace(/\.js$/, "")}`);
  if (!imported) {
    console.log(
      `⚠️  ${rel}: not imported by app-port5001.js — dormant module? (short: ${short})`,
    );
    unmounted++;
  }
}
if (!unmounted)
  ok("All module route files are imported by the composition root");
else {
  fail(
    `${unmounted} dormant module route file(s) — mount them in app-port5001.js or delete them (see list above).`,
  );
}

// ---------------------------------------------------------------------------
// 5. Legacy openapi drift checks (original 9-path spot checks). Skipped with a
//    warning if the spec is absent; failures here are fatal (documented API
//    must match code).
// ---------------------------------------------------------------------------
console.log("\n— OpenAPI drift spot-checks...");
const specPath = path.join(ROOT, "apps/backend/openapi-spec.yaml");
const checks = [
  {
    path: "/api/auth/login",
    file: "apps/backend/src/modules/auth/auth.routes.js",
    pattern: "/login",
  },
  {
    path: "/api/auth/login/2fa",
    file: "apps/backend/src/modules/auth/auth.routes.js",
    pattern: "/login/2fa",
  },
  {
    path: "/api/tests/{id}",
    file: "apps/backend/src/modules/tests/test.routes.js",
    pattern: "/:testId",
  },
  {
    path: "/api/tests/{id}/questions",
    file: "apps/backend/src/modules/tests/test.routes.js",
    pattern: "/:testId/questions",
  },
  {
    path: "/api/tests/{id}/start",
    file: "apps/backend/src/modules/tests/test.routes.js",
    pattern: "/:testId/start",
  },
  {
    path: "/api/tests/{id}/submit",
    file: "apps/backend/src/modules/tests/test.routes.js",
    pattern: "/:testId/submit",
  },
  {
    path: "/api/admin/realtime/active-users",
    file: "apps/backend/src/api/routes/admin-realtime.js",
    pattern: "/realtime/active-users",
  },
  {
    path: "/api/admin/realtime/system-health",
    file: "apps/backend/src/api/routes/admin-realtime.js",
    pattern: "/realtime/system-health",
  },
  {
    path: "/api/admin/realtime/live-feed",
    file: "apps/backend/src/api/routes/admin-realtime.js",
    pattern: "/realtime/live-feed",
  },
  // Extended spot-checks (same 9-pattern style; mounted-gated by the loop below).
  {
    path: "/api/practice/sessions",
    file: "apps/backend/src/api/routes/practice.js",
    pattern: "/sessions",
  },
  {
    path: "/api/ai/mentor/chat",
    file: "apps/backend/src/modules/ai/aiMentor.routes.js",
    pattern: "/chat",
  },
  {
    path: "/api/live-mock",
    file: "apps/backend/src/modules/live/liveMock.routes.js",
    pattern: "/",
  },
];

if (!fs.existsSync(specPath)) {
  console.log(
    "⚠️  openapi-spec.yaml absent — drift spot-checks skipped (mount checks above still apply)",
  );
} else {
  const specContent = fs.readFileSync(specPath, "utf-8");
  const paths = [];
  for (const line of specContent.split("\n")) {
    const pm = line.match(/^\s*(\/api\/[a-zA-Z0-9_/{}~-]+):/);
    if (pm) paths.push(pm[1]);
  }
  console.log(
    `Checking ${paths.length} documented API paths (${checks.length} spot-checks)...\n`,
  );
  for (const check of checks) {
    const filePath = path.join(ROOT, check.file);
    if (!fs.existsSync(filePath)) {
      fail(`File missing for route "${check.path}": ${check.file}`);
      continue;
    }
    // Spot-checks must target composition-root-mounted files, not orphan
    // controllers: the check file has to be imported by app-port5001.js
    // (directly) or consolidated through admin.js / admin-routes-index.js.
    const mounted =
      entrySrc.includes(check.file.replace(/^apps\/backend\/src\//, "./")) ||
      adminJs.includes(path.basename(check.file, ".js")) ||
      adminIndexJs.includes(path.basename(check.file, ".js"));
    if (!mounted) {
      fail(
        `Spot-check target "${check.file}" is not mounted (orphan controller?) for route "${check.path}"`,
      );
      continue;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const escapedPattern = check.pattern.replace(
      /[-/\\^$*+?.()|[\]{}]/g,
      "\\$&",
    );
    const regex = new RegExp(
      `router\\.(get|post|put|delete|patch|use)\\(\\s*['"]${escapedPattern}['"]`,
      "i",
    );
    if (regex.test(content)) {
      console.log(
        `✅ Path "${check.path}" maps successfully to ${check.file} (Pattern: "${check.pattern}")`,
      );
    } else {
      fail(
        `API Drift: Documented route "${check.path}" is missing in ${check.file}! (Missing pattern: "${check.pattern}")`,
      );
    }
  }
}

console.log("\n=========================================");
if (failed) {
  console.error("❌ Route drift validation FAILED!");
  process.exit(1);
} else {
  console.log("🎉 All route mount checks passed — no drift detected.");
  process.exit(0);
}
