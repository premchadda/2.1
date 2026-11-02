/**
 * Exam Fallback Content Configuration
 *
 * Provides structured offline fallback information for examinations when
 * backend dynamic details are not yet populated in the database.
 */

export const STATIC_EXAM_CONTENT = {
  cgl: {
    overview: `The Combined Graduate Level (CGL) Examination is conducted by the Staff Selection Commission (SSC) for recruitment to various Group B and Group C posts in various Ministries/Departments of the Government of India and its subordinate offices.

The exam is conducted annually in four tiers:
• **Tier-I**: Computer Based Examination (Objective Type)
• **Tier-II**: Computer Based Examination (Objective Type)
• **Tier-III**: Descriptive Paper in English/Hindi (Pen and Paper Mode)
• **Tier-IV**: Skill Test/Computer Proficiency Test (Wherever Applicable)`,
    basicEligibility:
      "Bachelor's Degree in any discipline from a recognized University or equivalent",
    basicAgeLimit: "18-32 years (as on 01-01-2026)",
    ageRelaxation:
      "SC/ST: 5 years, OBC: 3 years, PwD: 10 years, Ex-Servicemen: 3 years",
    selectionProcess:
      "Tier-I (CBT) → Tier-II (CBT) → Tier-III (Descriptive) → Tier-IV (Skill Test/DEST)",
    examFrequency: "Once a year",
    conductingBody: "Staff Selection Commission (SSC)",
    examLevel: "National",
    posts: [
      { name: "Assistant Audit Officer", grade: "Group B", salary: "Level-8" },
      {
        name: "Assistant Accounts Officer",
        grade: "Group B",
        salary: "Level-7",
      },
      {
        name: "Assistant Section Officer",
        grade: "Group B",
        salary: "Level-6",
      },
      { name: "Inspector (CBDT/CBEC)", grade: "Group B", salary: "Level-7" },
      { name: "Sub-Inspector (CBI)", grade: "Group B", salary: "Level-6" },
      {
        name: "Junior Statistical Officer",
        grade: "Group B",
        salary: "Level-5",
      },
      { name: "Statistical Investigator", grade: "Group B", salary: "Level-5" },
      { name: "Auditor", grade: "Group C", salary: "Level-5" },
      { name: "Accountant", grade: "Group C", salary: "Level-4" },
      { name: "Upper Division Clerk", grade: "Group C", salary: "Level-4" },
      { name: "Tax Assistant", grade: "Group C", salary: "Level-4" },
    ],
    syllabus: {
      tier1: [
        {
          subject: "General Intelligence & Reasoning",
          marks: 50,
          questions: 25,
          time: 60,
        },
        { subject: "General Awareness", marks: 50, questions: 25, time: 60 },
        {
          subject: "Quantitative Aptitude",
          marks: 50,
          questions: 25,
          time: 60,
        },
        {
          subject: "English Comprehension",
          marks: 50,
          questions: 25,
          time: 60,
        },
      ],
      tier2: [
        {
          subject: "Paper-I: Quantitative Abilities",
          marks: 200,
          questions: 100,
          time: 120,
        },
        {
          subject: "Paper-II: English Language",
          marks: 200,
          questions: 200,
          time: 120,
        },
        {
          subject: "Paper-III: Statistics (JSO)",
          marks: 200,
          questions: 100,
          time: 120,
        },
        {
          subject: "Paper-IV: General Studies (AAO)",
          marks: 200,
          questions: 100,
          time: 120,
        },
      ],
    },
    preparation: {
      books: [
        {
          name: "Quantitative Aptitude",
          author: "R.S. Aggarwal",
          subject: "Maths",
        },
        {
          name: "Fast Track Objective Arithmetic",
          author: "Rajesh Verma",
          subject: "Maths",
        },
        {
          name: "English for General Competitions",
          author: "Neetu Singh",
          subject: "English",
        },
        { name: "Lucent GK", author: "Lucent Publications", subject: "GK" },
        {
          name: "Analytical Reasoning",
          author: "M.K. Pandey",
          subject: "Reasoning",
        },
      ],
      tips: [
        "Start with basics and build strong foundations in each subject",
        "Practice previous year papers extensively",
        "Take regular mock tests to assess your preparation",
        "Focus on time management during the exam",
        "Keep yourself updated with current affairs",
        "Revise important formulas and concepts regularly",
      ],
    },
  },
  chsl: {
    overview: `The Combined Higher Secondary Level (CHSL) Examination is conducted by SSC for recruitment to various posts like Lower Division Clerk (LDC), Junior Secretariat Assistant (JSA), and Data Entry Operator (DEO).

The exam consists of three tiers:
• **Tier-I**: Computer Based Test (Objective)
• **Tier-II**: Descriptive Paper (Pen and Paper Mode)
• **Tier-III**: Skill Test/Typing Test`,
    basicEligibility:
      "12th Pass or equivalent from a recognized Board/University",
    basicAgeLimit: "18-27 years (as on 01-01-2026)",
    ageRelaxation: "SC/ST: 5 years, OBC: 3 years, PwD: 10 years",
    selectionProcess:
      "Tier-I (CBT) → Tier-II (Descriptive) → Tier-III (Skill Test)",
    examFrequency: "Once a year",
    conductingBody: "Staff Selection Commission (SSC)",
    examLevel: "National",
    posts: [
      { name: "Lower Division Clerk", grade: "Group C", salary: "Level-2" },
      {
        name: "Junior Secretariat Assistant",
        grade: "Group C",
        salary: "Level-2",
      },
      { name: "Data Entry Operator", grade: "Group C", salary: "Level-4" },
      {
        name: "Data Entry Operator Grade A",
        grade: "Group C",
        salary: "Level-4",
      },
    ],
    syllabus: {
      tier1: [
        { subject: "General Intelligence", marks: 50, questions: 25, time: 60 },
        { subject: "General Awareness", marks: 50, questions: 25, time: 60 },
        {
          subject: "Quantitative Aptitude",
          marks: 50,
          questions: 25,
          time: 60,
        },
        { subject: "English Language", marks: 50, questions: 25, time: 60 },
      ],
    },
    preparation: {
      books: [
        {
          name: "Quantitative Aptitude",
          author: "R.S. Aggarwal",
          subject: "Maths",
        },
        {
          name: "Objective General English",
          author: "S.P. Bakshi",
          subject: "English",
        },
        { name: "Lucent GK", author: "Lucent Publications", subject: "GK" },
      ],
      tips: [
        "Focus on accuracy as there is negative marking",
        "Practice typing regularly for Tier-III",
        "Cover NCERT basics for all subjects",
      ],
    },
  },
};

export const DEFAULT_EXAM_CONTENT = {
  title: "Information Coming Soon",
  subtitle: "Detailed exam information will be available shortly.",
  overview:
    "We are updating our exam database. Please check back later for detailed information about this examination.",
  eligibility: "Information not available yet.",
  importantDates: [],
  applyOnline: null,
  vacancyDetails: "Details will be updated soon.",
  selectionProcess: "Details will be updated soon.",
  salary: "Details will be updated soon.",
  examPattern: [],
  syllabus: [],
  keyPoints: [],
  preparationTips: [],
};
