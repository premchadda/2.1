# Practice Lab — Product Requirements Document (PRD)

**Project:** Trstprep V2.1 — Practice Lab Redesign
**Status:** Draft v1.0
**Owner:** Product
**Target ship:** Phase 1 in 2 weeks, Phase 3 in 8 weeks
**Supersedes:** Current `apps/frontend/src/pages/tests/PracticeQuestions.jsx` (368 lines)

---

## 1. Vision

> **Practice is a gym, not an exam hall.**

The Practice Lab is where users **build concepts** through unlimited, targeted, feedback-rich practice. It must feel fundamentally different from the Test Engine (`/test/:seriesId/:testId`), which simulates the exam hall.

| Practice Lab | Test Engine |
|---|---|
| "I want to improve this topic" | "I want to check how exam-ready I am" |
| Instant explanations | Delayed feedback after submission |
| Unlimited questions | Fixed exam pattern |
| Adaptive difficulty | Fixed difficulty |
| AI tutor | AI performance analyst |
| Mastery progress | Percentile & rank |
| Topic-focused | Full syllabus / section-based |
| Retry immediately | Review after completion |
| No pressure | Real exam simulation |

The two systems **feed each other**: every Test generates a Practice Plan for weak areas; every Practice session recommends the next Test once mastery is achieved.

---

## 2. User flow

```
Dashboard → Practice Lab
        ↓
Choose Exam        (SSC CGL, SSC CHSL, Railway NTPC, …)
        ↓
Choose Subject     (Quant, Reasoning, English, GK, …)
        ↓
Choose Chapter     (Percentage, Ratio, Time-Speed-Distance, …)
        ↓
Choose Topic       (Successive Percentage, Profit %, …)
        ↓
Choose Mode        (Learn, Adaptive, Mistakes, Weak, Bookmark, PYQ, Speed, Daily)
        ↓
Choose Difficulty  (Easy / Medium / Hard / Mixed)
        ↓
Choose Count       (10 / 20 / 50 / Unlimited)
        ↓
Timer?             (Off / On with target)
        ↓
Start Practice
```

After each question:

```
Answer → Check → Result
                    ↓
            Explanation
            Formula Used
            Common Mistake
            Concept Card
            AI: "Why you got this wrong"
            AI: "Try similar question"
            Bookmark / Report / Discuss
                    ↓
                Next / Skip / Prev
                    ↓
            Session Complete
                    ↓
            Mastery update
            Wrong-question notebook update
            Streak update
            "Practice wrong ones again" CTA
            "Take a 10-question topic test" CTA
```

---

## 3. Practice modes (8)

| # | Mode | Source of questions | Behavior |
|---|---|---|---|
| 1 | **Learn** (default) | All questions in selected topic, ordered by difficulty asc | Instant feedback, full explanation, no timer |
| 2 | **Adaptive** | All questions, AI picks next Q based on last-3 correctness | Difficulty auto-adjusts: 3 correct → harder, 2 wrong → easier |
| 3 | **Mistakes** | `practice_answers` where `is_correct=false` for this user | Re-attempt only previously-wrong questions; tracks if mastered |
| 4 | **Weak Topic** | AI picks topics where user accuracy < 60% (from `user_topic_performance`) | Mixed across weak topics; goal is to lift accuracy |
| 5 | **Bookmark** | `question_bookmarks` for this user | Re-practice saved questions only |
| 6 | **PYQ** | Questions tagged `is_pyq=true` filtered by exam+year+subject | Real previous-year questions in practice format |
| 7 | **Speed** | Random sample of 10–20 questions, optional short timer (e.g. 10 min) | Goal: improve speed; timer optional but always visible |
| 8 | **Daily** | AI-curated 20 fresh questions across user's enrolled exam(s) | Streak tracking; resets at midnight IST; only one set per day |

### Mode picker UI

The mode picker is a **card grid**, not a dropdown — each card shows an icon, name, description, and availability state (locked if no data, e.g. Bookmark mode with 0 bookmarks).

---

## 4. Question card anatomy

After "Check Answer", the question card expands to show, in this order:

