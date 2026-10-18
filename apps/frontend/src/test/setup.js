import "@testing-library/jest-dom";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import axios from "axios";

// ---------------------------------------------------------------------------
// Network isolation
//
// Without this, any test that renders a page which fetches data makes happy-dom
// open a real XMLHttpRequest to the API host. That produces unhandled
// ECONNREFUSED AggregateErrors, `[PublicSettings] Using fallback settings`
// warnings and `Fetch attempt 1 failed for ...` retries on stderr even though
// the test only asserts on rendered markup.
//
// axios.create() merges axios.defaults into the instance, so the adapter has to
// be replaced at module scope — i.e. while this setup file is evaluated, which
// happens before the test module graph (and therefore before any createApiClient
// call) is imported. Suites that exercise request behaviour explicitly still
// win: they assign `client.defaults.adapter` themselves, which shadows this.
// ---------------------------------------------------------------------------
const EMPTY_PAYLOAD = { success: true, data: [] };

const stubAdapter = async (config) => ({
  data: EMPTY_PAYLOAD,
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});

axios.defaults.adapter = stubAdapter;

// Suites that call vi.restoreAllMocks()/resetAllMocks() can wipe the default;
// re-assert it before every test so no request ever escapes to the network.
beforeEach(() => {
  axios.defaults.adapter = stubAdapter;
});

// Some modules (telemetry, offline queue, SSE) call fetch() directly.
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  statusText: "OK",
  headers: new Headers({ "content-type": "application/json" }),
  json: async () => EMPTY_PAYLOAD,
  text: async () => JSON.stringify(EMPTY_PAYLOAD),
  clone() {
    return this;
  },
});

// happy-dom serves the document without a doctype, so every KaTeX render logs
// "KaTeX doesn't work in quirks mode". Real browsers always ship a doctype;
// report standards mode so MathRenderer tests stay quiet.
if (typeof document !== "undefined") {
  Object.defineProperty(document, "compatMode", {
    value: "CSS1Compat",
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
});
