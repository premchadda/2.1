/**
 * Curriculum component render tests.
 *
 * These three components shipped with undefined identifiers in scope that only
 * blew up at render time (`ReferenceError`), because admin-panel's eslint config
 * had `no-undef` disabled. ESLint now enforces `no-undef`, but these tests exist
 * to catch the same class of regression in the one place it actually matters:
 * an admin navigating to /admin/study-materials.
 *
 * CurriculumGeneralModal previously read `data.subjects`, `selectedSubjectId`
 * and `filteredSubjects`; ChapterPageModal read `selectedChapterTopic`,
 * `selectedChapterSubtopic` and `handleReorderResource`; CurriculumBuilder
 * passed six props that were never declared (`subjects`, `units`, `chapters`,
 * `topics`, `subtopics`, `reorderChapterResource`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
} from "@testing-library/react";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// NOTE: this file lives one level deeper (…/study-materials/__tests__/) than the
// components under test, so the module specifiers need four hops, not three.
vi.mock("../../../../shared/components/common/ConfirmModal", () => ({
  confirmOnce: vi.fn(),
}));

const mockGet = vi.fn();
vi.mock("../../../../shared/lib/dataService.js", () => ({
  apiClient: {
    get: (...args) => mockGet(...args),
    put: vi.fn().mockResolvedValue({ data: { data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
}));

import CurriculumGeneralModal from "../components/CurriculumGeneralModal";
import ChapterPageModal from "../components/ChapterPageModal";
import CurriculumBuilder from "../CurriculumBuilder";

const getEntityId = (x) => String(x?.id ?? x?._id ?? "");

// The real CHAPTER_CONTENT_TABS entries carry an `icon` component; ChapterPageModal
// renders <Icon/> straight from it, so the fixture must too.
const TabIcon = () => <span>i</span>;

const SUBJECTS = [{ id: 1, name: "Quantitative Aptitude" }];
const UNITS = [{ id: 11, name: "Number System", subject_id: 1 }];
const CHAPTERS = [{ id: 21, title: "Divisibility", subject_id: 1 }];
const TOPICS = [{ id: 31, name: "Divisibility Rules", chapter_id: 21 }];

function mockCurriculumPayload() {
  mockGet.mockImplementation((url) =>
    Promise.resolve({
      data: {
        data:
          url === "/admin/subjects"
            ? SUBJECTS
            : url === "/admin/units"
              ? UNITS
              : url === "/admin/chapters"
                ? CHAPTERS
                : url === "/admin/topics"
                  ? TOPICS
                  : [],
      },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCurriculumPayload();
  localStorage.clear();
});

afterEach(() => cleanup());

describe("CurriculumGeneralModal", () => {
  const baseProps = {
    setModalConfig: vi.fn(),
    setFormData: vi.fn(),
    handleSave: vi.fn(),
    HIERARCHY_TABS: [
      { id: "parts", label: "Parts" },
      { id: "units", label: "Units" },
      { id: "chapters", label: "Chapters" },
      { id: "topics", label: "Topics" },
      { id: "subtopics", label: "Subtopics" },
    ],
    subjects: SUBJECTS,
    units: UNITS,
    chapters: CHAPTERS,
    topics: TOPICS,
    subtopics: [],
    selectedSubject: null,
    getEntityId,
  };

  it.each([
    ["parts", "assign-to-subject"],
    ["units", "assign-to-subject-2"],
    ["chapters", "assign-to-subject-or-unit"],
    ["topics", "assign-to-chapter"],
    ["subtopics", "assign-to-topic"],
  ])("renders the %s tab parent picker without throwing", (tabId, selectId) => {
    expect(() =>
      render(
        <CurriculumGeneralModal
          {...baseProps}
          modalConfig={{ item: null, tabId }}
          activeTab={tabId}
          formData={{ parentId: "", name: "" }}
        />,
      ),
    ).not.toThrow();
    expect(screen.getByLabelText(/assign to/i)).toBeInTheDocument();
    expect(document.getElementById(selectId)).not.toBeNull();
  });

  it("populates the subject dropdown from the subjects prop", () => {
    render(
      <CurriculumGeneralModal
        {...baseProps}
        modalConfig={{ item: null, tabId: "parts" }}
        activeTab="parts"
        formData={{ parentId: "", name: "" }}
      />,
    );
    expect(
      screen.getByRole("option", { name: "Quantitative Aptitude" }),
    ).toBeInTheDocument();
  });

  it("chapters tab lists both subjects and units as parent options", () => {
    render(
      <CurriculumGeneralModal
        {...baseProps}
        modalConfig={{ item: null, tabId: "chapters" }}
        activeTab="chapters"
        formData={{ parentId: "", name: "" }}
      />,
    );
    const select = document.getElementById("assign-to-subject-or-unit");
    expect(
      [...select.querySelectorAll("optgroup")].map((g) => g.label),
    ).toEqual(["Directly under Subject", "Inside a Unit"]);
    expect(
      [...select.querySelectorAll("option")].map((o) => o.textContent),
    ).toEqual(
      expect.arrayContaining(["Quantitative Aptitude", "Number System"]),
    );
  });

  it("tolerates missing list props instead of throwing", () => {
    expect(() =>
      render(
        <CurriculumGeneralModal
          {...baseProps}
          subjects={undefined}
          units={undefined}
          chapters={undefined}
          topics={undefined}
          modalConfig={{ item: null, tabId: "chapters" }}
          activeTab="chapters"
          formData={{ parentId: "", name: "" }}
        />,
      ),
    ).not.toThrow();
  });

  it("renders nothing for the subjects/hierarchy tabs", () => {
    const { container } = render(
      <CurriculumGeneralModal
        {...baseProps}
        modalConfig={{ item: null, tabId: "parts" }}
        activeTab="subjects"
        formData={{ parentId: "", name: "" }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("ChapterPageModal", () => {
  const chapterProps = {
    chapterView: {
      open: true,
      chapter: { id: 21, title: "Divisibility" },
      subject: { id: 1, name: "Quantitative Aptitude" },
      topics: [
        {
          id: 31,
          name: "Divisibility Rules",
          subtopics: [{ id: 41, name: "Rule of 11" }],
        },
      ],
      selectedTopicId: "31",
      selectedSubtopicId: "41",
      activeTab: "videos",
    },
    setChapterView: vi.fn(),
    closeChapterView: vi.fn(),
    CHAPTER_CONTENT_TABS: [{ id: "videos", label: "Videos", icon: TabIcon }],
    getLevelEmoji: () => "#",
    getEntityId,
    navigate: vi.fn(),
    reorderChapterResource: vi.fn(),
    chapterActiveItems: [],
    chapterActiveTabConfig: { emptyText: "No videos" },
    getChapterTabCount: () => 0,
    getResourceTitle: (x) => x?.title || "",
    getResourceUrl: () => "",
    // Contract: an array of display strings (see CurriculumBuilder getResourceMeta).
    getResourceMeta: () => [],
  };

  it("resolves the selected topic/subtopic breadcrumb from ids", () => {
    expect(() => render(<ChapterPageModal {...chapterProps} />)).not.toThrow();
    expect(screen.getByText(/^Topic:/)).toHaveTextContent("Divisibility Rules");
    expect(screen.getByText(/^Subtopic:/)).toHaveTextContent("Rule of 11");
  });

  it("omits the breadcrumb chips when nothing is selected", () => {
    render(
      <ChapterPageModal
        {...chapterProps}
        chapterView={{ ...chapterProps.chapterView, selectedTopicId: "" }}
      />,
    );
    // The sidebar still lists every topic; assert on the breadcrumb chip only.
    expect(screen.queryByText(/^Topic:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Subtopic:/)).not.toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ChapterPageModal
        {...chapterProps}
        chapterView={{ ...chapterProps.chapterView, open: false }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("tolerates a chapter with no topics array", () => {
    expect(() =>
      render(
        <ChapterPageModal
          {...chapterProps}
          chapterView={{ ...chapterProps.chapterView, topics: undefined }}
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText(/No topics linked/i)).toBeInTheDocument();
  });

  it("calls the reorder prop (not a stray handle) when moving a resource", () => {
    const reorder = vi.fn();
    render(
      <ChapterPageModal
        {...chapterProps}
        reorderChapterResource={reorder}
        chapterActiveItems={[
          { id: 1, title: "Clip A" },
          { id: 2, title: "Clip B" },
        ]}
      />,
    );
    fireEvent.click(screen.getAllByTitle("Move Up")[1]);
    expect(reorder).toHaveBeenCalledWith("up", { id: 2, title: "Clip B" }, 1);
    fireEvent.click(screen.getAllByTitle("Move Down")[0]);
    expect(reorder).toHaveBeenCalledWith("down", { id: 1, title: "Clip A" }, 0);
  });
});

describe("CurriculumBuilder", () => {
  it("mounts, loads the six hierarchy endpoints and renders", async () => {
    let container;
    await act(async () => {
      ({ container } = render(<CurriculumBuilder />));
    });
    expect(container).toBeTruthy();
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith("/admin/subjects"),
    );
    for (const url of [
      "/admin/subjects",
      "/admin/subject-parts",
      "/admin/units",
      "/admin/chapters",
      "/admin/topics",
      "/admin/subtopics",
    ]) {
      expect(mockGet).toHaveBeenCalledWith(url);
    }
    await waitFor(() =>
      expect(container.textContent).not.toMatch(/Loading curriculum builder/i),
    );
  });

  it("surfaces a load error panel with Retry instead of crashing", async () => {
    mockGet.mockRejectedValue(new Error("boom"));
    let container;
    await act(async () => {
      ({ container } = render(<CurriculumBuilder />));
    });
    await waitFor(() =>
      expect(container.textContent).toMatch(/boom|retry|failed/i),
    );
  });
});