1. **Result banner** — Correct / Wrong / Skipped (color-coded)
2. **Correct answer** — highlighted among options
3. **Explanation** — from the question's `explanation` field (existing)
4. **Formula Used** — AI-generated, cached in `practice_ai_cache`
5. **Common Mistake** — AI-generated, cached
6. **Concept Card** — AI-generated mini-notes: formula + shortcut + memory trick + common trap
7. **AI: "Why you got this wrong"** — only when user's answer is wrong; AI compares selected option vs correct, explains the conceptual confusion (e.g. "You confused Simple Interest with Compound Interest")
8. **Actions row**: Bookmark ★ · Report 🚩 · Discuss 💬 · Try Similar 🔁 · Generate Similar ✨

**Source of extras (per user decision):**
- Base question + `explanation` come from the shared `questions` table
- Hint / Formula / Common Mistake / Concept Card / "Why wrong" / "Similar question" are **AI-generated on the fly** using the existing `aiMentor.service.js` `callAI()` helper (OpenRouter gpt-4), then **cached** in a new `practice_ai_cache` table keyed by `(question_id, ai_feature)` so we only pay for the first generation

---

## 5. Practice dashboard (entry screen)

When user lands on `/practice` (after login), they see a **personalized dashboard**, not just a question viewer:

```
┌──────────────────────────────────────────────────────────┐
│  Practice Lab                          🔥 12-day streak  │
│                                          ⭐ 247 mastery  │
├──────────────────────────────────────────────────────────┤
│  Today's Goal                                            │
│  20 / 50 questions    ████████░░░░  40%                  │
├──────────────────────────────────────────────────────────┤
│  Continue where you left off                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ SSC CGL › Quant › Percentage › Successive %        │  │
│  │ Learn mode · 8/20 done · 75% accuracy              │  │
│  │ [Resume]                                            │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  Quick start                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ 📚 Learn │ │ 🧠 Adapt │ │ ❌Wrong   │ │ ⭐ Saved │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ 📜 PYQ   │ │ ⚡ Speed │ │ 🔥 Daily │ │ 🎯 Weak  │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
├──────────────────────────────────────────────────────────┤
│  Your mastery                                            │
│  Quant    ████████████░░░░  68%  (18 topics mastered)   │
│  Reason.  ████████████████  92%  (22 topics mastered)    │
│  English  ████████░░░░░░░░  48%  ( 8 topics mastered)    │
│  GK       ████░░░░░░░░░░░░  31%  ( 4 topics mastered)    │
├──────────────────────────────────────────────────────────┤
│  Weak topics — practice these next                       │
│  • Ratio & Proportion      42% accuracy  [Practice 20]   │
│  • Time-Speed-Distance     48% accuracy  [Practice 20]   │
│  • Spotting Errors         51% accuracy  [Practice 20]   │
├──────────────────────────────────────────────────────────┤
│  From your last mock test (SSC CGL Mock #3)              │
│  • You scored 142/200                                     │
│  • 6 weak topics identified                              │
│  • [Start AI Practice Plan — 40 questions]               │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Auth & tracking

**Login is required** for `/practice`. This is a change from the current public route.

Reasons tracking needs a user:
- Mastery % per topic (must persist across sessions)
- Wrong-question notebook (must remember which questions the user got wrong)
- Bookmarks (must persist)
- Daily streak (must be tied to a user)
- Adaptive difficulty (needs last-3 correctness history)
- Weak-topic practice (needs `user_topic_performance`)
- "Continue where you left off" (needs saved session)
- Daily practice set (one per user per day)

**Implementation:** Wrap `/practice` route in `<ProtectedRoute>` (already exists at `apps/frontend/src/shared/components/auth/ProtectedRoute.jsx`). Remove `<FeatureGate pageKey="practiceQuestions">`.

---

## 7. Data model

### 7.1 Existing tables we reuse (no changes)

| Table | Purpose | Key columns |
|---|---|---|
| `exam_categories` | Top-level exam groups (SSC, Railway, Banking) | `category_id`, `name`, `slug` |
| `exams` | Specific exams (SSC CGL, SSC CHSL) — acts as subcategory | `exam_id`, `title`, `category_id` |
| `subjects` | Subjects (Quant, Reasoning, English, GK) | `id`, `title`, `slug`, `stage_ids` |
| `subject_parts` | Sub-parts of a subject (e.g. Quant → Arithmetic, Advanced) | `id`, `subject_id`, `name` |
| `units` | Units inside parts | `id`, `part_id`, `subject_id`, `name` |
| `chapters` | Chapters (Percentage, Ratio, Time-Speed-Distance) | `id`, `unit_id`, `study_material_id`, `title` |
| `topics` | Topics (Successive Percentage, Profit %) | `id`, `chapter_id`, `name` |
| `subtopics` | Finest grain | `id`, `topic_id`, `name` |
| `questions` | Shared pool — test + practice questions | `id`, `question_text`, `options`, `correct_option`, `explanation`, `subject`, `topic`, `difficulty`, `is_practice`, `is_active`, `topic_id`, `series_id`, `language`, `is_pyq`, `exam_id` |
| `users` | Users | `id`, `enrolled_series`, `attempted_tests` |
| `user_topic_performance` | Per-user per-topic accuracy/time (already exists, populated by Test Engine) | `user_id`, `topic_id`, `accuracy`, `total_attempts` |

### 7.2 Hierarchy resolution

The Practice Lab drill-down uses the existing curriculum tree:

```
exam_categories (SSC)
    └── exams (SSC CGL)
        └── subjects (Quant)
            └── subject_parts (Arithmetic)        ← optional, skip if empty
                └── units (Basic Arithmetic)      ← optional, skip if empty
                    └── chapters (Percentage)
                        └── topics (Successive Percentage)
                            └── subtopics (optional)
