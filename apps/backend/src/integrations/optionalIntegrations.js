/**
 * Optional integrations registry.
 *
 * Some capabilities in this codebase depend on infrastructure that is not always
 * present (a Python runtime for PDF extraction, a hosted classifier API for
 * taxonomy labelling). Those modules used to be orphaned: nothing imported them,
 * so they were dead code that would silently rot.
 *
 * This registry makes them reachable and discoverable without inventing new HTTP
 * surface. Each integration is:
 *   - lazily loaded (zero boot cost when unconfigured),
 *   - gated behind an explicit env flag,
 *   - reported by GET /api/health in non-production so operators can see exactly
 *     which capability is live and what it is still missing.
 *
 * Nothing here is exposed as a public endpoint. Adding a caller for an integration
 * should go through `getIntegration(name)` so the config gate is always honoured.
 */

const truthy = (value) =>
  value === true || value === "true" || value === "1" || value === "yes";

const DEFINITIONS = {
  pdfIngestion: {
    // modules/ai/pdfProcessor.js shells out to extract_pdf.py via PyMuPDF4LLM.
    enabled: () => truthy(process.env.ENABLE_PDF_INGESTION),
    // Loading the module is cheap; the expensive part is the python spawn, which
    // only happens inside processFile().
    loader: () => import("../modules/ai/pdfProcessor.js"),
    detail: () => ({
      reason: "ENABLE_PDF_INGESTION is not set",
      requires: ["python3 with pymupdf4llm", "ENABLE_PDF_INGESTION=true"],
    }),
  },
  taxonomyClassifier: {
    // services/taxonomyClassifier.service.mjs calls the classifier.dev HTTP API.
    // .mjs is imported directly; Node's ESM loader handles it transparently.
    enabled: () => truthy(process.env.ENABLE_TAXONOMY_CLASSIFIER),
    loader: () => import("../services/taxonomyClassifier.service.mjs"),
    detail: () => ({
      reason: process.env.CLASSIFIER_ENDPOINT
        ? "ENABLE_TAXONOMY_CLASSIFIER is not set"
        : "CLASSIFIER_ENDPOINT is not set",
      requires: ["CLASSIFIER_ENDPOINT", "ENABLE_TAXONOMY_CLASSIFIER=true"],
    }),
  },
};

const cache = new Map();

/**
 * Resolve an integration module, or null when it is disabled/unconfigured.
 * @param {"pdfIngestion"|"taxonomyClassifier"} name
 */
export const getIntegration = async (name) => {
  const def = DEFINITIONS[name];
  if (!def) throw new Error(`Unknown integration: ${name}`);
  if (!def.enabled()) return null;
  if (cache.has(name)) return cache.get(name);
  const mod = await def.loader();
  cache.set(name, mod);
  return mod;
};

/** Capability report for GET /api/health (non-production only). */
export const describeIntegrations = () => {
  const out = {};
  for (const [name, def] of Object.entries(DEFINITIONS)) {
    out[name] = def.enabled()
      ? { enabled: true }
      : { enabled: false, ...def.detail() };
  }
  return out;
};
