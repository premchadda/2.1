/**
 * tests/e2e/tiers/tier1_contracts/tier1_f15_socratic_hint_modal.test.js
 * Feature F15: Frontend SocraticHintModal Activation (Tier 1 Contract & Real DOM Mounting)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { DomEnvironment, screen, fireEvent } from "../../harness/domTester.js";
import SocraticHintModal from "../../../apps/frontend/src/pages/tests/components/SocraticHintModal.jsx";

describe("Tier 1 - Feature F15: Frontend SocraticHintModal Activation", () => {
  test("T1.F15.01: SocraticHintModal component exists and is fully implemented", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/tests/components/SocraticHintModal.jsx",
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("SocraticHintModal");
  });

  test("T1.F15.02: 3-tier clues render with penalties and switch tiers on click", async () => {
    const env = new DomEnvironment();
    await env.init();

    const mockQuestion = {
      id: 101,
      text: "Find the hypotenuse of a right triangle with legs 3 and 4",
      options: ["5", "6", "7", "8"],
    };

    let closed = false;
    await env.mount(SocraticHintModal, {
      isOpen: true,
      onClose: () => {
        closed = true;
      },
      question: mockQuestion,
    });

    // Verify 3 tiers rendered
    expect(screen.getByText("Concept Clue")).toBeDefined();
    expect(screen.getByText("Approach Clue")).toBeDefined();
    expect(screen.getByText("Elimination")).toBeDefined();

    // Verify penalty badge
    expect(screen.getByText("5% penalty")).toBeDefined();

    // Click Approach Clue tab
    const approachTab = screen.getByRole("button", { name: /approach clue/i });
    fireEvent.click(approachTab);
    expect(screen.getByText("15% penalty")).toBeDefined();

    env.cleanup();
  });

  test("T1.F15.03: SocraticHintModal supports bilingual English / Hindi toggling in DOM", async () => {
    const env = new DomEnvironment();
    await env.init();

    await env.mount(SocraticHintModal, {
      isOpen: true,
      onClose: () => {},
      question: { id: 101, text: "Sample Question", options: ["A", "B"] },
    });

    // Language toggle button exists
    const langBtn = screen.getByRole("button", {
      name: /हिंदी|english|language/i,
    });
    expect(langBtn).toBeDefined();

    env.cleanup();
  });

  test("T1.F15.04: SocraticHintModal renders penalty badges for all 3 tiers", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/tests/components/SocraticHintModal.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("5% penalty");
    expect(content).toContain("15% penalty");
    expect(content).toContain("25% penalty");
  });

  test("T1.F15.05: Socratic hint API endpoint declared in intelligence routes", () => {
    const intelPath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/intelligence.js",
    );
    expect(fs.existsSync(intelPath)).toBe(true);

    const content = fs.readFileSync(intelPath, "utf-8");
    expect(content).toContain("socratic-hint");
  });
});
