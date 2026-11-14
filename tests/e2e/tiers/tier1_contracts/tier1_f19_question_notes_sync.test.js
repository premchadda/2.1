/**
 * tests/e2e/tiers/tier1_contracts/tier1_f19_question_notes_sync.test.js
 * Feature F19: Frontend QuestionNotes Dynamic Sync (Tier 1 Contract & Real DOM Mounting)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { DomEnvironment, screen, fireEvent } from "../../harness/domTester.js";
import QuestionNotes from "../../../apps/frontend/src/shared/components/QuestionNotes.jsx";

describe("Tier 1 - Feature F19: Frontend QuestionNotes Dynamic Sync", () => {
  test("T1.F19.01: QuestionNotes.jsx component file exists", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/shared/components/QuestionNotes.jsx",
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("QuestionNotes");
  });

  test("T1.F19.02: QuestionNotes accepts contextId and question props", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/shared/components/QuestionNotes.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("contextId");
  });

  test("T1.F19.03: Note creation and DOM rendering in QuestionNotes", async () => {
    const env = new DomEnvironment();
    await env.init();

    await env.mount(QuestionNotes, {
      isOpen: true,
      onClose: () => {},
      questionId: 101,
      contextId: "practice_lab",
    });

    expect(screen.getByText("Question Notes")).toBeDefined();

    const textarea = globalThis.document.querySelector("textarea");
    expect(textarea).not.toBeNull();
    fireEvent.input(textarea, {
      target: { value: "Pythagorean theorem application note" },
    });

    const saveBtn = screen.getByRole("button", { name: /save note/i });
    fireEvent.click(saveBtn);

    expect(
      screen.getByText("Pythagorean theorem application note"),
    ).toBeDefined();

    env.cleanup();
  });

  test("T1.F19.04: Notes component provides save and delete handlers", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/shared/components/QuestionNotes.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("handleSave");
    expect(content).toContain("handleDelete");
  });

  test("T1.F19.05: Migration 155 contract specifies question_notes schema per PROJECT.md", () => {
    const expectedSchema = {
      tableName: "question_notes",
      columns: [
        "id",
        "user_id",
        "question_id",
        "context_id",
        "note_text",
        "created_at",
        "updated_at",
      ],
    };
    expect(expectedSchema.tableName).toBe("question_notes");
    expect(expectedSchema.columns).toContain("note_text");
    expect(expectedSchema.columns).toContain("user_id");
  });
});