```

The `/api/practice/tree` endpoint (new) returns this tree pruned to only branches that have `is_practice=true` questions, so the user never drills into an empty leaf.

### 7.3 New tables

#### `practice_sessions`
Tracks one practice session (a user sitting down to practice N questions in mode M on topic T).

```sql
CREATE TABLE practice_sessions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id         VARCHAR(255),
  subject_id      INTEGER REFERENCES subjects(id),
  chapter_id      INTEGER REFERENCES chapters(id),
  topic_id        INTEGER REFERENCES topics(id),
  mode            VARCHAR(32) NOT NULL,          -- learn|adaptive|mistakes|weak|bookmark|pyq|speed|daily
  difficulty      VARCHAR(16),                    -- easy|medium|hard|mixed
  target_count    INTEGER,                        -- 10|20|50|null (unlimited)
  time_limit_sec  INTEGER,                        -- null = untimed
  questions_json  JSONB NOT NULL,                 -- ordered array of question IDs in this session
  current_index   INTEGER DEFAULT 0,
  correct_count   INTEGER DEFAULT 0,
  wrong_count     INTEGER DEFAULT 0,
  skipped_count   INTEGER DEFAULT 0,
  started_at      TIMESTAMP DEFAULT NOW(),
  last_active_at  TIMESTAMP,
  completed_at    TIMESTAMP,
  is_active       BOOLEAN DEFAULT true
);
CREATE INDEX idx_practice_sessions_user ON practice_sessions(user_id, is_active);
```

#### `practice_answers`
Per-question answer log — this is the "wrong-question notebook" source.

```sql
CREATE TABLE practice_answers (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      INTEGER REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id     INTEGER NOT NULL,
  selected_option INTEGER,
  is_correct      BOOLEAN,
  is_skipped      BOOLEAN DEFAULT false,
  time_taken_sec  INTEGER,
  mode            VARCHAR(32),
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, question_id, session_id)
);
CREATE INDEX idx_practice_answers_user_q ON practice_answers(user_id, question_id);
CREATE INDEX idx_practice_answers_wrong  ON practice_answers(user_id, is_correct) WHERE is_correct = false;
```

#### `question_bookmarks`

```sql
CREATE TABLE question_bookmarks (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id  INTEGER NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);
```

#### `practice_streaks`
One row per user, updated on every session completion.

```sql
CREATE TABLE practice_streaks (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_practice_date DATE,
  total_sessions    INTEGER DEFAULT 0,
  total_questions   INTEGER DEFAULT 0,
  total_correct     INTEGER DEFAULT 0
);
```

#### `practice_ai_cache`
Caches AI-generated extras per question so we only pay for the first generation.

```sql
CREATE TABLE practice_ai_cache (
  question_id    INTEGER NOT NULL,
  feature        VARCHAR(32) NOT NULL,            -- hint|formula|common_mistake|concept_card|why_wrong|similar_question
  content        JSONB NOT NULL,
  model          VARCHAR(64),
  generated_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (question_id, feature)
);
```

#### `practice_daily_sets`
One curated set per user per day.

```sql
CREATE TABLE practice_daily_sets (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  set_date     DATE NOT NULL,
  questions    JSONB NOT NULL,                    -- array of question IDs
  is_completed BOOLEAN DEFAULT false,
  score        INTEGER,
  created_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, set_date)
);
```

---

## 8. API endpoints (new, dedicated Practice API)

All endpoints require auth. All mounted under `/api/practice`.

### 8.1 Tree & metadata

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/practice/tree` | Full exam→subject→chapter→topic tree, pruned to branches with practice questions. Returns question counts per leaf. |
| `GET` | `/api/practice/tree/:examId` | Tree rooted at a specific exam |
| `GET` | `/api/practice/topics/:topicId/stats` | Question count, difficulty distribution, user mastery % for one topic |

