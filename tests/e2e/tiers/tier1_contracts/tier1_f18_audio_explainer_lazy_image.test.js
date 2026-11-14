/**
 * tests/e2e/tiers/tier1_contracts/tier1_f18_audio_explainer_lazy_image.test.js
 * Feature F18: Frontend Audio Explainer & Media Hook (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F18: Frontend Audio Explainer & Media Hook", () => {
  test("T1.F18.01: useAudioExplainer.js hook file existence and structure", () => {
    const hookPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/shared/hooks/useAudioExplainer.js",
    );
    expect(fs.existsSync(hookPath)).toBe(true);

    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("speechSynthesis");
    expect(content).toContain("SpeechSynthesisUtterance");
  });

  test("T1.F18.02: useAudioExplainer supports English and Hindi voices", () => {
    const hookPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/shared/hooks/useAudioExplainer.js",
    );
    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("en-IN");
    expect(content).toContain("hi-IN");
  });

  test("T1.F18.03: useAudioExplainer implements playback controls (play, pause, stop)", () => {
    const hookPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/shared/hooks/useAudioExplainer.js",
    );
    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("pause");
    expect(content).toContain("stop");
    expect(content).toContain("play");
  });

  test("T1.F18.04: LazyImage.jsx component file existence and placeholder rendering", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/shared/components/common/LazyImage.jsx",
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("LazyImage");
    expect(content).toContain("data:image/svg+xml");
  });

  test("T1.F18.05: LazyImage.jsx uses IntersectionObserver for deferred loading", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/shared/components/common/LazyImage.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("IntersectionObserver");
  });
});
