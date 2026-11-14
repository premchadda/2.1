/**
 * tests/e2e/fixtures/examFixtures.js
 * Exam categories, real dynamic shifts, syllabus hierarchies, and cutoffs.
 */

export const SAMPLE_EXAMS = [
  {
    id: 1,
    title: "SSC CGL (Combined Graduate Level)",
    slug: "ssc-cgl",
    category: "SSC",
    icon: "🏛️",
    activeYears: [2022, 2023, 2024, 2025],
    shifts: {
      2024: [
        {
          id: 1001,
          title: "2024 Tier 1 Shift 1",
          date: "2024-09-09",
          questions: 100,
          durationMinutes: 60,
          isActive: true,
        },
        {
          id: 1002,
          title: "2024 Tier 1 Shift 2",
          date: "2024-09-09",
          questions: 100,
          durationMinutes: 60,
          isActive: true,
        },
        {
          id: 1003,
          title: "2024 Tier 1 Shift 3",
          date: "2024-09-10",
          questions: 100,
          durationMinutes: 60,
          isActive: true,
        },
      ],
      2023: [
        {
          id: 901,
          title: "2023 Tier 1 Shift 1",
          date: "2023-07-14",
          questions: 100,
          durationMinutes: 60,
          isActive: true,
        },
        {
          id: 902,
          title: "2023 Tier 1 Shift 2",
          date: "2023-07-14",
          questions: 100,
          durationMinutes: 60,
          isActive: true,
        },
      ],
    },
    cutoffs: {
      2024: { UR: 145.5, OBC: 138.2, EWS: 132.0, SC: 118.4, ST: 110.0 },
      2023: { UR: 150.0, OBC: 143.5, EWS: 137.8, SC: 122.0, ST: 114.5 },
    },
    timeline: [
      {
        id: 1,
        title: "Notification Released",
        date: "2024-06-24",
        status: "completed",
      },
      {
        id: 2,
        title: "Application Window Closed",
        date: "2024-07-27",
        status: "completed",
      },
      {
        id: 3,
        title: "Tier 1 Examination",
        date: "2024-09-09",
        status: "completed",
      },
      {
        id: 4,
        title: "Tier 1 Result Declaration",
        date: "2024-11-20",
        status: "current",
      },
      {
        id: 5,
        title: "Tier 2 Examination",
        date: "2025-01-18",
        status: "upcoming",
      },
    ],
  },
  {
    id: 2,
    title: "RRB NTPC (Non-Technical Popular Categories)",
    slug: "rrb-ntpc",
    category: "Railways",
    icon: "🚆",
    activeYears: [2024, 2025],
    shifts: {
      2024: [
        {
          id: 2001,
          title: "2024 Stage 1 Shift 1",
          date: "2024-12-15",
          questions: 100,
          durationMinutes: 90,
          isActive: true,
        },
      ],
    },
    cutoffs: {
      2024: { UR: 74.2, OBC: 70.1, SC: 62.5, ST: 56.8 },
    },
    timeline: [
      {
        id: 1,
        title: "Official CEN Notification",
        date: "2024-09-14",
        status: "completed",
      },
      { id: 2, title: "CBT-1 Exam", date: "2024-12-15", status: "upcoming" },
    ],
  },
];

export const SYLLABUS_HIERARCHY = [
  {
    id: 1,
    name: "Quantitative Aptitude",
    units: [
      {
        id: 11,
        name: "Arithmetic",
        chapters: [
          {
            id: 111,
            name: "Percentages & Fractions",
            topics: [
              { id: 1111, name: "Basic Fractional Equivalents" },
              { id: 1112, name: "Successive Percentage Changes" },
            ],
          },
          {
            id: 112,
            name: "Profit, Loss & Discount",
            topics: [
              { id: 1121, name: "Marked Price & Discount Series" },
              { id: 1122, name: "Dishonest Dealer Concepts" },
            ],
          },
        ],
      },
    ],
  },
];