### 8.2 Sessions

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/practice/sessions` | Start a new session. Body: `{ examId, subjectId, chapterId?, topicId?, mode, difficulty, targetCount, timeLimitSec? }`. Returns `{ sessionId, questions[] }` (question IDs only; full question fetched on demand). |
| `GET` | `/api/practice/sessions/active` | Get the user's active (uncompleted) session for "Continue where you left off" |
| `GET` | `/api/practice/sessions/:id` | Full session state (questions, current index, score) |
| `PATCH` | `/api/practice/sessions/:id` | Update `current_index` (autosave) |
| `POST` | `/api/practice/sessions/:id/complete` | Mark session complete; trigger mastery recalc + streak update |

### 8.3 Questions within a session

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/practice/sessions/:id/questions/:idx` | Fetch full question at index `idx` (without correct answer) |
| `POST` | `/api/practice/sessions/:id/questions/:idx/check` | Submit answer `{ selectedOption }`. Returns `{ isCorrect, correctOption, explanation }`. Logs to `practice_answers`. |
| `POST` | `/api/practice/sessions/:id/questions/:idx/skip` | Mark as skipped, move on |

### 8.4 AI extras

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/practice/questions/:id/ai/hint` | Get-or-generate hint (from `practice_ai_cache` or AI) |
| `POST` | `/api/practice/questions/:id/ai/formula` | Get-or-generate formula |
| `POST` | `/api/practice/questions/:id/ai/common-mistake` | Get-or-generate common mistake |
| `POST` | `/api/practice/questions/:id/ai/concept-card` | Get-or-generate concept card |
| `POST` | `/api/practice/questions/:id/ai/why-wrong` | Body: `{ selectedOption }`. AI explains the conceptual confusion. |
| `POST` | `/api/practice/questions/:id/ai/similar` | Get-or-generate a similar question (returns a new question object, not a question ID) |
| `POST` | `/api/practice/questions/:id/ai/generate-similar` | Force-generate a fresh similar question (costs AI tokens) |

All AI endpoints check `practice_ai_cache` first; on hit, return cached content. On miss, call `aiMentor.service.js`'s `callAI()` (existing OpenRouter integration), cache the result, return it. `why-wrong` and `generate-similar` are not cached (depend on user answer / fresh generation).

### 8.5 Bookmarks

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/practice/bookmarks` | User's bookmarked questions (paginated) |
| `POST` | `/api/practice/bookmarks/:questionId` | Add bookmark |
| `DELETE` | `/api/practice/bookmarks/:questionId` | Remove bookmark |
| `GET` | `/api/practice/bookmarks/count` | Count (for sidebar badge) |

### 8.6 Mistakes notebook

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/practice/mistakes` | User's wrong questions (paginated; filterable by subject/topic) |
| `GET` | `/api/practice/mistakes/count` | Count (for sidebar badge) |

### 8.7 Dashboard

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/practice/dashboard` | Aggregated payload for the entry screen: today's goal, active session, mastery per subject, top weak topics, last-test weak areas, streak. One round-trip. |

### 8.8 Daily practice

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/practice/daily` | Today's set (auto-generates if not exists for this user+date) |
| `POST` | `/api/practice/daily/complete` | Mark today's set complete |

### 8.9 Report / discuss

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/practice/questions/:id/report` | Body: `{ reason, notes }`. Logs to a `question_reports` table (new, small). |
| `POST` | `/api/practice/questions/:id/discuss` | Body: `{ message }`. Creates a doubt thread. Reuses existing `aiMentor.answerDoubt` for instant AI reply, queues human reply. |

