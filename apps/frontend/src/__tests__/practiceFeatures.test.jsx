import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { formatPyqSourceLabel } from "../shared/lib/questionUtils.js";
import PracticeWorkspace from "../pages/tests/components/PracticeWorkspace";
import { BrowserRouter } from "react-router-dom";

// Mock practiceAPI
const mockGetQuestion = vi.fn();
const mockCheckAnswer = vi.fn();
const mockSkipQuestion = vi.fn();
const mockCompleteSession = vi.fn();

vi.mock("../shared/lib/practiceAPI", () => ({
  practiceAPI: {
    getQuestion: (...args) => mockGetQuestion(...args),
    checkAnswer: (...args) => mockCheckAnswer(...args),
    skipQuestion: (...args) => mockSkipQuestion(...args),
    completeSession: (...args) => mockCompleteSession(...args),
    getExplanations: vi.fn().mockResolvedValue(null),
    getApproaches: vi.fn().mockResolvedValue([]),
    getSimilarQuestions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("../shared/components/MathRenderer", () => ({
  default: ({ content, text, children }) => (
    <span>{content || text || children}</span>
  ),
}));

describe("PYP Question Label Formatting: exam name year stage date shift", () => {
  it("formats standard PYP metadata in exact sequence: exam name -> year -> stage -> date -> shift", () => {
    const question = {
      sourceConfig: {
        examName: "SSC CGL",
        year: 2024,
        stage: "Tier 1",
        date: "09 Sep 2024",
        shift: "Shift 2",
      },
    };
    const label = formatPyqSourceLabel(question);
    expect(label).toBe("SSC CGL 2024 Tier 1 09 Sep 2024 Shift 2");
  });

  it("formats numeric shift into 'Shift X'", () => {
    const question = {
      sourceConfig: {
        examName: "RRB NTPC",
        year: "2021",
        stage: "CBT 1",
        date: "28 Dec 2020",
        shift: 3,
      },
    };
    const label = formatPyqSourceLabel(question);
    expect(label).toBe("RRB NTPC 2021 CBT 1 28 Dec 2020 Shift 3");
  });

  it("handles slug-based examId and paper field", () => {
    const question = {
      sourceConfig: {
        examId: "ssc-chsl",
        year: 2023,
        paper: "Tier-I",
        date: "12 Mar 2023",
        shift: "Shift 1",
      },
    };
    const label = formatPyqSourceLabel(question);
    expect(label).toBe("SSC CHSL 2023 Tier-I 12 Mar 2023 Shift 1");
  });

  it("falls back cleanly to raw source string when structured fields are sparse", () => {
    const question = {
      source: "UPSC CSE 2023 Prelims Paper 1",
    };
    const label = formatPyqSourceLabel(question);
    expect(label).toBe("UPSC CSE 2023 Prelims Paper 1");
  });

  it("extracts missing stage and date from testTitle (user exact SSC CGL 2024 case)", () => {
    const question = {
      id: 20076,
      testTitle: "SSC CGL 2024 Tier 1 - 24 Sep 2024 - Shift 3",
      sourceConfig: {
        type: "pyq",
        year: 2024,
        paper: null,
        shift: 3,
        examId: "ssc-cgl",
      },
    };
    const label = formatPyqSourceLabel(question);
    expect(label).toBe("SSC CGL 2024 Tier 1 24 Sep 2024 Shift 3");
  });

  it("extracts missing date, stage, and shift from candidate text when sourceConfig has only exam and year", () => {
    const question = {
      sourceConfig: {
        examName: "SSC CGL",
        year: 2022,
      },
      testTitle: "SSC CGL 2022 Tier 1 - 06 Dec 2022 - Shift 1",
    };
    const label = formatPyqSourceLabel(question);
    expect(label).toBe("SSC CGL 2022 Tier 1 06 Dec 2022 Shift 1");
  });

  it("returns null if no PYP metadata is present", () => {
    const question = {
      questionText: "Sample normal question",
    };
    const label = formatPyqSourceLabel(question);
    expect(label).toBeNull();
  });
});

describe("PracticeWorkspace Question Palette & Next/Previous navigation", () => {
  const sampleSession = {
    id: "sess-999",
    mode: "learn",
    totalQuestions: 5,
    currentIndex: 0,
    questions: [101, 102, 103, 104, 105],
  };

  const sampleQ1 = {
    id: 101,
    questionText: "First question text?",
    options: ["Option A", "Option B", "Option C", "Option D"],
    subject: "Quant",
    topic: "Percentages",
    difficulty: "medium",
    sourceConfig: {
      examName: "SSC CGL",
      year: 2024,
      stage: "Tier 1",
      date: "09 Sep 2024",
      shift: "Shift 2",
    },
  };

  const sampleQ2 = {
    id: 102,
    questionText: "Second question text?",
    options: ["20", "30", "40", "50"],
    subject: "Quant",
    topic: "Percentages",
    difficulty: "easy",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQuestion.mockImplementation((sessId, idx) => {
      if (idx === 0) return Promise.resolve(sampleQ1);
      return Promise.resolve(sampleQ2);
    });
    mockCheckAnswer.mockResolvedValue({
      isCorrect: true,
      correctOption: 1,
    });
  });

  it("renders desktop question palette with question numbers and PYP badge", async () => {
    render(
      <BrowserRouter>
        <PracticeWorkspace session={sampleSession} />
      </BrowserRouter>,
    );

    // Wait for first question to load
    await waitFor(() => {
      expect(screen.getByText("First question text?")).toBeInTheDocument();
    });

    // Verify PYP badge appears with formatted sequence
    expect(
      screen.getByText("SSC CGL 2024 Tier 1 09 Sep 2024 Shift 2"),
    ).toBeInTheDocument();

    // Verify Question Palette header is present
    expect(screen.getByText("Question Palette")).toBeInTheDocument();

    // Verify all 5 question number buttons exist in palette
    expect(screen.getByTitle("Question 1")).toBeInTheDocument();
    expect(screen.getByTitle("Question 2")).toBeInTheDocument();
    expect(screen.getByTitle("Question 3")).toBeInTheDocument();
    expect(screen.getByTitle("Question 4")).toBeInTheDocument();
    expect(screen.getByTitle("Question 5")).toBeInTheDocument();
  });

  it("allows navigating questions via Next and Previous buttons and Palette jumping", async () => {
    render(
      <BrowserRouter>
        <PracticeWorkspace session={sampleSession} />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("First question text?")).toBeInTheDocument();
    });

    // Jump to Question 2 by clicking its palette button
    fireEvent.click(screen.getByTitle("Question 2"));

    await waitFor(() => {
      expect(mockGetQuestion).toHaveBeenCalledWith("sess-999", 1);
    });

    // Question 2 should now be loaded
    await waitFor(() => {
      expect(screen.getByText("Second question text?")).toBeInTheDocument();
    });

    // Jump back to Question 1 by clicking Previous
    const prevBtns = screen.getAllByRole("button", { name: /previous|prev/i });
    fireEvent.click(prevBtns[0]);

    await waitFor(() => {
      expect(mockGetQuestion).toHaveBeenCalledWith("sess-999", 0);
    });
  });
});

describe("Practice Slug URL & Title Generation", () => {
  it("formats slug-based practice URL from chapter and subject without raw IDs", () => {
    const subjectId = "quantitative-aptitude";
    const chapter = {
      id: "chp_08220a44-bb5f-41e5-8542-990b2a23a9da",
      slug: "number-system",
      title: "Number System",
    };

    const chapterSlug =
      chapter.slug ||
      chapter.title
        ?.toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") ||
      chapter.id;

    const url = `/practice/subject/${encodeURIComponent(subjectId)}/${encodeURIComponent(chapterSlug)}`;
    expect(url).toBe("/practice/subject/quantitative-aptitude/number-system");
    expect(url).not.toContain("chp_08220a44");
  });

  it("formats slug title helper properly", () => {
    function formatSlugToTitle(slug) {
      if (!slug) return "";
      return String(slug)
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    expect(formatSlugToTitle("quantitative-aptitude")).toBe(
      "Quantitative Aptitude",
    );
    expect(formatSlugToTitle("blood-relations")).toBe("Blood Relations");
    expect(formatSlugToTitle("ssc-cgl")).toBe("Ssc Cgl");
  });

  it("derives subtopics and question types collections for umbrella topics like Analogy", () => {
    const chapterData = {
      chapter: { id: 5, title: "Chapter 1: Analogy", slug: "analogy" },
      chapterTopicTypes: [
        { topicId: 9, name: "Analogy", questionCount: 2057 },
        { topicId: 24, name: "Word Analogy", questionCount: 695 },
        { topicId: 25, name: "Number Analogy", questionCount: 1236 },
        { topicId: 26, name: "Letter Analogy", questionCount: 486 },
        { topicId: 27, name: "Figure Analogy", questionCount: 463 },
      ],
      topics: [
        {
          id: 9,
          name: "Topic 1: Analogy",
          questionCount: 2057,
          subtopics: [{ id: 1, name: "Analogy Concepts", questionCount: 2057 }],
          topicTypes: [
            { topicId: 24, name: "Word Analogy", questionCount: 695 },
            { topicId: 25, name: "Number Analogy", questionCount: 1236 },
            { topicId: 26, name: "Letter Analogy", questionCount: 486 },
            { topicId: 27, name: "Figure Analogy", questionCount: 463 },
          ],
        },
      ],
    };

    const currentTopic = chapterData.topics[0];
    const direct = (currentTopic.subtopics || []).filter(
      (st) => (st.questionCount || 0) > 0,
    );
    const types = (currentTopic.topicTypes || []).filter(
      (tt) => (tt.questionCount || 0) > 0,
    );

    let items = [];
    if (types.length > 0) {
      items = [...types];
      for (const d of direct) {
        if (
          !items.some((it) => it.name.toLowerCase() === d.name.toLowerCase())
        ) {
          items.unshift(d);
        }
      }
    } else if (direct.length > 0) {
      items = [...direct];
    }

    expect(items.length).toBe(5); // 1 concept subtopic + 4 question types
    expect(items.map((i) => i.name)).toEqual([
      "Analogy Concepts",
      "Word Analogy",
      "Number Analogy",
      "Letter Analogy",
      "Figure Analogy",
    ]);
  });
});

describe("PracticeWorkspace Language Persistence & Hindi Rendering", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("persists language selection across questions and loads Hindi text and explanation", async () => {
    const bilingualQ1 = {
      id: 101,
      questionText: "What is 2 + 2?",
      questionTextHi: "2 + 2 क्या है?",
      options: ["3", "4", "5", "6"],
      optionsHi: ["३", "४", "५", "६"],
      explanation: "2 plus 2 equals 4.",
      explanationHi: "2 और 2 का योग 4 होता है।",
      subject: "Math",
      topic: "Addition",
      difficulty: "easy",
    };

    const bilingualQ2 = {
      id: 102,
      questionText: "What is 3 + 3?",
      questionTextHi: "3 + 3 क्या है?",
      options: ["5", "6", "7", "8"],
      optionsHi: ["५", "६", "७", "८"],
      explanation: "3 plus 3 equals 6.",
      explanationHi: "3 और 3 का योग 6 होता है।",
      subject: "Math",
      topic: "Addition",
      difficulty: "easy",
    };

    mockGetQuestion.mockImplementation((sessId, idx) => {
      return Promise.resolve(idx === 0 ? bilingualQ1 : bilingualQ2);
    });

    mockCheckAnswer.mockResolvedValue({
      isCorrect: true,
      correctOption: 1,
      explanation: "2 plus 2 equals 4.",
      explanationHi: "2 और 2 का योग 4 होता है।",
    });

    render(
      <BrowserRouter>
        <PracticeWorkspace
          session={{
            id: "sess-lang",
            currentIndex: 0,
            totalQuestions: 2,
            questions: [bilingualQ1, bilingualQ2],
          }}
          onExit={vi.fn()}
          onComplete={vi.fn()}
        />
      </BrowserRouter>,
    );

    // Initial load: English by default
    await waitFor(() => {
      expect(screen.getByText("What is 2 + 2?")).toBeInTheDocument();
    });

    // Toggle to Hindi
    const hiButton = screen.getByRole("button", { name: "हिं" });
    fireEvent.click(hiButton);

    // Question 1 text should now be in Hindi
    await waitFor(() => {
      expect(screen.getByText("2 + 2 क्या है?")).toBeInTheDocument();
    });

    // Preference should be saved in localStorage
    expect(localStorage.getItem("trstprep_practice_lang")).toBe("hi");

    // Select option and check answer
    const optionB = screen.getByRole("button", { name: /B.*४/i });
    fireEvent.click(optionB);
    const checkBtn = screen.getByRole("button", { name: /check/i });
    fireEvent.click(checkBtn);

    // Explanation should render in Hindi
    await waitFor(() => {
      expect(screen.getByText("2 और 2 का योग 4 होता है।")).toBeInTheDocument();
      expect(screen.getByText("सही उत्तर! (Correct)")).toBeInTheDocument();
    });

    // Navigate to Question 2
    const nextBtn = screen.getByRole("button", { name: /next question/i });
    fireEvent.click(nextBtn);

    // Question 2 should automatically render in Hindi WITHOUT resetting to English!
    await waitFor(() => {
      expect(screen.getByText("3 + 3 क्या है?")).toBeInTheDocument();
    });

    // Language in localStorage must remain "hi"
    expect(localStorage.getItem("trstprep_practice_lang")).toBe("hi");
  });
});
