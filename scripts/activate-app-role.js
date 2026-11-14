import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
const backendEnvPath = path.join(__dirname, "../apps/backend/.env");
const rootEnvPath = path.join(__dirname, "../.env");

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const ownerUrl = process.env.DATABASE_URL;
if (!ownerUrl) {
  console.error("❌ Error: DATABASE_URL is not set in environment.");
  process.exit(1);
}

// Parse command line args
const args = process.argv.slice(2);
let passwordArg = null;
let writeEnvFile = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--password" && args[i + 1]) {
    passwordArg = args[i + 1];
    i++;
  } else if (args[i] === "--write-env") {
    writeEnvFile = true;
  }
}

const appPassword = passwordArg || crypto.randomBytes(24).toString("base64url");

function buildAppUrl(rawOwnerUrl, user, pass) {
  const parsed = new URL(rawOwnerUrl);
  parsed.username = user;
  parsed.password = pass;
  return parsed.toString();
}

const appUrl = buildAppUrl(ownerUrl, "trstprep_app", appPassword);

const sslConfig =
  process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false };

async function activate() {
  console.log("=========================================");
  console.log("🔒 TRSTPREP RLS ACTIVATION RUNBOOK (SEC-01)");
  console.log("=========================================");

  const ownerPool = new pg.Pool({ connectionString: ownerUrl, ssl: sslConfig });

  try {
    console.log("1. Connecting as database owner (DATABASE_URL)...");
    const checkRole = await ownerPool.query(
      "SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname = 'trstprep_app'",
    );

    if (checkRole.rows.length === 0) {
      console.error(
        "❌ Role 'trstprep_app' does not exist! Migration 147 must be run first.",
      );
      process.exit(1);
    }

    console.log("   Found role:", checkRole.rows[0]);
    console.log("2. Setting LOGIN and password for trstprep_app...");

    // Escape single quotes in password for SQL statement
    const escapedPassword = appPassword.replace(/'/g, "''");
    await ownerPool.query(
      `ALTER ROLE trstprep_app WITH LOGIN PASSWORD '${escapedPassword}'`,
    );
    console.log("✅ Successfully executed: ALTER ROLE trstprep_app WITH LOGIN");
  } finally {
    await ownerPool.end();
  }

  console.log(
    "\n3. Testing connection with trstprep_app (DATABASE_APP_URL)...",
  );
  const appPool = new pg.Pool({ connectionString: appUrl, ssl: sslConfig });

  try {
    const whoami = await appPool.query(
      "SELECT current_user, session_user, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) as bypassrls",
    );
    console.log("   Connected identity:", whoami.rows[0]);

    if (whoami.rows[0].bypassrls === true) {
      console.error(
        "❌ Unexpected: trstprep_app has rolbypassrls=true. RLS cannot be enforced.",
      );
      process.exit(1);
    }
    console.log(
      "✅ Confirmed: trstprep_app rolbypassrls = false (RLS enforced)",
    );

    console.log("4. Verifying DML permissions on core tables...");
    const tableCheck = await appPool.query(
      "SELECT count(*) as user_count FROM users",
    );
    console.log(
      `✅ Table read verified (users count: ${tableCheck.rows[0].user_count})`,
    );

    const attemptCheck = await appPool.query(
      "SELECT count(*) as attempt_count FROM attempts",
    );
    console.log(
      `✅ Table read verified (attempts count: ${attemptCheck.rows[0].attempt_count})`,
    );

    console.log("\n=========================================");
    console.log("🎉 RLS APPLICATION ROLE IS ACTIVE & VERIFIED!");
    console.log("=========================================");
    console.log("\nTo enable full RLS enforcement in your runtime backend:");
    console.log("\nSet the following environment variable:");
    console.log(`DATABASE_APP_URL="${appUrl}"\n`);

    if (writeEnvFile && fs.existsSync(backendEnvPath)) {
      let content = fs.readFileSync(backendEnvPath, "utf-8");
      if (content.includes("DATABASE_APP_URL=")) {
        content = content.replace(
          /DATABASE_APP_URL=.*/,
          `DATABASE_APP_URL="${appUrl}"`,
        );
      } else {
        content += `\n# Staged RLS enforcement role (SEC-01)\nDATABASE_APP_URL="${appUrl}"\n`;
      }
      fs.writeFileSync(backendEnvPath, content, "utf-8");
      console.log(`✅ Updated ${backendEnvPath} with DATABASE_APP_URL`);
    } else {
      console.log(
        "Note: To write directly to apps/backend/.env, pass the flag --write-env",
      );
    }
  } catch (err) {
    console.error(
      "❌ Connection test failed with DATABASE_APP_URL:",
      err.message,
    );
    process.exit(1);
  } finally {
    await appPool.end();
  }
}

activate().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