---

## 9. Component tree (frontend)

```
/practice                                   ← ProtectedRoute
├── PracticeLab.jsx                          (new — replaces PracticeQuestions.jsx)
│   ├── PracticeDashboard                    (entry screen — §5)
│   │   ├── StreakBadge
│   │   ├── DailyGoalCard
│   │   ├── ContinueSessionCard
│   │   ├── ModePickerGrid                  (8 mode cards)
│   │   ├── MasteryPerSubject
│   │   ├── WeakTopicsList
│   │   └── LastTestPracticePlan
│   │
│   ├── PracticeSetupWizard                 (exam → subject → chapter → topic → mode → difficulty → count → timer)
│   │   ├── ExamPicker
│   │   ├── SubjectPicker
│   │   ├── ChapterPicker
│   │   ├── TopicPicker
│   │   ├── ModePicker
│   │   ├── DifficultyPicker
│   │   ├── CountPicker
│   │   └── TimerToggle
│   │
│   └── PracticeSession                      (the actual practice loop)
│       ├── SessionHeader                    (topic / mode / progress / timer if any)
│       ├── QuestionCard
│       │   ├── QuestionMeta                 (category, difficulty, bookmark btn, report btn)
│       │   ├── QuestionText                 (prose-styled HTML)
│       │   ├── OptionsList                  (radiogroup, A/B/C/D, color-coded after check)
│       │   ├── HintButton                   (reveals AI hint)
│       │   ├── CheckButton / NextButton / PrevButton / SkipButton
│       │   └── ResultPanel                  (expands after Check)
│       │       ├── Explanation
│       │       ├── FormulaCard              (AI)
│       │       ├── CommonMistakeCard        (AI)
│       │       ├── ConceptCard              (AI)
│       │       ├── WhyWrongCard             (AI, only if wrong)
│       │       ├── SimilarQuestionCTA       (AI)
│       │       └── ActionRow                (Bookmark / Report / Discuss / Try Similar / Generate Similar)
│       │
│       └── SessionComplete
│           ├── ScoreRing
│           ├── StatGrid                     (correct / wrong / skipped / total / time)
│           ├── MasteryDelta                 ("Mastery +5% → 72%")
│           ├── WrongQuestionsList           (this session's wrong Qs)
│           ├── ReattemptWrongCTA            ("Practice these 4 wrong questions again")
│           ├── TakeTopicTestCTA             ("Ready for a 10-Q topic test?")
│           └── ExitButton
```

**Shared with Test Engine:** none. Practice and Test components live in separate directories and share only `sanitizeHtml`, `ProtectedRoute`, `Breadcrumb`, and the `useAuth` context. This enforces the conceptual separation.

---

## 10. Practice ↔ Test bridge

### 10.1 Test → Practice (already partially exists)

`recommendationService.js` and `weakAreaDetection.service.js` already identify weak topics from test attempts. We expose this on the Test Result page (`TestResult.jsx`) as a new card:

> **From this test, practice these next**
> • Ratio & Proportion — 42% accuracy — [Practice 20]
> • Time-Speed-Distance — 48% accuracy — [Practice 20]
> [Start AI Practice Plan — 40 questions]

Clicking any of these deep-links to `/practice?examId=…&subjectId=…&topicId=…&mode=weak`.

### 10.2 Practice → Test

When a topic's mastery crosses 80% in `user_topic_performance` (computed from practice answers), the Practice dashboard and session-complete screen show:

> **You've mastered Successive Percentage!**
> Ready to test yourself under exam conditions?
> [Take a 10-question Topic Test]

This deep-links to `/test-series/:seriesId` (or auto-creates a topic test).

---

## 11. Mastery computation

Mastery % for a topic is computed from `practice_answers` + test attempts on that topic:

```
mastery = clamp(
    (correct * 1.0 + wrong * 0.0 + skipped * 0.0) / total_attempts
    * difficulty_weighted_factor,
  0, 100)
```

Where `difficulty_weighted_factor` rewards correct answers on harder questions:
- Easy correct = 1.0×
- Medium correct = 1.2×
- Hard correct = 1.5×

