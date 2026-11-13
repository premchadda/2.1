import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

function findEsbuildPath() {
  const directPath = path.resolve(process.cwd(), "node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/lib/main.js");
  if (fs.existsSync(directPath)) return directPath;
  const pnpmDir = path.resolve(process.cwd(), "node_modules/.pnpm");
  if (fs.existsSync(pnpmDir)) {
    const entries = fs.readdirSync(pnpmDir);
    const esbuildDir = entries.find((e) => e.startsWith("esbuild@"));
    if (esbuildDir) {
      const candidate = path.resolve(pnpmDir, esbuildDir, "node_modules/esbuild/lib/main.js");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return directPath;
}

const esbuildPath = findEsbuildPath();
let esbuild;

export async function initialize() {
  if (!esbuild) {
    const mod = await import(pathToFileURL(esbuildPath).href);
    esbuild = mod.default || mod;
  }
}

export async function resolve(specifier, context, nextResolve) {
  const cleanSpecifier = specifier.split("?")[0].split("#")[0];
  if (
    cleanSpecifier.endsWith(".css") ||
    cleanSpecifier.endsWith(".scss") ||
    cleanSpecifier.endsWith(".sass") ||
    cleanSpecifier.endsWith(".svg") ||
    cleanSpecifier.endsWith(".png") ||
    cleanSpecifier.endsWith(".jpg") ||
    cleanSpecifier.endsWith(".webp")
  ) {
    try {
      const res = await nextResolve(cleanSpecifier, context);
      return {
        ...res,
        format: "module",
        shortCircuit: true,
      };
    } catch {
      const resolved = new URL(cleanSpecifier, context.parentURL).href;
      return {
        url: resolved,
        format: "module",
        shortCircuit: true,
      };
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" && context.parentURL?.startsWith("file:")) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const targetPath = path.resolve(parentDir, specifier);
      const candidates = [
        targetPath + ".js",
        targetPath + ".jsx",
        targetPath + ".ts",
        targetPath + ".tsx",
        path.join(targetPath, "index.js"),
        path.join(targetPath, "index.jsx"),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    throw err;
  }
}

export async function load(url, context, nextLoad) {
  const cleanUrl = url.split("?")[0].split("#")[0];

  if (cleanUrl.endsWith(".css") || cleanUrl.endsWith(".scss") || cleanUrl.endsWith(".sass")) {
    return {
      format: "module",
      shortCircuit: true,
      source: "export default 'mock-css-url';",
    };
  }

  if (cleanUrl.endsWith(".svg") || cleanUrl.endsWith(".png") || cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".webp")) {
    return {
      format: "module",
      shortCircuit: true,
      source: "export default 'mock-asset-url';",
    };
  }

  const isAppCode = cleanUrl.includes("apps/frontend/src") || cleanUrl.includes("apps/admin-panel/src");
  if (cleanUrl.endsWith(".jsx") || (cleanUrl.endsWith(".js") && isAppCode)) {
    const filePath = fileURLToPath(cleanUrl);
    const rawSource = fs.readFileSync(filePath, "utf-8");
    if (!esbuild) {
      const mod = await import(pathToFileURL(esbuildPath).href);
      esbuild = mod.default || mod;
    }
    const transformed = esbuild.transformSync(rawSource, {
      loader: cleanUrl.endsWith(".jsx") ? "jsx" : "js",
      jsx: "automatic",
      sourcefile: filePath,
      define: {
        "import.meta.env.DEV": "true",
        "import.meta.env.PROD": "false",
        "import.meta.env.MODE": '"test"',
        "import.meta.env.VITE_API_URL": '"http://localhost:5001"',
      },
    });
    return {
      format: "module",
      shortCircuit: true,
      source: transformed.code,
    };
  }
  return nextLoad(url, context);
}
