import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ImportHistoryModal from "../components/ImportHistoryModal";
import { adminAPI } from "../../../../shared/lib/dataService";

vi.mock("../../../../shared/lib/dataService", () => ({
  adminAPI: {
    getImportHistory: vi.fn(),
  },
}));

describe("ImportHistoryModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    render(<ImportHistoryModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText("Import History")).toBeNull();
  });

  it("renders history records when open and data loads", async () => {
    adminAPI.getImportHistory.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            id: "101",
            action: "question_import",
            details: JSON.stringify({
              fileName: "physics_questions.xlsx",
              totalRecords: 45,
              imported: 45,
            }),
            timestamp: "2026-11-13T10:00:00Z",
            adminUser: "SuperAdmin",
          },
        ],
      },
    });

    render(<ImportHistoryModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText("Loading import history...")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Import History")).toBeDefined();
      expect(screen.getByText("physics_questions.xlsx")).toBeDefined();
      expect(screen.getByText("by SuperAdmin")).toBeDefined();
      expect(screen.getByText(/45 imported/)).toBeDefined();
    });
  });
});