Status thresholds:
- **Need Practice** — 0–40%
- **Improving** — 40–70%
- **Mastered** — 80–100% (with ≥ 20 attempts, so mastery can't be gamed with 1 correct answer)

Computed on session complete and cached in `user_topic_performance` (existing table, already populated by Test Engine — we add practice contributions to the same row).

---

## 12. AI prompts (sketch)

All AI calls go through the existing `aiMentor.service.js` `callAI()` helper.

### Hint
```
System: You are an SSC exam tutor. Give a short hint (1-2 sentences) that nudges the student toward the right approach, without revealing the answer.
User: Question: <text>. Options: A) … B) … C) … D) …
Return JSON: { "hint": "…" }
```

### Formula
```
System: Identify the formula(s) needed to solve this question. Return them in a clean, copy-pasteable format.
User: Question: <text>
Return JSON: { "formulas": [ { "name": "Profit %", "expression": "(SP-CP)/CP * 100", "note": "…" } ] }
```

### Common Mistake
```
System: What's the most common mistake students make on this question?
User: Question: <text>. Correct answer: <text>
Return JSON: { "mistake": "…", "why": "…", "how_to_avoid": "…" }
```

### Concept Card
```
System: Create a mini revision card for the concept tested in this question. Include formula, shortcut, memory trick, and common trap.
User: Question: <text>. Correct answer: <text>. Explanation: <text>
Return JSON: { "formula": "…", "shortcut": "…", "memory_trick": "…", "common_trap": "…" }
```

### Why Wrong
```
System: The student selected <selectedOption> but the correct answer is <correctOption>. Explain the conceptual confusion in 2-3 sentences, as a kind tutor would.
User: Question: <text>. Selected: <text>. Correct: <text>
Return JSON: { "reason": "…", "review_concept": "…" }
```

### Similar Question
```
System: Generate a similar question testing the same concept, with the same difficulty, 4 options, and a full explanation. Do NOT reuse the same numbers or wording.
User: Question: <text>. Correct: <text>. Difficulty: <diff>
Return JSON: { "question": "…", "options": ["…","…","…","…"], "correct_option": 0, "explanation": "…" }
```

---

## 13. Phased implementation plan

### Phase 1 — Foundation (2 weeks) 🎯 Goal: replace current page, ship the "Learn" mode fully

**Backend:**
- Create 6 new tables (`practice_sessions`, `practice_answers`, `question_bookmarks`, `practice_streaks`, `practice_ai_cache`, `practice_daily_sets`)
- `GET /api/practice/tree` (pruned curriculum tree with question counts)
- `POST /api/practice/sessions` + `GET /active` + `GET /:id` + `PATCH /:id` + `POST /:id/complete`
- `GET /sessions/:id/questions/:idx` + `POST /:id/questions/:idx/check` + `POST /:id/questions/:idx/skip`
- `GET /bookmarks` + `POST /:questionId` + `DELETE /:questionId`
- `GET /api/practice/dashboard` (aggregated)

**Frontend:**
- Wrap `/practice` in `<ProtectedRoute>` (remove `<FeatureGate>`)
- Build `PracticeDashboard` (entry screen with streak, goal, continue, mastery, weak topics, last-test plan)
- Build `PracticeSetupWizard` (drill-down + mode + difficulty + count + timer)
- Rewrite `PracticeSession` with: per-question state, Prev/Skip/Next, working Bookmark, Report, autosave, session-complete screen with "Reattempt wrong" CTA
- Install `@tailwindcss/typography`, wrap all `dangerouslySetInnerHTML` in `prose prose-sm max-w-none`
- Fix a11y: `role="radiogroup"`, `aria-pressed`, `aria-live`, keyboard shortcuts (1-4 select, Enter check, → next, ← prev, B bookmark)

**Delivered modes in Phase 1:** Learn + Mistakes + Bookmark

### Phase 2 — Intelligence (3 weeks) 🎯 Goal: ship Adaptive, Weak, PYQ, Speed, Daily + AI extras

**Backend:**
- `POST /questions/:id/ai/hint|formula|common_mistake|concept_card|why_wrong|similar` (with caching)
- `GET /api/practice/mistakes` + `/count`
- `GET /api/practice/daily` + `POST /daily/complete`
- Adaptive question-selection logic (server-side: pick next Q based on last-3 correctness in `practice_answers`)
- Weak-topic picker (from `user_topic_performance` where accuracy < 60%)
- Streak update logic in `POST /sessions/:id/complete`
- Mastery recompute on session complete

**Frontend:**
- Wire 5 remaining modes (Adaptive, Weak, PYQ, Speed, Daily)
- Build AI extras panel (Hint button, Formula card, Common Mistake card, Concept card, Why-Wrong card, Similar Question CTA, Generate Similar button)
- Build streak UI in dashboard + session header
- Daily practice set UI

### Phase 3 — Bridge (3 weeks) 🎯 Goal: connect Practice ↔ Test

**Frontend (TestResult.jsx):**
- New "From this test, practice these next" card with deep-links to `/practice?…&mode=weak`
- "Start AI Practice Plan" button that creates a session across all weak topics

**Frontend (Practice dashboard + session-complete):**
- "You've mastered X — take a topic test" CTA when mastery ≥ 80%
- "From your last mock" card on dashboard

**Backend:**
- `POST /api/practice/plan-from-test/:attemptId` — generates a multi-topic practice session from a test's wrong questions
- `POST /api/practice/recommend-topic-test/:topicId` — finds or generates a 10-Q topic test and returns a deep-link

### Phase 4 — Polish (ongoing)
- Bilingual EN/HI toggle (reuse `TestInterface.jsx` pattern)
- Confetti on mastery achievement
- "Chapter completion" badges
- Formula & shortcut card library (saved AI cards become a browsable notes library)
- Notification service integration (`notificationService.js` already has "Daily practice reminder")
- Mobile gestures (swipe left/right for next/prev)

---

## 14. Success metrics

| Metric | Target (90 days post Phase 2) |
|---|---|
| % of logged-in users who use Practice weekly | 40% |
| Avg practice sessions per active user per week | 3 |
| Avg questions per session | 15 |
| Daily-practice streak retention (D7) | 35% |
| % of test takers who click "Practice weak topics" from Test Result | 25% |
| AI extras usage (% of checked questions where user opens ≥1 AI card) | 60% |
| Topic mastery movement (avg accuracy lift after 3 sessions on a weak topic) | +15 pp |

---

## 15. Open questions

| # | Question | Default if unresolved |
|---|---|---|
| 1 | Should Daily Practice be available to free users or Pro-only? | Free (it's the best habit-formation hook) |
| 2 | Should AI extras (hint, formula, similar question) be Pro-only? | Free for first 5/day, Pro for unlimited — use existing `checkFeatureAccess` |
| 3 | Should "Generate Similar Question" be rate-limited? | Yes — 10/day free, unlimited Pro |
| 4 | Is the curriculum tree (subjects/subject_parts/units/chapters/topics) populated for all exams, or only some? | Build UI to gracefully handle empty branches (already in tree pruning) |
| 5 | Do we want a "Practice History" page (all past sessions)? | Yes, Phase 3 — low priority |
| 6 | Should bookmarks be shareable (e.g. a teacher shares a set)? | Out of scope for V2.1 |

---

## 16. Out of scope (explicitly)

- Timed mock-style practice (that's a Test, not Practice)
- Leaderboards for practice (practice is not competitive)
- Rank / percentile for practice
- Negative marking in practice (practice is for learning, not penalty)
- Section-wise practice (sections belong to Tests; Practice is topic-wise)
- Proctoring / anti-cheat (no need in practice)
- Practice questions that aren't from the shared `questions` pool (we share the pool with Tests per user decision)

---

## 17. References

- Current practice page: `apps/frontend/src/pages/tests/PracticeQuestions.jsx`
- Current practice API: `apps/backend/src/api/routes/practice.js` (51 lines, basic)
- Current public practice API: `apps/backend/src/api/routes/practice-questions-public.js`
- AI service: `apps/backend/src/modules/ai/aiMentor.service.js`
- Weak-area detection: `apps/backend/src/modules/analytics/weakAreaDetection.service.js`
- Recommendation service: `apps/backend/src/services/core/recommendationService.js`
- Existing curriculum tables: `subjects`, `subject_parts`, `units`, `chapters`, `topics`, `subtopics` (in `postgres-helpers.js` schema setup)
- Test Engine (for contrast): `apps/frontend/src/pages/tests/TestInterface.jsx`
- Audit that triggered this PRD: `docs/PRACTICE_PAGE_UI_AUDIT.md`

---

**Next step:** Build interactive HTML mockup of the redesigned Practice Lab → `docs/PRACTICE_LAB_MOCKUP.html`