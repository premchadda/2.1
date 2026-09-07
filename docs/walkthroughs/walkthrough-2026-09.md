> **Status (Sep 6, 2026): historical build log (Waves 2–19), not a setup guide — see `README.md`.**
> Test totals below are per-wave snapshots; the final as-of figure is 918 passing across 101 suites.
> Machine-specific links were converted to repo-relative paths; the live DB host is redacted.

# Execution Walkthrough — System Enhancements, Spaced Repetition, DRM, AI, SEO & Real-Time Audits

All tasks requested by the user across enhancement waves have been executed and verified with **zero git commits**, maintaining a **100% test pass rate across the monorepo (918 passing tests across 101 test suites)**.

---

## 🚀 Live Environment Verification: Wave 17 & 18 Services in Real PostgreSQL

The newly developed Wave 17 and Wave 18 services were directly verified against the active, live Supabase PostgreSQL instance (`<SUPABASE_HOST>:5432`) using real test attempts, live question records, and real database transactions via [`scripts/verify-real-services.mjs`](scripts/verify-real-services.mjs).

### Real-Environment Schema Discoveries & Alignments

During real database verification, 4 critical schema/column discrepancies between unit test mocks and the actual live database were identified and reconciled:

1. **Questions Table Column**: In live PostgreSQL, the column is named `question_text` and `question_text_hi` (not `text`). Updated [`intelligence.js`](apps/backend/src/api/routes/intelligence.js) so live endpoints query the actual column.
2. **Attempts Active Section Column**: In live PostgreSQL, the active section is tracked in column `current_section` (not `current_section_id`). Updated [`syncReplayService.js`](apps/backend/src/services/core/syncReplayService.js) and [`liveProctoringConsoleService.js`](apps/backend/src/services/core/liveProctoringConsoleService.js) to support both `current_section` and `current_section_id`.
3. **Attempts Proctoring Status**: The live `attempts` table stores proctoring state in native `flagged` (boolean) and `flag_reason` (text) columns without a `metadata` JSON column. Updated [`liveProctoringConsoleService.js`](apps/backend/src/services/core/liveProctoringConsoleService.js) to support `row.flagged` in the real DB while maintaining backward compatibility with `row.metadata` in mock test suites.
4. **Live Tests Columns**: Live tests schema does not include `max_participants`; queries now use explicit existing columns (`id`, `test_id`, `title`, `start_time`, `end_time`, `status`).

---

### Live Real Environment Test Results Summary

| Service                          | Live Environment Check                             | Real DB Target / Evidence                                                                                                                                                                                                                        | Status      |
| :------------------------------- | :------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| **AI Socratic Hint Engine**      | Live Question Fetch & 3-Tier Clue Generation       | Real question row `ID: 40043` (`Ratio & Proportions`) from PostgreSQL `questions` table. Generated Tier 1 (5%), Tier 2 (15%), Tier 3 (25%), Hindi hint, and classified friction as `SEVERE_STUCK`.                                               | ✅ **PASS** |
| **Offline Sync Replay**          | Live Attempt Insert, Mutation & Idempotency        | Inserted live row into `attempts` table (`ID: 137`). Executed offline sync replay (`answers`, `current_section`). Verified PostgreSQL row update and verified idempotency cache on repeat submission (`alreadyProcessed: true`). Cleaned up row. | ✅ **PASS** |
| **Exam Readiness Predictor**     | Gaussian CDF Cutoff Probability Engine             | Evaluated SSC CGL Tier-1 UR benchmark against live statistical distributions. Computed projected score (166/200), cutoff margin (+16), qualifying likelihood (79.3%), and 97.3th percentile.                                                     | ✅ **PASS** |
| **Live Proctoring Console**      | Live Candidate Monitor & Proctor Interventions     | Created live test session and candidate attempt in PostgreSQL. Dispatched `warning_banner` and `pause_exam` interventions. Verified actual status transition to `PAUSED` and `flagged = true` in PostgreSQL. Cleaned up rows.                    | ✅ **PASS** |
| **Cross-Device Session Handoff** | Token Generation, State Transfer & Companion Claim | Inserted live test attempt (`ID: 139`). Generated cryptographic handoff token and companion PIN `799710`. Claimed from companion iOS device, restored state (1850s, answers), evicted source device. Cleaned up row.                             | ✅ **PASS** |
| **Error Log Fingerprinting**     | SHA-256 Ingestion & Sliding Window Spike Alert     | Ingested error events, generated deterministic SHA-256 fingerprint (`769200a5...`), detected sliding window frequency spike (12 occurrences), triggered alert and verified in-memory cluster registry.                                           | ✅ **PASS** |

---

## Wave 19: Full-Stack Candidate Intelligence, Live Proctoring UI, Offline Auto-Drainer & Comprehensive Responsive UI Audit Completed

### 1. Frontend Socratic Hint Clue Drawer & Cognitive Friction Modal

- **Interactive 3-Tier Clue Assistant**:
  - Implemented [`SocraticHintModal.jsx`](apps/frontend/src/pages/tests/components/SocraticHintModal.jsx) delivering progressive pedagogical clues without spoiling solutions:
    - **Tier 1 (Concept Clue)**: Identifies governing theorem (-5% penalty badge).
    - **Tier 2 (Approach Clue)**: Step-by-step problem setup (-15% penalty badge).
    - **Tier 3 (Elimination Clue)**: Eliminates 1–2 distractor trap choices (-25% penalty badge).
  - Bilingual toggle (`English` $\leftrightarrow$ `हिन्दी`).
  - Integrated with LaTeX mathematical formula renderer (`<MathRenderer />`).
  - Cognitive friction alert banner triggers when candidate hesitation is elevated ($> 2.5\times$ benchmark time or multiple selection changes).
- **TestInterface & QuestionViewer Integration**:
  - Connected Socratic Clue trigger button with Sparkles icon into [`QuestionViewer.jsx`](apps/frontend/src/pages/tests/components/QuestionViewer.jsx).
  - Verified with [`SocraticHintModal.test.jsx`](apps/frontend/src/__tests__/SocraticHintModal.test.jsx) (**6/6 tests passed**).

### 2. Admin Real-Time Live Mock Proctoring Cockpit UI

- **Administrative Live Integrity Console**:
  - Implemented [`LiveProctoringConsole.jsx`](apps/admin-panel/src/features/admin/assessments-quizzes/LiveProctoringConsole.jsx) aggregating real-time candidate attempts taking scheduled live mocks.
  - Live metric summary cards: Total Candidates, Critical Risk, High Risk, Clean/Low Risk.
  - Real-time candidate card grid with telemetry violation counters (`tab_switch`, `devtools_open`, `face_absent`), remaining timer, and section progress.
  - Interactive filter pills (`ALL`, `CRITICAL`, `HIGH`, `MODERATE`, `LOW`) and candidate search.
- **One-Click Proctor Interventions**:
  - Direct action triggers: **Warning Banner**, **Pause Exam**, **Resume Exam**, and **Force Submit**.
  - Custom reason input dialog before executing intervention.
  - Auto-polling every 10s with pause/resume controls.
- **Route Integration**:
  - Registered `/admin/live-proctoring` and `/admin/live-proctoring/:liveTestId` in [`apps/admin-panel/src/App.jsx`](apps/admin-panel/src/App.jsx).
  - Verified with [`LiveProctoringConsole.test.jsx`](apps/admin-panel/src/features/admin/assessments-quizzes/__tests__/LiveProctoringConsole.test.jsx) (**3/3 tests passed**).

### 3. Offline Sync Replay Auto-Drainer & Reconciliation Toast

- **Client Offline Mutation Vault Integration**:
  - Enhanced [`IndexedDBAttemptVault.js`](apps/frontend/src/shared/lib/offline/IndexedDBAttemptVault.js) with `batchSyncAttemptReplay(attemptId, apiDispatcher)` and `setupAutoReplayListener()`.
  - Packages offline queued operations (`answers`, `sectionChanges`, `telemetryEvents`) and transmits them in a single batch to `POST /api/attempt/:id/sync-replay`.
- **Automatic Connection Restoration Hook**:
  - Implemented [`useOfflineSyncReplay.js`](apps/frontend/src/shared/hooks/useOfflineSyncReplay.js).
  - Automatically drains queued offline attempts upon receiving `online` window event and displays visual toast notification (_"⚡ Reconciled X offline answers with server"_).
  - Verified with [`useOfflineSyncReplay.test.js`](apps/frontend/src/__tests__/useOfflineSyncReplay.test.js) (**3/3 tests passed**).

### 4. Candidate Exam Readiness Predictor & Cutoff Gauge Widget

- **Visual Cutoff Gauge & Percentile Dial**:
  - Implemented [`ExamReadinessGauge.jsx`](apps/frontend/src/pages/dashboard/components/ExamReadinessGauge.jsx) displaying candidate projected score vs target exam cutoff (e.g. SSC CGL 150 marks cutoff $\leftrightarrow$ 166 projected).
  - Circular progress ring displaying calibrated qualifying probability ($0 - 100\%$) and predicted national percentile badge.
  - High-ROI Action Plan: highlights top 3 weak areas providing maximum score lift per study hour.
- **Dashboard Embed**:
  - Embedded into [`PerformanceInsights.jsx`](apps/frontend/src/pages/dashboard/PerformanceInsights.jsx).
  - Verified with [`ExamReadinessGauge.test.jsx`](apps/frontend/src/__tests__/ExamReadinessGauge.test.jsx) (**3/3 tests passed**).

### 5. Comprehensive Responsive UI & Layout Audit Across All Pages, Tabs, Sections & Texts

- **SectionTabs**:
  - Replaced rigid `max-w-[220px]` with fluid responsive breakpoints `max-w-[140px] xs:max-w-[180px] sm:max-w-[220px]` and added `title={section}` to guarantee full text accessibility without horizontal overflow.
- **TestBottomBar**:
  - Adapted button labels on ultra-narrow mobile viewports ($< 360\text{px}$) with `<span className="hidden xs:inline">` while preserving accessible `title` attributes.
- **SubmitSummaryModal**:
  - Added `title={sec.name}` to section breakdown table and mobile cards so full section names are readily readable on hover/long-press.
- **PerformanceInsights**:
  - Enhanced Overview timeframe card to `flex-col sm:flex-row` with horizontal scrolling button container `overflow-x-auto no-scrollbar` to prevent filter tabs from wrapping awkwardly on phones.
- **TestCard & TestSeriesCard**:
  - Added `title` tooltips to truncated card titles, series titles, and descriptions, and refined min-width bounds.

---

### Option 1: AI Socratic Hint Engine & Candidate Cognitive Friction Detector

- **3-Tier Progressive Socratic Guidance**:
  - Implemented [`socraticHintService.js`](apps/backend/src/services/core/socraticHintService.js) synthesizing incremental clues without spoiling the final answer:
    - **Tier 1 (Concept/Formula Clue)**: Identifies governing theorem, identity, or quantitative formula without revealing steps (5% score penalty).
    - **Tier 2 (Approach/First-Step Clue)**: Supplies problem setup, diagrammatic orientation, and initial algebraic decomposition (15% score penalty).
    - **Tier 3 (Distractor Elimination Clue)**: Exposes common misconception traps and eliminates 1–2 false distractor choices without revealing the correct option (25% score penalty).
  - Bilingual hint synthesis (`en` and `hi`).
- **Candidate Cognitive Friction Detector**:
  - `detectCognitiveFriction({ timeSpentSeconds, benchmarkTimeSeconds, selectionChanges, idleTimeSeconds })` calculates normalized `frictionScore` ($0.0 - 1.0$) and categorizes candidate hesitation into `NONE`, `MILD`, `HIGH_HESITATION`, or `SEVERE_STUCK`.
  - Recommends proactive intervention tiers to break deadlocks.
- **Endpoint Integration**:
  - Added `POST /api/intelligence/questions/:id/socratic-hint` in [`intelligence.js`](apps/backend/src/api/routes/intelligence.js).
  - Verified with [`socraticHint.test.js`](apps/backend/src/__tests__/socraticHint.test.js) (**9/9 tests passed**).

### Option 2: Offline-First Background Sync Replay & Idempotent Mutation Engine

- **Idempotent Background Mutation Engine**:
  - Implemented [`syncReplayService.js`](apps/backend/src/services/core/syncReplayService.js) processing queued offline operations (`answers`, `sectionChanges`, `telemetryEvents`).
  - Strict idempotency enforcement via bounded FIFO cache; repeat submissions return cached payloads with `alreadyProcessed: true`.
- **Last-Write-Wins Conflict Arbitration**:
  - Compares client vs server timestamps with optimistic lock checks (`resolveAnswerConflict`), ensuring offline updates never overwrite newer server submissions.
- **Attempt Replay Endpoint**:
  - Added `POST /api/attempt/:attemptId/sync-replay` in [`attempt.routes.js`](apps/backend/src/modules/attempts/attempt.routes.js).
  - Verified with [`syncReplay.test.js`](apps/backend/src/__tests__/syncReplay.test.js) (**7/7 tests passed**).

### Option 3: Candidate Exam Readiness & Cutoff Percentile Predictor

- **Bayesian Readiness & Cutoff Simulator**:
  - Implemented [`examReadinessService.js`](apps/backend/src/services/core/examReadinessService.js) integrating candidate accuracy, speed efficiency, and negative marking ratios against historical exam cutoff benchmarks (`HISTORICAL_EXAM_CUTOFFS` for SSC CGL, SBI PO, IBPS PO, UPSC Prelims, RRB NTPC).
  - Evaluates candidate qualifying probability ($0.00 - 1.00$) and predicted national percentile via Gaussian Cumulative Distribution Function (`normalCDF`).
  - Classifies readiness into calibrated tiers: `HIGH_PROBABILITY`, `BORDERLINE`, `REQUIRES_EFFORT`, and `FOUNDATIONAL_BUILDING`.
- **High-ROI Actionable Topic Lift**:
  - Analyzes candidate weak topics ($< 65\%$ accuracy) and prioritizes topics delivering maximum marks lift per study hour.
- **Intelligence Endpoint**:
  - Added `GET /api/intelligence/exam-readiness` in [`intelligence.js`](apps/backend/src/api/routes/intelligence.js).
  - Verified with [`examReadiness.test.js`](apps/backend/src/__tests__/examReadiness.test.js) (**6/6 tests passed**).

### Option 4: Admin Live Mock Proctoring & Real-Time Intervention Console

- **Live Candidate Integrity Aggregator**:
  - Implemented [`liveProctoringConsoleService.js`](apps/backend/src/services/core/liveProctoringConsoleService.js) aggregating in-flight candidates taking a scheduled live mock exam.
  - Correlates telemetry risk scores, anomaly counts (`devtools_open`, `tab_switch`, `face_absent`), and categorizes cohort risk summary (`low`, `moderate`, `high`, `critical`).
- **Real-Time Proctor Intervention Controls**:
  - Supports administrative interventions: `warning_banner`, `pause_exam` (status `PAUSED`), `resume_exam` (status `IN_PROGRESS`), and `force_submit` (status `SUBMITTED`).
  - Logs intervention events into attempt metadata and dispatches real-time WebSocket alerts (`proctor:intervention`) to candidate test session rooms.
- **Admin Endpoints**:
  - Added `GET /api/admin/live-tests/:id/proctoring/candidates` and `POST /api/admin/live-tests/:id/proctoring/intervene` in [`admin-live-tests.js`](apps/backend/src/api/routes/admin-live-tests.js).
  - Verified with [`liveProctoringConsole.test.js`](apps/backend/src/__tests__/liveProctoringConsole.test.js) (**7/7 tests passed**).

---

## Wave 17: AI Question Generation & LaTeX Normalization, Cross-Device Session Handoff, Error Fingerprinting & Milestone Time Machine Completed

### Option 1: AI Question Generation & Bilingual LaTeX Schema Normalization

- **High-Yield Pedagogical Question Synthesis**:
  - Implemented [`questionGenerator.service.js`](apps/backend/src/modules/questions/questionGenerator.service.js) synthesizing high-yield test items tailored to Indian competitive exams (UPSC, SSC, Banking, JEE, NEET).
  - Supports Quantitative Aptitude, Logical Reasoning, General English, and General Studies with Bloom's cognitive taxonomy tagging (`Remember`, `Understand`, `Apply`, `Analyze`, `Evaluate`, `Create`).
- **LaTeX Math Detection & Bilingual Schema**:
  - Mathematical notation scanner detects inline and block equations (`$...$`, `$$...$$`, `\frac`, `\sqrt`, `\sum`, `\int`, `\begin{...}`) and automatically sets `hasLatex: true`.
  - Standardized bilingual schema supporting dual-language display (`questionTextHi`, `optionsHi`, `explanationHi`).
- **Endpoint Integration & Fallback Generator**:
  - Added `POST /api/question-builder/ai-generate` in [`questionBuilder.routes.js`](apps/backend/src/modules/questions/questionBuilder.routes.js).
  - Graceful algorithmic fallback guarantees high-quality question generation even when OpenRouter / AI API keys are unavailable.
  - Verified with [`questionGenerator.test.js`](apps/backend/src/__tests__/questionGenerator.test.js) (**6/6 tests passed**).

### Option 2: Cross-Device Test Session Handoff & Companion Sync

- **Cryptographic Handoff Packaging**:
  - Implemented [`sessionHandoffService.js`](apps/backend/src/services/core/sessionHandoffService.js) packaging in-flight test attempts (timer remaining, active section, candidate responses, visited/review flags, client device fingerprint).
  - Employs dual authorization: 64-character SHA-256 random claim token and 6-digit companion PIN for effortless cross-device pairing (desktop $\leftrightarrow$ mobile/tablet).
- **Session Lifecycle & Anti-Collision**:
  - 10-minute expiration window, one-time claim protection ("burn after claim" semantics), and explicit transfer cancellation.
- **Attempt Handoff Endpoints**:
  - `POST /api/attempt/:id/handoff/create`: initiates handoff and returns claim token, PIN, and QR payload.
  - `POST /api/attempt/handoff/claim`: claims active handoff on target companion device and returns full session snapshot.
  - `GET /api/attempt/handoff/status`: polls pending transfer status.
  - `DELETE /api/attempt/:id/handoff`: cancels pending handoff.
  - Verified with [`sessionHandoff.test.js`](apps/backend/src/__tests__/sessionHandoff.test.js) (**8/8 tests passed**).

### Option 3: Automated Error Log Fingerprinting & Sentry Alert Grouping

- **Error Normalization & Categorization Engine**:
  - Implemented [`errorFingerprintService.js`](apps/backend/src/services/core/errorFingerprintService.js) identifying operational failure modes: `NETWORK_TIMEOUT`, `AUTH_EXPIRED`, `DOM_RENDER_EXCEPTION`, `PROCTORING_VIOLATION`, `DATABASE_UNAVAILABLE`, `RATE_LIMIT_EXCEEDED`, `VALIDATION_ERROR`, and `APPLICATION_ERROR`.
  - Normalizes volatile runtime values (memory addresses `0x[a-f0-9]+`, timestamps, UUIDs, IPv4/IPv6 addresses, stack line/column coordinates) before generating canonical SHA-256 fingerprints.
- **Sliding-Window Spike Detector & Alert Grouping**:
  - Real-time sliding 5-minute counter triggers automated high-urgency alerts when an error fingerprint cluster exceeds $\ge 10$ occurrences.
  - Provides cluster resolution tracking (`POST /fingerprint/:fingerprint/resolve`) and cluster summaries.
- **Admin Endpoints**:
  - `POST /api/admin/logs/fingerprint/ingest`: ingests and fingerprints client/server errors.
  - `GET /api/admin/logs/fingerprint/clusters`: retrieves ranked error clusters with sample traces and occurrence counts.
  - `GET /api/admin/logs/fingerprint/summary`: returns system error health overview.
  - `POST /api/admin/logs/fingerprint/:fingerprint/resolve`: marks an error cluster as resolved.
  - Verified with [`errorFingerprint.test.js`](apps/backend/src/__tests__/errorFingerprint.test.js) (**6/6 tests passed**).

### Option 4: Candidate Personalized Study Roadmaps & Milestone Time Machine

- **Milestone Roadmaps & Exam Countdown**:
  - Implemented [`studyRoadmapService.js`](apps/backend/src/services/core/studyRoadmapService.js) constructing phase-based study roadmaps tailored to exam dates and syllabus coverage.
  - Computes target exam countdown, completion velocity, weekly chapter focus, and diagnostic checkpoints.
- **Milestone Time Machine Simulator**:
  - Simulates candidate score trajectories and syllabus readiness dates across 30, 45, 60, and 90 min/day daily study commitments using calibrated logarithmic learning models ($S(d) = S_0 + k \cdot \ln(1 + d \cdot \text{eff})$).
- **Intelligence API Endpoints**:
  - `GET /api/intelligence/study-roadmap`: returns candidate study milestones and exam countdown.
  - `POST /api/intelligence/time-machine`: calculates projected score and completion curves.
  - Verified with [`studyRoadmap.test.js`](apps/backend/src/__tests__/studyRoadmap.test.js) (**3/3 tests passed**).

---

## Wave 16: Proctoring Telemetry, Gamification & Badges, Solution Explainer TTS & Study Matchmaker Completed

### Option 1: Real-Time Proctoring Telemetry & Anti-Cheating Anomaly Detector

- **Anomaly Detection & Weighting Engine**:
  - Implemented [`proctoringService.js`](apps/backend/src/services/core/proctoringService.js) analyzing real-time proctoring events with calibrated integrity weights: `devtools_open` (0.80), `multiple_faces` (0.60), `webcam_frozen` (0.50), `face_absent` (0.40), `fullscreen_exit` (0.35), `paste_attempt` (0.30), `tab_switch` (0.25 + duration penalty), `audio_anomaly` (0.25), and `mouse_exit` (0.15).
- **Automated Integrity Scoring & Tiers**:
  - Computes normalized candidate risk score ($0.0 - 1.0$) categorized into actionable intervention tiers: `LOW` (PASS), `MODERATE` (PASS_WITH_WARNINGS), `HIGH` (FLAG_FOR_MANUAL_REVIEW), and `CRITICAL` (AUTO_INVALIDATE).
- **Proctoring Telemetry Endpoints**:
  - `POST /api/attempt/:attemptId/proctoring`: ingests batch proctoring events, updates session cache, and persists `attemptEvents`.
  - `GET /api/attempt/:attemptId/proctoring`: generates complete proctoring audit report with timestamped suspicious incident log.
  - Verified with [`proctoringService.test.js`](apps/backend/src/__tests__/proctoringService.test.js) (**11/11 tests passed**).

### Option 2: Gamification, Study Streaks & Milestone Badges Engine

- **Attempt XP Points & Level Progression**:
  - Implemented [`gamificationService.js`](apps/backend/src/services/core/gamificationService.js) calculating candidate XP based on marks (+2 XP per mark), accuracy bonuses (up to +100 XP for 100%), speed bonuses (+30 XP for $\le 45$s), daily first test bonus (+50 XP), and live mock competition bonus (+75 XP).
  - Evaluates candidate leveling via logarithmic formula $L = \lfloor 1 + \sqrt{\text{totalXp} / 100} \rfloor$ with progress percentage toward the next level target.
- **Monthly Streak Freeze Protection**:
  - Implemented streak freeze preservation (1 monthly freeze for Free tier, 2 monthly freezes for Pro pass tier) to safeguard candidate study streaks during emergency missed days.
- **Automated Milestone Badge Unlock Engine**:
  - Evaluates candidate milestones (`first-steps`, `dedicated-learner`, `test-champion`, `century-club`, `week-warrior`, `monthly-master`, `precision-master`, `perfect-score`, `speed-demon`, `night-owl`, `early-bird`, `quant-wizard`, `reasoning-expert`).
- **Gamification API Endpoints**:
  - `GET /api/achievements/xp-summary`: returns level, XP progress, and streak freeze token status.
  - `POST /api/achievements/streak-freeze`: activates a streak freeze to preserve a study streak.
  - Verified with [`gamificationService.test.js`](apps/backend/src/__tests__/gamificationService.test.js) (**12/12 tests passed**).

### Option 3: Automated Solution Explainer Generator & Bilingual Audio TTS

- **LaTeX Math to Natural Speech Converter**:
  - Implemented `convertLatexToSpokenText(text, language)` in [`solutionExplainerService.js`](apps/backend/src/services/core/solutionExplainerService.js) transforming mathematical notation (`\frac{a}{b}`, `\sqrt{x}`, powers, Greek symbols, comparison operators) into natural English and Hindi spoken phonetics.
- **4-Stage Pedagogical Explainer Synthesis**:
  - Synthesizes explanations into 4 flashcard stages: Core Concept & Theorem, Given Conditions & Variables, Step-by-Step Deduction, and Distractor Misconception Analysis.
  - Generates synchronized audio narration script with estimated speaking duration.
- **Backend Route & Frontend Audio Hook**:
  - `POST /api/intelligence/questions/:id/structured-explainer`: returns structured flashcard breakdown and spoken narration text.
  - Created [`useAudioExplainer.js`](apps/frontend/src/shared/hooks/useAudioExplainer.js) managing Web Speech API playback (`play`, `pause`, `resume`, `stop`, speed rate, Indian English / Hindi voice matching).
  - Verified with [`solutionExplainer.test.js`](apps/backend/src/__tests__/solutionExplainer.test.js) (**7/7 tests passed**) and [`useAudioExplainer.test.js`](apps/frontend/src/__tests__/useAudioExplainer.test.js) (**4/4 tests passed**).

### Option 4: Peer Study Group Matchmaker & 1v1 Live Quiz Arena

- **Algorithmic Study Matchmaker**:
  - Implemented [`studyMatchmakerService.js`](apps/backend/src/services/core/studyMatchmakerService.js) pairing candidate profiles based on target exam alignment (40%), mutually complementary skill profiles (35%), shared study time slot (15%), and ambition pace (10%).
- **1v1 Synchronized Live Quiz Arena**:
  - Rapid-fire 5-question peer duel engine with real-time scoring (10 base points + speed bonus up to 10 points for rapid answering).
  - Detects duel completion, evaluates match victor, resolves ties, and handles forfeits.
- **Study Group API Endpoints**:
  - `POST /api/study-groups/matchmaker/find-peers`: retrieves ranked compatible study partner suggestions.
  - `POST /api/study-groups/duels/create`: initiates a 1v1 rapid duel challenge.
  - `GET /api/study-groups/duels/:duelId`: returns live duel state and participant progress.
  - `POST /api/study-groups/duels/:duelId/answer`: submits an answer to the active duel.
  - Verified with [`studyMatchmaker.test.js`](apps/backend/src/__tests__/studyMatchmaker.test.js) (**6/6 tests passed**).

---

## Wave 15: AI Question Difficulty Calibration, Bloom's Taxonomy, IndexedDB Vault, Question Deduplication & Adaptive Diagnostic Generator Completed

### Option 1: AI Question Difficulty Calibration & Bloom's Taxonomy Tagging

- **Bloom's Taxonomy Cognitive Classification**:
  - Implemented `classifyBloomsTaxonomy(questionText, explanation)` in [`questionDifficulty.service.js`](apps/backend/src/modules/questions/questionDifficulty.service.js) classifying questions into `Remember`, `Understand`, `Apply`, `Analyze`, `Evaluate`, and `Create` with pedagogical confidence scoring.
- **Item Facility Index & Discrimination Index ($D$)**:
  - Implemented `calculateItemDiscrimination(upperGroupAccuracy, lowerGroupAccuracy)` evaluating upper vs. lower 27% cohort discrimination:
    - $D \ge 0.40$: `Excellent`
    - $0.30 \le D < 0.40$: `Good`
    - $0.20 \le D < 0.30$: `Fair`
    - $0.10 \le D < 0.20$: `Marginal`
    - $D < 0.10$: `Flawed`
  - Integrated facility index $P = \text{Correct} / \text{Total}$ with average response time offset into calibrated difficulty tiers (`EASY`, `MEDIUM`, `HARD`, `EXPERT`).
- **Intelligence API Endpoints**:
  - `GET /api/intelligence/questions/:id/calibration`: returns cognitive level, item discrimination, facility index, and difficulty score.
  - `POST /api/intelligence/questions/calibrate-batch`: batch calibration for multiple questions.
  - Verified with [`questionDifficultyCalibration.test.js`](apps/backend/src/__tests__/questionDifficultyCalibration.test.js) (**11/11 tests passed**).

### Option 2: Offline-First PWA Background Sync & IndexedDB Attempt Vault

- **Resilient Client-Side IndexedDB Storage**:
  - Implemented [`IndexedDBAttemptVault.js`](apps/frontend/src/shared/lib/offline/IndexedDBAttemptVault.js) with 3 dedicated object stores:
    - `attempts`: stores attempt session state, section timers, active section, and submission status.
    - `answers`: stores candidate responses, review flags, and visit status keyed by composite key `[attemptId, questionId]`.
    - `syncQueue`: mutation queue logging offline changes for background replay.
- **Conflict Resolution & Network Failover**:
  - Implemented Last-Write-Wins (`resolveConflict`) comparing client vs. server timestamps with optimistic lock checks.
  - Integrated zero-config `memoryFallback` for headless/virtual DOM environments.
  - Verified with [`IndexedDBAttemptVault.test.js`](apps/frontend/src/__tests__/IndexedDBAttemptVault.test.js) (**7/7 tests passed**).

### Option 3: Admin Bulk Question Import Dry-Run & Duplicate Deduplication Linter

- **Stem Normalization & Dice Bigram Similarity**:
  - Implemented `normalizeStem` and `calculateDiceSimilarity` in [`questionImportLinter.js`](apps/backend/src/services/import/questionImportLinter.js) detecting near-duplicate questions at $\ge 0.85$ character bigram similarity threshold.
- **Pre-Commit Import Quality Linter**:
  - Validates question text completeness, option counts ($\ge 2$), and correct answer indices.
  - Flags duplicate questions within the import batch as well as against existing database questions.
  - Issues pedagogical quality warnings for missing explanations, short explanations (< 15 chars), and severely unbalanced option lengths.
- **Admin Dry-Run Endpoint**:
  - `POST /api/admin/import/questions/dry-run-lint`: audits import payloads without executing database mutations.
  - Verified with [`questionImportLinter.test.js`](apps/backend/src/__tests__/questionImportLinter.test.js) (**11/11 tests passed**).

### Option 4: Adaptive Diagnostic Mock Test Generator

- **Topic Mastery Radar-Based Allocation**:
  - Implemented [`adaptiveDiagnosticService.js`](apps/backend/src/services/core/adaptiveDiagnosticService.js) dynamically constructing 25-question diagnostic mock assessments tailored to the student's mastery profile:
    - 60% quota (15 questions) from `criticalWeak` topics ($< 50\%$ accuracy).
    - 30% quota (7-8 questions) from `developing` topics ($50\% - 79\%$ accuracy).
    - 10% quota (2-3 questions) from `mastered` topics ($\ge 80\%$ accuracy).
- **Cold-Start Fallback & Practice Route**:
  - Smooth baseline fallback generating a balanced subject diagnostic when candidate radar data is not yet available.
  - Added authenticated endpoint `POST /api/practice/adaptive-diagnostic` in [`practice.js`](apps/backend/src/api/routes/practice.js).
  - Verified with [`adaptiveDiagnostic.test.js`](apps/backend/src/__tests__/adaptiveDiagnostic.test.js) (**3/3 tests passed**).

---

## Wave 14: Push Notification Dispatcher, Performance Insights Radar, Admin Test Lifecycle & Subscription Expiry Downgrade Completed

### Option 1: Push & In-App Notification Dispatcher Pipeline

- **Device Token Registration & Push Subscriptions**:
  - Implemented `registerPushToken(userId, { token, platform, deviceId, userAgent })` in [`notificationService.js`](apps/backend/src/services/core/notificationService.js) with upsert into `push_subscriptions` and graceful fallback to user metadata when the dedicated table is unavailable.
  - Added public authenticated endpoint `POST /api/notifications/push-token` in [`notifications.js`](apps/backend/src/api/routes/notifications.js).
- **Quiet Hours Throttling Engine**:
  - Implemented `isWithinQuietHours(currentTime, quietHoursConfig)` handling both overnight windows (e.g. 22:00 to 07:00) and daytime windows (e.g. 13:00 to 15:00).
  - Throttles external push dispatches during quiet hours while always preserving in-app notifications.
- **Specialized Job Handlers**:
  - Added dedicated worker handlers for `notifications.streak-milestone` (awards study recognition badge), `notifications.discussion-reply` (links directly to discussion thread), and `notifications.mock-test-reminder` (sends countdown alert before live test window closes).
  - Verified with [`pushNotificationDispatcher.test.js`](apps/backend/src/__tests__/pushNotificationDispatcher.test.js) (**10/10 tests passed**).

### Option 2: Student Performance Insights & Weak-Area Diagnostic Radar

- **Timeframe / Period Filtering**:
  - Enhanced `getUserPerformanceAnalytics` in [`analyticsService.js`](apps/backend/src/services/core/analyticsService.js) to support `week` (7-day interval), `month` (30-day interval, default), `quarter` (90-day interval), and `all` (all-time) timeframes.
  - Updated `/api/intelligence/performance` route in [`intelligence.js`](apps/backend/src/api/routes/intelligence.js) to forward the `period` query parameter.
- **Speed vs Accuracy Efficiency Matrix**:
  - Evaluates student performance into actionable pace categories:
    - `Optimal & Fast`: Accuracy $\ge 75\%$ and Speed $\le 50$s/question.
    - `Accurate but Cautious`: Accuracy $\ge 75\%$ and Speed $> 50$s/question.
    - `Fast but Error-Prone`: Accuracy $< 75\%$ and Speed $\le 50$s/question.
    - `Needs Foundational Review`: Accuracy $< 75\%$ and Speed $> 50$s/question.
  - Calculates `efficiencyScore` as $(\text{accuracy} / \text{speedPerQuestion}) \times 10$.
- **Topic Mastery Radar Segmentation**:
  - Segregates topics into `mastered` ($\ge 80\%$ accuracy), `developing` ($50\% - 79\%$ accuracy), and `criticalWeak` ($< 50\%$ accuracy).
  - Verified with [`performanceInsights.test.js`](apps/backend/src/__tests__/performanceInsights.test.js) (**10/10 tests passed**).

### Option 3: Admin Test Lifecycle & Versioned Publishing Engine

- **State Machine Transitions**:
  - Implemented `LIFECYCLE_STATES` (`draft`, `in_review`, `scheduled`, `published`, `archived`) and enforced `ALLOWED_TRANSITIONS`:
    - `draft` $\rightarrow$ `in_review`, `archived`
    - `in_review` $\rightarrow$ `draft`, `scheduled`, `published`, `archived`
    - `scheduled` $\rightarrow$ `in_review`, `published`, `archived`
    - `published` $\rightarrow$ `archived`, `draft` (unpublish)
    - `archived` $\rightarrow$ `draft`
  - Rejects illegal transitions (e.g. `draft` directly to `published`) with `400 Bad Request`.
- **Pre-Publication Prerequisite Validation**:
  - Enforces `totalQuestions > 0`, `totalMarks > 0`, and `duration > 0` before a test can transition to `published` or `scheduled`.
  - For `scheduled` status, verifies a valid future `scheduledAt` date.
- **Deterministic Question Bank Seed Shuffling**:
  - Implemented `mulberry32` PRNG algorithm and Fisher-Yates shuffle `shuffleQuestionsWithSeed(questions, seed)` for 100% reproducible question ordering.
- **New Admin API Endpoints**:
  - `PUT /api/admin/tests/:id/lifecycle`: Transitions state, increments `version` on publish, records `shuffleSeed`, updates timestamps, and logs audit event via `logAuditEvent`.
  - `POST /api/admin/tests/:id/shuffle-preview`: Previews deterministic question ordering.
  - Added migration [`135_test_lifecycle_and_shuffle_seed.sql`](apps/backend/src/infrastructure/database/migrations/135_test_lifecycle_and_shuffle_seed.sql).
  - Verified with [`adminTestLifecycle.test.js`](apps/backend/src/__tests__/adminTestLifecycle.test.js) (**18/18 tests passed**).

### Option 4: Subscription & Plan Expiration Auto-Downgrade Engine

- **Grace Period Recognition**:
  - Enhanced `getUserSubscription` and `hasActiveProPass` in [`SubscriptionService.js`](apps/backend/src/services/SubscriptionService.js) to recognize subscriptions in `grace_period` (`inGracePeriod: true`), ensuring candidate test access is retained while displaying renewal prompts.
- **Automated Grace Transition & Auto-Downgrade**:
  - Enhanced `processExpiredSubscriptions({ gracePeriodHours = 48, notify = true })`:
    - Subscriptions expiring within `gracePeriodHours` transition to status `'grace_period'`.
    - Subscriptions expired past grace period transition to status `'expired'`.
    - Users without remaining active subscriptions have their `is_pro_user` reset to `false` (auto-downgraded to Free tier).
- **Candidate Expiration Notifications**:
  - Dispatches `subscription_grace_period` alert warning candidate of imminent downgrade.
  - Dispatches `subscription_expired` notice informing candidate of switch to Free plan with option to upgrade.
  - Verified with [`subscriptionExpiryDowngrade.test.js`](apps/backend/src/__tests__/subscriptionExpiryDowngrade.test.js) (**7/7 tests passed**) and regression verified with [`subscriptionService.test.js`](apps/backend/src/__tests__/subscriptionService.test.js) (**22/22 tests passed**).

---

## Wave 13: Coupon Engine, Student Discussions, Leaderboard Re-calculation & PDF Solution Export Completed

### Option 1: Coupon, Discount & Promotional Code Engine Audit

- **Full Coupon Validation & Discount Deduction Pipeline**:
  - Created [`couponEngine.test.js`](apps/backend/src/__tests__/couponEngine.test.js) (9/9 passed):
    - Tests 400 Bad Request when missing mandatory parameters (`code`, `amount`).
    - Tests 400 rejection for non-existent, malformed, or explicitly inactive coupons (`isActive: false`).
    - Enforces start date boundary (`validFrom` in future rejected).
    - Enforces expiration date boundary (`validUntil` in past rejected).
    - Enforces minimum order purchase requirement (`minPurchaseAmount`).
    - Enforces allowed plan whitelist (`applicablePlans`).
    - Enforces per-candidate single-use limit via `usedByUsers` tracking array.
    - Tests percentage discount calculation with `maxDiscount` cap (e.g. 50% on ₹1500 capped at ₹500 discount).
    - Tests flat fixed amount discounts with safety floor preventing negative total order amounts.

### Option 2: Student Discussion Forum & Moderation Pipeline

- **Threaded Question Discussions & Vote Anti-Tampering**:
  - Created [`discussions.test.js`](apps/backend/src/__tests__/discussions.test.js) (10/10 passed):
    - `GET /question/:questionId`: Implemented pagination (`limit`, `page`), sorting (`popular`, `newest`, `oldest`), and nested reply tree aggregation via `$in: discussionIds`.
    - `POST /question/:questionId`: Sanitized content validation, initial 0 upvotes, and author association.
    - `POST /:discussionId/replies`: Multi-level nested replies linking to parent thread.
    - `POST /:discussionId/upvote`: Anti-tampering vote deduplication via `discussionVotes` tracking table to reject repeat upvotes with 400.
    - `PUT /:discussionId`: Ownership enforcement ensuring only original authors can edit their comment.
    - `DELETE /:discussionId`: Administrative moderation and soft-delete archiving.

### Option 3: Real-Time Live Mock Leaderboard Rank Re-calculation

- **Score Tie-Breaking, High-Precision Percentiles & Multi-Attempt Deduplication**:
  - Expanded [`leaderboardService.test.js`](apps/backend/src/__tests__/leaderboardService.test.js) (12/12 passed):
    - Implemented speed tie-breaker: candidate who finishes with lower `timeSpent` achieves a superior rank when test scores are identical (e.g., Candidates at 150 marks: 180s vs 300s -> Rank 1 vs Rank 2).
    - Hardened percentile calculation formula $\frac{\text{Total} - \text{Rank}}{\text{Total} - 1} \times 100$ with safe zero-division handling for single-participant edge cases.
    - Multi-attempt candidate deduplication: ensures candidate's peak score (e.g. 85 over earlier 60) is preserved while eliminating phantom duplicate entries on the live leaderboard.

### Option 4: PDF Question Paper & Answer Key Export Engine

- **Printable Document View & DOM Sanitization Hardening**:
  - Hardened [`htmlSanitizer.js`](apps/frontend/src/shared/lib/htmlSanitizer.js):
    - Wrapped bare text strings starting without opening HTML tags with synthetic containers during DOMPurify sanitization to eliminate silent text-node dropping in headless/virtual DOM environments.
  - Hardened [`TestReview.jsx`](apps/frontend/src/pages/tests/TestReview.jsx):
    - Formatted printable solution layout containing exam title, candidate score, rank, percentile, accuracy, and full question palette.
    - Rendered clear candidate choice markers: `✓ (Correct Answer)` in emerald and `✗ (Your Selection)` in rose for incorrect responses.
    - Rendered mathematical formulas and LaTeX explanations safely with `MathRenderer`.
    - Bound `window.print()` trigger to the "Print / Save PDF" header button.
  - Created [`TestPaperPdfExport.test.jsx`](apps/frontend/src/__tests__/TestPaperPdfExport.test.jsx) (4/4 passed).

---

## Wave 12: Admin RBAC, Interactive Socratic Tutor, Real-Time Timer Sync & Multi-Exam Simulation Completed

### Option 1: Practice Lab & Interactive Socratic Tutor Edge Cases

- **Progressive 3-Step Pedagogical Guidance**:
  - Enhanced [`PracticeSessionCanvas.jsx`](apps/frontend/src/pages/tests/components/PracticeSessionCanvas.jsx) to support interactive progressive hint disclosure:
    - **Step 1**: Core theorem, definition, and formula formulation without revealing the final answer.
    - **Step 2**: Intermediate deduction and gentle analysis of candidate misconception when `studentAttempt` is provided.
    - **Step 3**: Complete structured walkthrough with closing verification check.
  - Implemented bilingual language switch (`en` vs `hi`) in the tutor drawer to deliver native Hindi/English hints.
- **Backend AI Mentor Service Hardening**:
  - Created [`aiMentor.service.test.js`](apps/backend/src/__tests__/aiMentor.service.test.js) (8/8 passed):
    - Tests `getSocraticHint` step clamping ($1 \le \text{step} \le 3$), LaTeX formatting instructions, and token audit logging in `AiGenerationLog`.
    - Tests `generateStudyPlan` with weak area aggregation.
    - Tests `answerDoubt` with sanitized input and full-text context.
    - Tests `chat` with transactional persistence and multi-turn history.
- **Frontend Interactive Component Testing**:
  - Created [`PracticeSessionCanvas.test.jsx`](apps/frontend/src/__tests__/PracticeSessionCanvas.test.jsx) (4/4 passed):
    - Verified opening the Socratic tutor drawer on click.
    - Verified candidate attempt passing (`Option A: 10`) when unlocking Step 2 deduction.
    - Verified bilingual language toggle to Hindi.

### Option 2: Admin Panel Permissions & RBAC Enforcement Audit

- **Path Traversal & Resource Domain Mapping Hardening**:
  - Fixed path traversal vulnerability in [`admin-permission.middleware.js`](apps/backend/src/middleware/admin-permission.middleware.js):
    - Now checks `path.includes("..")` across the full request path prior to permission/role bypass checks (returns `400 Bad Request: Invalid path`).
    - Added canonical domain mappings for `"monetization"` and `"communications"`.
- **RBAC Test Suite**:
  - Created [`admin-permission.middleware.test.js`](apps/backend/src/__tests__/admin-permission.middleware.test.js) (12/12 passed):
    - Verified `loadAdminPermissions` caching with TTL and invalidation via `invalidateAdminPermissionsCache`.
    - Verified fallback to `DEFAULT_ADMIN_TIER_PERMISSIONS` for admins lacking explicit `user_roles`.
    - Verified fail-closed error handling (403 with `code: 'RBAC_VERIFICATION_ERROR'`).
    - Verified `super_admin` and wildcard (`*`, `tests:*`) bypass.
    - Verified method-to-action aliases (`GET` $\rightarrow$ `view`/`read`, `POST` $\rightarrow$ `create`/`write`, `PUT` $\rightarrow$ `edit`/`update`/`write`, `DELETE` $\rightarrow$ `delete`).

### Option 3: Real-Time Test Timer Sync & Reconnection Recovery

- **Backend Heartbeat & Drift Recovery**:
  - Created [`testTimerSync.test.js`](apps/backend/src/__tests__/testTimerSync.test.js) (4/4 passed):
    - Verified `POST /:attemptId/heartbeat` checks attempt existence and enforces candidate ownership.
    - Verified activity write throttling via `shouldWriteActivity(internalAttemptId)`.
    - Verified Socket.IO emission to `admin:live-tests` room event `live_test:presence`.
    - Verified status propagation for `active`, `submitted`, `expired`, and `revoked`.
- **Frontend Telemetry & Dynamic Skew Sync**:
  - Created [`TelemetryService.test.js`](apps/frontend/src/__tests__/TelemetryService.test.js) (4/4 passed):
    - Verified `syncServerTime()` calculates half-RTT adjusted clock skew `this.serverOffset = Math.round(serverTime - (start + latency / 2))`.
    - Verified `sendHeartbeat()` reports attempt timer and active question.
    - Verified automatic termination and `onViolation("attempt_revoked")` when attempt is expired/revoked.
    - Verified offline queue buffering in `localStorage` and replay upon reconnection (`handleOnline`).

### Option 4: End-to-End Multi-Exam Engine Simulation

- **Comprehensive Multi-Pattern Simulation**:
  - Created [`multiExamEngineSimulation.e2e.test.js`](apps/backend/src/__tests__/multiExamEngineSimulation.e2e.test.js) (8/8 passed):
    - **Banking Prelims Speed Exam (SBI/IBPS PO)**: 100 questions, 3 strict 20-minute sections (English, Quant, Reasoning), sectional time-locks, negative marking (-0.25), and sectional cutoffs evaluation.
    - **Chapter-Wise Topic Mastery Drill**: 20 questions, targeted topic practice, configured zero negative marking (`negativeMarks: 0`), accuracy and speed metrics ($90\%$ accuracy, $32$s/q $\rightarrow$ "Master" tier).
    - **Advanced GATE/JEE Exam**: Single-choice MCQ (+1 / -0.33), Multiple-select MSQ (+2 / 0 with all-or-nothing and partial credit), and Numerical Answer Type (NAT) range matching with floating-point tolerance $[3.14, 3.16]$.

---

## 1. Wave 6 Spaced Repetition SM-2, Importer Pipeline & Database Hygiene Completed

### Option 1: Spaced Repetition SuperMemo SM-2 Algorithm & Retention Pipeline

- **Implemented Dedicated Unit Test Suite**:
  - Created [`nodeEngineService.test.js`](apps/backend/src/__tests__/nodeEngineService.test.js) covering the core algorithms:
    - `calculateMastery`: evaluates accuracy $\times$ speed factor penalties for slow responses.
    - `getTimeDecay`: calculates Ebbinghaus forgetting curve decay from 0.0 (fresh) to 1.0 (30+ days).
    - `getRecommendationScore`: multi-factor priority ranking weighting $(1 - \text{mastery}) \times 0.5 + \text{difficulty} \times 0.3 + \text{freshness} \times 0.2$.
    - `shouldRevise`: dynamic Ebbinghaus mastery threshold calculation.
  - **Pass Rate**: 10 / 10 tests passed.
- **Frontend Widget Integration**:
  - Verified [`NodeEngineWidget.jsx`](apps/frontend/src/shared/components/NodeEngineWidget.jsx) integrating `/api/node-engine/recommendations` and `/api/node-engine/spaced-repetition`.

### Option 2: Admin Live Test Creation & Participant Real-Time Monitoring

- **Admin Live Test Endpoints**:
  - Verified [`admin-live-tests.js`](apps/backend/src/api/routes/admin-live-tests.js) endpoints for `POST /`, `POST /bulk`, `GET /:id`, `PUT /:id`, and `DELETE /:id`.
  - Audited real-time participant counts and timer synchronization via Socket.IO.

### Option 3: Full Test Import & Syllabus Parser Pipeline

- **Validation Engine**:
  - Audited [`fullTestImporter.js`](apps/backend/src/services/import/fullTestImporter.js) pre-commit validation: verifies section questions counts match total questions, enforces unique test slugs, and wraps question inserts in transactional savepoints.

### Option 4: Automated Database Health & Stale Attempt Cleanup

- **Database Maintenance Execution**:
  - Executed `node scripts/clean-stale-paused-attempts.js`: verified database hygiene for abandoned or completed attempt states (0 stale rows, perfectly clean).
- **Monorepo Test Pass Rate**:
  - Executed `pnpm -r test`: **507 / 507 tests passed** across all packages (Backend 300, Frontend 169, Admin 38).

---

## 2. Wave 5 Real-Time Concurrency, SEO JSON-LD & Pool Routing Completed

### Option 1: Live Mock Concurrency & Anti-Cheat WebSocket Eviction

- **Multi-Tab Attempt Eviction**:
  - Audited [`websocketManager.js`](apps/backend/src/infrastructure/websocket/websocketManager.js) and validated [`websocketEviction.test.js`](apps/backend/src/__tests__/websocketEviction.test.js): when a candidate connects with the same `attemptId` from a second tab or device, the active socket registry automatically issues `attempt:evicted` to terminate the older session.
- **Real-Time Live Test Rooms**:
  - Audited `live-tests:join`, `live-tests:leave`, and `admin:live-tests:subscribe` room handling with Redis Socket.IO adapter broadcasting live participant counts and timer countdowns.

### Option 2: SEO Educational Schema & Rich OpenGraph Previews

- **Schema.org JSON-LD Injection**:
  - Injected structured data into [`apps/frontend/index.html`](apps/frontend/index.html) complying with Google Search rich result guidelines:
    - `@type: "EducationalOrganization"` with name, logo, URL, and social channel links.
    - `@type: "Course"` representing the SSC & Railway Comprehensive Mock Test Series with `hasCourseInstance` and credential details.
- **Social Media Cards**:
  - Verified OpenGraph (`og:title`, `og:description`, `og:image`) and Twitter Cards (`summary_large_image`) for Facebook, Telegram, WhatsApp, and Twitter share previews.

### Option 3: Read/Write Database Pool Routing & Replica Failover

- **Split Connection Pool Architecture**:
  - Audited [`database-replicas.js`](apps/backend/config/database-replicas.js) and [`postgres-helpers.js`](apps/backend/src/infrastructure/database/postgres-helpers.js):
    - `getWritePool()` initializes the primary connection pool (`trstprep-backend-write`).
    - `getReadPool()` routes read queries to `DATABASE_READ_URL` (`trstprep-backend-read`), with automatic seamless fallback to the primary pool when the read replica is unconfigured.
    - Automatic IPv4-first DNS resolution (`dns.setDefaultResultOrder('ipv4first')`) prevents connection timeouts on cloud databases.

### Option 4: Bundle Budget & CSS/Font Tree-Shaking Audit

- **Chunk Performance Budgets**:
  - Re-verified production build (`pnpm --filter trstprep-frontend run build`): completed in 31.1s.
  - Isolated heavy libraries into on-demand asynchronous chunks:
    - `recharts` isolated in `dist/assets/recharts-*.js` (421 kB).
    - `katex` isolated in `dist/assets/katex-*.js` (259 kB).
    - Initial `index` JavaScript bundle stays lean at 358 kB (gzip: 103 kB).
  - Preloaded Google Font (`Inter`) and critical background theme CSS in `<head>` preventing white flash on dark-mode loads.
- **Full Monorepo Tests**:
  - `pnpm -r test` passed 100% across all 497 tests in the repository.

---

## 2. Wave 4 DRM, AI Gateway, Payment & CI/CD Verification Completed

### Option 1: Video DRM & Anti-Piracy Streaming Pipeline (`video-drm-encryption`)

- **Cryptographic Self-Test**:
  - Executed `node .agents/skills/video-drm-encryption/scripts/encrypt_video.js test`: 100% pass rate on AES-256 CTR/GCM buffer encryption and in-memory decryption.
- **Client Playback & Anti-Piracy Watermarking**:
  - Verified [`VideoPlayer.jsx`](apps/frontend/src/shared/components/common/VideoPlayer.jsx) (`FortSpyPlayer`) canvas rendering for encrypted stream decodes.
  - Verified [`DynamicWatermark.jsx`](apps/frontend/src/shared/components/common/VideoPlayer/DynamicWatermark.jsx): floating diagonal student identity stamps randomly repositioned every 7 seconds to thwart external screen grabbers.
  - Verified [`fortspy.js`](apps/backend/src/api/routes/fortspy.js) stream token validation (`type: 'fortspy-stream'`).

### Option 2: AI Tutor Gateway & Prompt Injection Hardening (`aiClient.js`)

- **Implemented Comprehensive Unit Tests**:
  - Created [`aiClient.test.js`](apps/backend/src/__tests__/aiClient.test.js) covering prompt injection detection, moderation, and provider fallback topology.
  - Verified `isContentToxic`: blocks attempts to leak system instructions ("ignore previous instructions", "reveal system prompt") and abusive language while allowing academic queries.
  - Tested OpenRouter primary gateway and secondary OpenAI fallback configuration.
- **Pass Rate**: 5 / 5 tests passed.

### Option 3: Payment Gateway & Webhook Reconciliation

- **Cryptographic Signature Verification**:
  - Verified [`payments.js`](apps/backend/src/api/routes/payments.js) timing-safe HMAC SHA-256 signature verification (`crypto.timingSafeEqual`) preventing side-channel attacks.
  - Validated all 3 payment test suites (`payments.webhook.test.js`, `payment-settings.test.js`, `payment-webhooks.test.js`): 22 / 22 tests passed.

### Option 4: Production Containerization & CI/CD Readiness

- **Migration & Data Guard Integrity**:
  - Verified all 123 database migrations have unique numeric prefixes.
  - Verified `.github/workflows/data-guard.yml` and `.github/workflows/no-env.yml` compliance: zero live `.env` files tracked by git.
  - Verified overall monorepo test count increased to **497 / 497 passing tests** (100% green).

---

## 2. Wave 3 Security, Analytics, Database & PWA Audit Completed

### Option 1: P0 Security Audit & Credential Guard (Redcell / Martian56)

- **Automated Security Scan**:
  - Executed `node .agents/skills/redcell-security-audit/scripts/audit_site_security.js` across the entire codebase.
  - Verified that flagged template string SQL queries (in `study.js`, `admin-recycle-bin.js`, `postgres-helpers.js`) are strictly guarded by identifier whitelists (`ALLOWED_COUNT_TABLES`, `TRASH_TABLES`) or dynamic parameter bindings (`$1, $2, ...`).
- **Secret & PII Guard**:
  - Verified `.gitignore` production exclusions: all `.env`, `.env.local`, `apps/*/.env`, `*.bak`, and database archives are uncommitted and ignored.
  - Confirmed no active `M3 Key.txt` or live credentials in working tree.
- **IDOR Protection**:
  - Audited multi-tenant ownership enforcement via `idsMatch(resource.userId, req.user.id)` across sensitive test, attempt, profile, and bookmark endpoints.

### Option 2: Practice Lab & Learning Analytics (Practice↔Test Bridge)

- **Weak-Area Diagnostic Feedback**:
  - Audited `SubscriptionService.js` (`getWeakTopics` and `/api/subscriptions/weak-topics`), which joins `attempt_answers`, `attempts`, and `questions` to isolate topics with >50% error rates.
  - Verified `attempt.repository.js` batch multi-row inserts (`attempt_answers`) populating question-level timing and correctness for analytics.
- **Reattempt Options**:
  - Validated `createReattempt` creating targeted practice sessions from incorrect or skipped questions.

### Option 3: Database Indexing & High-Throughput Caching Audit

- **Schema & Index Verification**:
  - Executed `node scripts/run-database-audit.js`: **0 warnings, PASSED**.
  - Confirmed 19 expected tables, AES-256-GCM PII encryption columns (`phone_enc`, `dob_enc`), soft-delete columns (`is_deleted`), and 5 foreign key constraints.
  - Verified all 14 high-throughput GIN and B-tree indexes (`idx_attempts_user_submitted`, `idx_attempts_section_timers_gin`, `idx_users_enrolled_series_gin`, `idx_practice_answers_user_created`).
  - Confirmed HNSW vector index tuning (m=32, ef_construction=200) for semantic question search.

### Option 4: PWA Offline Test-Taking & Mobile Viewport Audit

- **Offline Event & Answer Resilience**:
  - Audited `TelemetryService.js` and `OfflineQueue.js`: offline events are queued when `!navigator.onLine` (up to 1,000 events) and automatically flushed upon network restoration.
  - Audited `TestInterface.jsx`: candidate answers are buffered in `localStorage` with quota overflow protection, oldest-session LRU eviction, and automatic restoration upon reload.
- **Monorepo Test Pass Rate**:
  - Executed `pnpm -r test`: **492 / 492 tests passed** (Backend 285, Frontend 169, Admin 38).

---

## 2. Wave 2 Objectives Completed

### Option 1: Decomposition of Final God Component (`Analysis.jsx`)

- **Extracted [`InsightsTab.jsx`](apps/frontend/src/pages/dashboard/components/InsightsTab.jsx)**:
  - Extracted the heavy cognitive workload modules: Attempt Pattern Breakdown, Topper Comparison Benchmarking, Speed vs. Accuracy 4-Quadrant Matrix, and AI-driven Smart Recommendations.
  - Replaced over 350 lines of monolithic code in [`Analysis.jsx`](apps/frontend/src/pages/dashboard/Analysis.jsx).
- **Extracted [`ScoreSparkline.jsx`](apps/frontend/src/pages/dashboard/components/ScoreSparkline.jsx)**:
  - Created a reusable, lightweight SVG sparkline for trend visualization without heavy chart overhead.
- **Verification**:
  - `pnpm --filter trstprep-frontend run build` completed cleanly in 20.0s (`Analysis` chunk reduced to 55 kB).
  - `pnpm --filter trstprep-frontend test` passed 169/169 tests across 13 test suites.

---

### Option 2: Admin Panel Build & Route Hardening

- **Production Compilation**:
  - Executed `pnpm --filter trstprep-admin run build`: built 78 assets in 25.26s with zero errors or warnings.
- **Route & API Alignment**:
  - Verified admin navigation and API client endpoints against backend mounts:
    - `/api/admin/trash` and `/api/admin/recycle-bin` in `adminAPI.js` perfectly match [`admin-recycle-bin.js`](apps/backend/src/api/routes/admin-recycle-bin.js).
    - `/api/admin/live-tests` matches [`admin-live-tests.js`](apps/backend/src/api/routes/admin-live-tests.js) for live test lifecycle and real-time monitoring.
- **Lint & Test Verification**:
  - `pnpm --filter trstprep-admin run lint` passed with 0 ESLint errors.
  - `pnpm --filter trstprep-admin test` passed all 38 tests across 7 test suites.

---

### Option 3: Knowledge Graph & Architecture Sync

- **AST Knowledge Graph Re-Extraction**:
  - Executed `graphify update .` using the AST extractor (zero LLM token cost).
  - Rebuilt graph with **16,036 nodes**, **21,132 edges**, and **1,184 communities** stored in `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md`.
- **REPO_BRAIN Synchronization**:
  - Executed `node scripts/sync-repo-brain.mjs`.
  - Refreshed 46 `<span data-brain="...">` markers in [`docs/REPO_BRAIN.html`](docs/REPO_BRAIN.html) (123 migrations, commit HEAD, node/edge counts).

---

### Option 4: End-to-End Mock Test Engine Simulation

- **Automated E2E Simulation Suite**:
  - Implemented [`apps/backend/src/__tests__/mockTestEngineSimulation.e2e.test.js`](apps/backend/src/__tests__/mockTestEngineSimulation.e2e.test.js).
  - Simulates the full lifecycle across 4 phases:
    1. **Phase 1: Test Configuration & Instructions**: 100 questions across 4 SSC sections (Reasoning, General Awareness, Quant, English), positive marks = 2, negative = 0.5.
    2. **Phase 2: Candidate Interaction & State**: Navigation across sections, single-choice answers, MSQ multi-select answers, mark for review, section timers, and progress updates.
    3. **Phase 3: Grading Engine Evaluation**: Exact negative marking penalties, partial evaluation, and sectional breakdowns (87 attempted: 77 correct, 10 wrong, 13 unattempted = 149/200 marks).
    4. **Phase 4: Scorecard Generation & Solution Review**: Accuracy (88.5%), percentile ranking against benchmark cohort, identification of strongest/weakest areas, and step-by-step solution verification.
- **Verification**:
  - `pnpm --filter trstprep-backend test mockTestEngineSimulation` passed 4/4 phases in 0.4s.
  - Full backend suite: 39 / 39 test suites passed, 285 / 285 tests passed.

---

## 2. Summary of Wave 1 Deliverables (Previously Completed)

- **God Component Decomposition**: Extracted `TestDetailsSidebar.jsx` (260 lines) from `TestDetails.jsx`, `TestSolutionsList.jsx` (420 lines) from `TestResult.jsx`, and modularized `TestInterface.jsx`.
- **Bundle Optimization**: Lazy-loaded `LeaderboardCharts.jsx` isolating 421 kB of `recharts`. Fixed Vite proxy route shadowing (`/assets` -> `/assets/avatar`). Resolved `apiBase.js` localhost preview fallback.
- **Browser Smoke Test**: E2E browser subagent verified `/`, `/leaderboard`, and `/test-series` with theme toggles and data loading.
- **Security & Privacy Hardening**: Added Redis timeout non-fatal resilience in `app-port5001.js`. Embedded DPDP Act 2023 statutory notices and grievance officer protocols in `Privacy.jsx`.

---

---

## 3. Wave 7 Deliverables: Vector Search, Leaderboard, Certificates & Audit Hardening

### Option 1: Vector Search & Semantic Question Similarity (`vectorSearch.service.js`)

- **pgvector & Embedding Coverage**:
  - Created [`apps/backend/src/__tests__/vectorSearch.service.test.js`](apps/backend/src/__tests__/vectorSearch.service.test.js) with 14 comprehensive unit tests.
  - Verified pgvector extension detection (`extname = 'vector'`).
  - Verified 1536-dimensional embedding generation via OpenAI/OpenRouter embeddings API.
  - Verified cosine distance similarity querying using PostgreSQL vector operator `<=>` (`1 - (qsi.embedding <=> $1::vector) >= threshold`).
  - Hardened error handling in `generateEmbedding` by throwing a standard `Error` instance with attached `latencyMs` rather than a plain object.
  - Discovered and fixed missing `getIndexStats()` method on [`QuestionSearchIndex.js`](apps/backend/src/data/models/search/QuestionSearchIndex.js) to prevent unhandled runtime errors in `vectorSearchService.getStats()`.

### Option 2: Leaderboard & Dynamic Ranking Engine (`leaderboardService.js`)

- **Ranking, Tie-Breaking & Percentile Calibration**:
  - Expanded [`apps/backend/src/__tests__/leaderboardService.test.js`](apps/backend/src/__tests__/leaderboardService.test.js) from 4 to 10 tests.
  - Verified tie-breaking logic: candidates with identical scores are ranked by lowest `timeSpent`.
  - Verified best attempt deduplication: candidate submitting multiple attempts receives ranking based on their highest score.
  - Verified dynamic sorting criteria (`sortBy: 'time'`, `sortBy: 'accuracy'`).
  - Verified daily and weekly aggregation over multi-test candidate cohorts.
  - **Critical Bug Fix**: Discovered and resolved a timestamp normalization defect in `leaderboardService.js` where snake_case database timestamps (`submitted_at`, `updated_at`, `created_at`) were omitted during object mapping, causing daily and weekly date range filters to evaluate to epoch 0 and return empty arrays.

### Option 3: Certificate Generation & Public Verification (`certificateService.js`)

- **Cryptographic Non-Repudiation & Revocation**:
  - Expanded [`apps/backend/src/__tests__/certificateService.test.js`](apps/backend/src/__tests__/certificateService.test.js) from 9 to 14 tests.
  - Verified SHA-256 hash generation with 16-byte random salt ensuring two certificates for the same candidate attempt have unique, unguessable verification hashes.
  - Verified certificate revocation mechanism (`revokeCertificate`) returning `is_revoked = TRUE`.
  - Verified revoked certificate verification rejection (`isValid: false, message: 'Certificate not found or has been revoked'`).
  - Verified database failure resilience (gracefully returns system unavailable message without unhandled rejections).

### Option 4: Admin Audit Trail & Sensitive Action Logging (`audit.middleware.js`)

- **Metadata Capture & Security Enforcement**:
  - Expanded [`apps/backend/src/__tests__/audit.middleware.test.js`](apps/backend/src/__tests__/audit.middleware.test.js) from 4 to 9 tests.
  - Verified client IP normalization: strips IPv6 prefixes (`::ffff:203.0.113.195` -> `203.0.113.195`), extracts leftmost hop from multi-proxy `x-forwarded-for` headers, and captures `user-agent`.
  - Verified HTTP method mapping to audit actions (`POST` -> `create`, `DELETE` -> `delete`, `GET` -> `read`).
  - Verified integer and UUID resource ID extraction from route paths.
  - Verified `skipPaths` bypass for admin audit logs and internal metrics endpoints.
  - Verified failure status tracking (`status: 'failure'` when status code >= 400).
  - Verified direct programmatic auditing via `createAuditLog`.

---

---

## 4. Wave 8 Deliverables: Study Groups, Test Policy Engine, Notifications & Lockout Defense

### Option 1: Study Group Real-Time Sync & Live Discussion (`studyGroups.js`)

- **API Coverage & Member Management**:
  - Created [`apps/backend/src/__tests__/studyGroups.test.js`](apps/backend/src/__tests__/studyGroups.test.js) with 16 comprehensive unit tests using native Node HTTP server and fetch.
  - Verified public group listings and private group filtering for unauthenticated visitors.
  - Verified study group creation with automatic creator admin member registration.
  - Verified membership join validation: duplicate member rejection and max member capacity capping.
  - Verified leave protection preventing sole admin from abandoning group without reassignment or deletion.
  - Verified role promotion permissions (`PUT /:id/member/:memberId/role`).
  - Verified group chat messages, discussion posts, comments, upvotes/likes, and pinned posts.

### Option 2: Test Policy Engine Edge Cases & Late Submissions (`TestPolicyEngine.js`)

- **Subscription Expiry & Attempt State Transitions**:
  - Expanded [`apps/backend/src/__tests__/testPolicyEngine.test.js`](apps/backend/src/__tests__/testPolicyEngine.test.js) from 18 to 25 tests.
  - Tested expired pro pass degrading users to `USER_PLANS.FREE` vs active future expiry retaining `USER_PLANS.PRO_MONTHLY`.
  - Tested archived and inactive test blocking (`POLICY_ERROR_CODES.TEST_UNAVAILABLE`) and content QA review blocking (`POLICY_ERROR_CODES.TEST_NOT_AVAILABLE`).
  - Tested attempt lifecycle state machine transitions (`isValidAttemptTransition`) against `ATTEMPT_STATES` enums, preventing re-opening of completed tests or pausing completed tests.

### Option 3: Notification Service & In-App Alerts Delivery (`notificationService.js`)

- **Multichannel Alert Dispatching & Scheduled Reminders**:
  - Created [`apps/backend/src/__tests__/notificationService.test.js`](apps/backend/src/__tests__/notificationService.test.js) with 12 unit tests.
  - Verified in-app notification creation with canonical `actionUrl` and metadata.
  - Verified email notification dispatch via `EmailService.sendNotificationEmail` and push notification payloads.
  - Verified admin setting gating (`isNotificationEnabled` for `emailOnPayment`, `emailOnRegistration`, `pushNotifications`).
  - Verified critical alert instant delivery vs non-critical batched frequency.
  - Verified automated background jobs (`notifications.test-result-ready`, `notifications.subscription-purchased`, `notifications.daily-reminder`).
  - Verified scheduled inactivity reminders query and dispatch.

### Option 4: CSRF & Session Lifecycle Defense In-Depth (`lockout.middleware.js`)

- **Brute-Force Protection & Progressive Lockout**:
  - Created [`apps/backend/src/__tests__/lockout.middleware.test.js`](apps/backend/src/__tests__/lockout.middleware.test.js) with 11 unit tests.
  - Verified `checkAccountLockout`: threshold calculation (5 failed attempts), progressive lockout factors (10 attempts -> 60 minutes lockout), and lockout expiry window evaluation.
  - Verified `recordLoginAttempt` into `login_attempts` table and `clearLoginAttempts` on successful authentication.
  - Verified `lockoutMiddleware`: bypass for non-lockout paths and admin requests, 429 `ACCOUNT_LOCKED` block with retry-after header and audit trail logging, and response finish handler for login attempts.

---

## 5. Wave 9 Deliverables: Entitlements, Solution Analytics, Maintenance Mode & Question Import

### Option 1: Enrollment & Subscription Entitlement Hardening (`EnrollmentService.js`, `SubscriptionService.js`)

- **Enrollment Service Architecture & Backward Compatibility**:
  - Created [`apps/backend/src/__tests__/enrollmentService.test.js`](apps/backend/src/__tests__/enrollmentService.test.js) with 22 unit tests.
  - Verified `isEnrolledInSeries`, `isEnrolledInExam`, `isEnrolledInStudyMaterial` active lookup.
  - Verified `enrollInSeries`, `enrollInExam`, and `enrollInStudyMaterial`: duplicate enrollment protection (`alreadyEnrolled: true`), record creation, and backward compatibility sync with `users.enrolled_series`, `users.enrolled_exams`, and `users.enrolled_study_materials`.
  - Verified `unenrollFromSeries`, `unenrollFromExam`, and `unenrollFromStudyMaterial`: soft deletion (`isActive: false, status: 'cancelled'`) and removal from user legacy arrays.
  - Verified legacy PostgreSQL array parsing: handles raw arrays, stringified JSON (`'[1,2]'`), and Postgres text format (`'{1,2,3}'`).
  - Verified enrollment stats aggregation and progress clamping between 0% and 100%.
- **Subscription Service & Entitlement Rules**:
  - Created [`apps/backend/src/__tests__/subscriptionService.test.js`](apps/backend/src/__tests__/subscriptionService.test.js) with 22 unit tests.
  - Verified `getUserSubscription` plan resolution (`pro_monthly` -> "Pro Monthly", `pro_yearly` -> "Pro Yearly", `trial` -> "Trial", fallback -> "Free").
  - Verified Pro Pass detection with legacy fallback (`is_pro_user` and unexpired `pro_expiry`).
  - Verified feature flags resolution (`hasFeature`, `getUserFeatures`).
  - Verified `canAttemptTest`: unlimited attempts for Pro users vs 3-attempt limit for free users with upgrade URL suggestion.
  - Verified `createSubscription`: atomic database transaction (`BEGIN`, `INSERT`, `UPDATE users`, `COMMIT`, `ROLLBACK`).
  - **Critical Bug Fix**: Discovered and resolved a prepared statement binding bug in [`SubscriptionService.js`](apps/backend/src/services/SubscriptionService.js) where `cancelSubscription` calculated scoped parameters `[subscriptionId, userId]` but passed `[subscriptionId]`, which caused database errors when cancelling with `userId`. Fixed to pass dynamic `params`.
  - Verified reattempt query helpers: `getWrongQuestions`, `getUnattemptedQuestions`, and `getSlowQuestions`.
  - Verified `EntitlementService` rules: test entitlement is decoupled from series access; free tests inside Pro series are attemptable by all.

### Option 2: Test Result Normalization & Solution Analytics (`scoreAttempt.js`, `attempt.service.js`)

- **Scoring Pipeline & Lifecycle State Machine**:
  - Created [`apps/backend/src/__tests__/attemptService.test.js`](apps/backend/src/__tests__/attemptService.test.js) with 16 unit tests.
  - Verified `attemptService.start`: test existence checks, active attempt resumption, free attempt limit capping (3 attempts max), and analytics event emission (`analytics.test-started`).
  - Verified `saveProgress`, `pause`, and `resume`: user ownership authorization, section timers, and answer updates.
  - Verified `submit`: server-side score calculation (+2 positive, -0.5 negative for SSC, MSQ partial marking), accuracy percentage calculation, section score breakdowns, and insertion into `results` table for analytics/leaderboards.
  - Verified `getResult`: ownership verification (`attempt.userId === requestingUserId`).
  - Verified `transitionAttempt`: enforces `isValidAttemptTransition` state machine preventing invalid regressions (e.g. `completed` -> `in_progress`).
  - Verified `createReattempt`: modes (`wrong`, `unattempted`, `slow`, `smart`), question filtering, error code `NO_QUESTIONS_FOR_REATTEMPT` if all questions correct, and atomic creation of reattempt attempt record.

### Option 3: Admin Maintenance Mode & Banner Alerts Pipeline (`maintenance.middleware.js`, `maintenance.js`)

- **System Maintenance & Retention Engine**:
  - Created [`apps/backend/src/__tests__/maintenance.service.test.js`](apps/backend/src/__tests__/maintenance.service.test.js) with 4 unit tests covering `purgeDeadLetterJobs` (retention days, row counts, error recovery) and `runDatabaseMaintenance`.
  - Expanded [`apps/backend/src/__tests__/maintenance.middleware.test.js`](apps/backend/src/__tests__/maintenance.middleware.test.js) from 5 to 9 unit tests.
  - Verified `super_admin` role bypass via cookie token.
  - Verified `allowAdminAccess: false` blocking even authenticated administrators during emergency downtime.
  - Verified fail-open behavior: if settings lookup fails, requests pass through to prevent cascading platform outages.
  - Verified expired/malformed token handling returning 503 `MAINTENANCE_MODE`.

### Option 4: Question Import & Bulk Validation Engine (`fullTestImporter.js`, `bulkImport.service.js`)

- **Schema Validation & CSV/Excel Row Validation**:
  - Created [`apps/backend/src/__tests__/questionImportValidation.test.js`](apps/backend/src/__tests__/questionImportValidation.test.js) with 8 unit tests.
  - Verified `validateJsonSchema` from `fullTestImporter.js`:
    - Graceful handling of null/undefined inputs without throwing.
    - Full validation of well-formed test payloads with zero missing and zero extra fields.
    - Accurate detection of missing required test, section, and question fields.
    - Detection of unexpected/unrecognized fields at test, section, and question level.
    - Bilingual/multilingual support (`text.en`, `options_bilingual.en`, `explanationHi`, etc.).
    - Wrapped formats: arrays of tests and `{ tests: [...] }` wrappers.
  - Verified `bulkImportService.validateRows`:
    - Full verification of valid rows.
    - Detection of missing question text, insufficient options (< 2), and missing correct answers.

---

## 6. Wave 10 Deliverables: Spaced Repetition, WebSocket Eviction, Webhook Idempotency & Live Browser E2E

### Option 1: AI Study Planner & Socratic Tutor Hardening (`smartRevision.service.js`)

- **Spaced Repetition Scheduling Engine**:
  - Created [`apps/backend/src/__tests__/smartRevision.service.test.js`](apps/backend/src/__tests__/smartRevision.service.test.js) with 7 unit tests.
  - Verified `addToRevisionQueue`: priority interval calculation (high: 1 day, medium: 3 days, low: 7 days) and upsert logic (updating priority if question already present in queue).
  - Verified `getDueRevisions`: queries questions due (`due_at <= NOW()`) sorted by priority and next review time.
  - Verified `completeRevision`:
    - Advances spaced repetition interval progression (`[1, 3, 7, 14, 30]`) when `remembered = true`.
    - Resets interval to day 1 when `remembered = false`.
    - Soft-deletes / cancels older pre-inserted duplicate revision items to prevent stale duplicate surfacing.
  - Verified `getMostCommonTopics`: aggregates wrong question distribution across topics and formats descending frequency reports.

### Option 2: WebSocket Concurrency & Multi-Device Session Eviction (`websocketManager.js`, `websocketEviction.test.js`)

- **Active Registry & Multi-Device Single-Login Defense**:
  - Expanded [`apps/backend/src/__tests__/websocketEviction.test.js`](apps/backend/src/__tests__/websocketEviction.test.js) to 5 comprehensive tests.
  - Verified multi-tab attempt collision: when a candidate opens the same test attempt in a second tab, the older tab receives `attempt:evicted` and leaves the socket room `attempt:{id}`.
  - Verified multi-device single session enforcement: when user logs in from a new device, previous connected sockets receive `session:evicted` with code `MULTI_DEVICE_LOGIN` and are forcibly disconnected.
  - Verified room broadcast scoping: live-test submission events broadcast strictly to `admin:live-tests` and `test:{id}` when `source === 'live-tests'`.
  - Verified socket event rate limiting: protects against event flooding beyond 60 events/minute.

### Option 3: Payment Gateway Edge Cases & Webhook Idempotency (`payments.webhook.test.js`)

- **HMAC Verification, Idempotency & Ledger Synchronization**:
  - Expanded [`apps/backend/src/__tests__/payments.webhook.test.js`](apps/backend/src/__tests__/payments.webhook.test.js) from 2 stubbed tests to 7 unit tests.
  - Verified HMAC SHA-256 signature verification using constant-time comparison `crypto.timingSafeEqual`.
  - Verified error conditions: missing webhook secret (500), missing `x-razorpay-signature` (400), tampered payload signature mismatch (400).
  - Verified idempotency deduplication: retried webhooks with identical `gateway_payment_id` and event type return `{ success: true, message: "Webhook already processed" }` without duplicate ledger entries or subscription extensions.
  - Verified `refund.processed` / `refund.created`: updates payment ledger state to `refunded` with accurate refund amounts and timestamps.

### Option 4: Live E2E Browser Testing & Visual Regression

- **Full Interactive Browser Validation**:
  - Executed live automated browser verification using `browser_subagent` against `http://localhost:3000`.
  - **Landing Page (`/`)**: clean hero banner, navigation bar, stat counters, exam categories grid, features showcase, and footer without visual glitches.
  - **Test Series Catalog (`/test-series`)**: verified test catalog layout, search input responsiveness (typed "SSC" query), and category filtering.
  - **Leaderboard (`/leaderboard`)**: verified proper Pro Pass feature paywall presentation for non-authenticated guests with functional call-to-action to unlock access.
  - **Recorded Visual Artifact**: Complete session video captured and persisted at [`wave10_e2e_verify_1788614622363.webp`](file:///C:/Users/mahic/.gemini/antigravity-ide/brain/3e8fc118-6d48-4a54-8df0-cd5448f3b075/wave10_e2e_verify_1788614622363.webp).

---

## 7. Wave 11 Deliverables: Containerization Audit, DB Benchmarks, i18n & Web Vitals

### Option 1: Production Deployment & Docker Containerization Audit

- **Multi-Stage Builds & Unprivileged Containers**:
  - Audited [`apps/backend/Dockerfile`](apps/backend/Dockerfile): multi-stage compilation on `node:20-alpine`, non-root user `appuser` (UID 1001), healthcheck probe (`wget -qO- http://localhost:5001/api/health`).
  - Audited [`apps/frontend/Dockerfile`](apps/frontend/Dockerfile): build args injection (`VITE_API_URL`, `VITE_SOCKET_URL`), static Vite bundling, unprivileged `nginx` user runtime.
  - Audited [`apps/admin-panel/Dockerfile`](apps/admin-panel/Dockerfile): multi-stage Vite build and nginx non-root execution.
  - Audited [`docker-compose.yml`](docker-compose.yml):
    - Strict network isolation: `frontend-net`, `backend-net`, `monitoring-net`.
    - Hardened security: `read_only: true`, `cap_drop: ALL`, `no-new-privileges: true`.
    - Memory & CPU limits: `512M` memory and `1.0` CPU cap per backend instance.
    - Centralized logging via Grafana Loki driver (`loki:3100`).
  - Audited [`deploy/nginx/nginx.conf`](deploy/nginx/nginx.conf): `least_conn` load balancing across backend nodes, `ip_hash` sticky session routing for WebSockets, rate limiting zones (`api_limit: 30r/s`, `auth_limit: 5r/s`), and gzip compression level 6.

### Option 2: Database Index & Query Plan Optimization

- **Schema Audit & Index Verification**:
  - Executed [`scripts/run-database-audit.js`](scripts/run-database-audit.js) against live Supabase PostgreSQL database.
  - Result: **0 warnings, PASSED**.
  - All 19 critical application tables verified (`users`, `tests`, `questions`, `attempts`, `test_series`, `test_categories`, `test_category_series`, etc.).
  - Verified PII AES-256-GCM encryption (`phone_enc`, `dob_enc`), column type standardization, soft-delete columns, and validated foreign key constraints.
  - Verified composite & GIN indexes (`idx_attempts_user_submitted`, `idx_attempts_completed_submitted`, `idx_attempts_section_timers_gin`, `idx_users_enrolled_series_gin`).
  - Verified tuned HNSW vector indexes (`m=32, ef_construction=200`).

### Option 3: Internationalization (i18n) & Bilingual Fallbacks

- **Devanagari Script Detection & Content Fallback**:
  - Expanded [`apps/frontend/src/__tests__/language.test.jsx`](apps/frontend/src/__tests__/language.test.jsx) from 16 to 24 tests (100% pass rate).
  - Verified `getLocalizedField`:
    - Embedded span extraction: `<span class="eqt">English</span><span class="hqt">Hindi</span>` correctly extracts requested language.
    - Graceful bidirectional fallback: if requested language span is empty, transparently falls back to the alternate language to prevent blank fields.
    - Multi-language object support: `{ en: '...', hi: '...' }` with fallback.
    - Array mapping: resolves arrays of bilingual options.
  - Verified `pickDefaultLanguage`: accurately evaluates candidate question text and selects `hi` for Devanagari content vs `en` for Latin content.

### Option 4: Automated Web Vitals & Performance Audit

- **Subagent Live Performance Profiling**:
  - Executed automated performance profiling against `http://localhost:3000` and `http://localhost:3000/test-series`.
  - **Landing Page (`/`)**:
    - **FCP**: **300 ms** (Google Good threshold < 1,800 ms)
    - **DOM Interactive**: **35 ms**
    - **DOMContentLoaded**: **79 ms**
    - **Page Load**: **87 ms**
    - **TTFB**: **20 ms**
    - **Asset Health**: 0 broken images, 0 console errors.
  - **Test Series Catalog (`/test-series`)**:
    - **FCP**: **240 ms**
    - **DOM Interactive**: **114 ms**
    - **DOMContentLoaded**: **147 ms**
    - **Page Load**: **148 ms**
    - **TTFB**: **11 ms**
    - **Asset Health**: 35 resources cleanly loaded, 0 broken images, 0 console errors.
  - **Recorded Visual Artifact**: Complete Web Vitals audit session captured and saved at [`web_vitals_audit_1788615740637.webp`](file:///C:/Users/mahic/.gemini/antigravity-ide/brain/3e8fc118-6d48-4a54-8df0-cd5448f3b075/web_vitals_audit_1788615740637.webp).

---

## 8. Monorepo Quality & Verification Matrix

| Component / Test Suite           | Command                                     | Result                                                       |
| :------------------------------- | :------------------------------------------ | :----------------------------------------------------------- |
| **Backend Unit & E2E Tests**     | `pnpm --filter trstprep-backend test`       | **68 / 68 suites passed, 627 / 627 tests (100%)**            |
| **Frontend Unit Tests**          | `pnpm --filter trstprep-frontend test`      | **18 / 18 suites passed, 200 / 200 tests (100%)**            |
| **Admin Panel Unit Tests**       | `pnpm --filter trstprep-admin test`         | **7 / 7 suites passed, 38 / 38 tests (100%)**                |
| **Monorepo Total Tests**         | Monorepo aggregate (`pnpm -r test`)         | **865 / 865 tests passed (100% pass rate across 93 suites)** |
| **Frontend Production Build**    | `pnpm --filter trstprep-frontend run build` | **Built in 20.06s (0 errors, clean chunks)**                 |
| **Admin Panel Production Build** | `pnpm --filter trstprep-admin run build`    | **Built in 25.26s (0 errors, clean chunks)**                 |
| **Admin Panel Lint**             | `pnpm --filter trstprep-admin run lint`     | **0 errors, clean**                                          |
| **Database Schema Audit**        | `node scripts/run-database-audit.js`        | **0 warnings, PASSED**                                       |
| **Knowledge Graph Sync**         | `graphify update .`                         | **16,527 nodes, 21,726 edges, 1,207 communities**            |
| **Repo Brain HTML Sync**         | `node scripts/sync-repo-brain.mjs`          | **8 data-brain markers refreshed, 124 migrations**           |
| **Git Safety Check**             | `git status`                                | **0 commits created (all changes in working tree)**          |

---

## 9. Git Working Tree Status (Zero Commits Enforced)

```
Changes not staged for commit:
	modified:   apps/backend/src/__tests__/audit.middleware.test.js
	modified:   apps/backend/src/__tests__/certificateService.test.js
	modified:   apps/backend/src/__tests__/leaderboardService.test.js
	modified:   apps/backend/src/__tests__/maintenance.middleware.test.js
	modified:   apps/backend/src/__tests__/payments.webhook.test.js
	modified:   apps/backend/src/__tests__/testPolicyEngine.test.js
	modified:   apps/backend/src/__tests__/websocketEviction.test.js
	modified:   apps/backend/src/api/routes/achievements.js
	modified:   apps/backend/src/api/routes/admin-import.js
	modified:   apps/backend/src/api/routes/admin-recycle-bin.js
	modified:   apps/backend/src/api/routes/admin-tests.js
	modified:   apps/backend/src/api/routes/admin.js
	modified:   apps/backend/src/api/routes/intelligence.js
	modified:   apps/backend/src/api/routes/notifications.js
	modified:   apps/backend/src/api/routes/payments.js
	modified:   apps/backend/src/api/routes/practice.js
	modified:   apps/backend/src/api/routes/public-routes-index.js
	modified:   apps/backend/src/api/routes/study.js
	modified:   apps/backend/src/api/routes/studyGroups.js
	modified:   apps/backend/src/api/routes/testCategories.js
	modified:   apps/backend/src/app-port5001.js
	modified:   apps/backend/src/data/models/search/QuestionSearchIndex.js
	modified:   apps/backend/src/infrastructure/database/postgres-helpers.js
	modified:   apps/backend/src/middleware/admin-permission.middleware.js
	modified:   apps/backend/src/modules/attempts/attempt.routes.js
	modified:   apps/backend/src/modules/attempts/attempt.service.js
	modified:   apps/backend/src/modules/questions/questionDifficulty.service.js
	modified:   apps/backend/src/modules/search/vectorSearch.service.js
	modified:   apps/backend/src/services/SubscriptionService.js
	modified:   apps/backend/src/services/core/analyticsService.js
	modified:   apps/backend/src/services/core/leaderboardService.js
	modified:   apps/backend/src/services/core/notificationService.js
	modified:   apps/backend/src/services/import/fullTestImporter.js
	modified:   apps/backend/src/shared/utils/scoreAttempt.js
	modified:   apps/frontend/index.html
	modified:   apps/frontend/src/__tests__/language.test.jsx
	modified:   apps/frontend/src/pages/dashboard/AIStudyPlanner.jsx
	modified:   apps/frontend/src/pages/dashboard/Achievements.jsx
	modified:   apps/frontend/src/pages/dashboard/Analysis.jsx
	modified:   apps/frontend/src/pages/dashboard/AttemptedTests.jsx
	modified:   apps/frontend/src/pages/dashboard/Bookmarks.jsx
	modified:   apps/frontend/src/pages/dashboard/Notifications.jsx
	modified:   apps/frontend/src/pages/dashboard/PerformanceInsights.jsx
	modified:   apps/frontend/src/pages/dashboard/Settings.jsx
	modified:   apps/frontend/src/pages/dashboard/SettingsContent.jsx
	modified:   apps/frontend/src/pages/dashboard/components/QuestionDetailModal.jsx
	modified:   apps/frontend/src/pages/dashboard/profile/ProfilePersonalTab.jsx
	modified:   apps/frontend/src/pages/dashboard/profile/ProfileSecurityTab.jsx
	modified:   apps/frontend/src/pages/exams/ExamInfoNew.jsx
	modified:   apps/frontend/src/pages/public/Privacy.jsx
	modified:   apps/frontend/src/pages/study/StudyMaterialChapter.jsx
	modified:   apps/frontend/src/pages/tests/Leaderboard.jsx
	modified:   apps/frontend/src/pages/tests/LiveTestInterface.jsx
	modified:   apps/frontend/src/pages/tests/PracticeLab.jsx
	modified:   apps/frontend/src/pages/tests/TestDetails.jsx
	modified:   apps/frontend/src/pages/tests/TestInterface.jsx
	modified:   apps/frontend/src/pages/tests/TestResult.jsx
	modified:   apps/frontend/src/pages/tests/TestSeries.jsx
	modified:   apps/frontend/src/pages/tests/components/FundamentalsGym.jsx
	modified:   apps/frontend/src/pages/tests/components/PracticeSessionCanvas.jsx
	modified:   apps/frontend/src/pages/tests/components/PracticeWorkspace.jsx
	modified:   apps/frontend/src/shared/lib/apiBase.js
	modified:   apps/frontend/src/shared/lib/htmlSanitizer.js
	modified:   apps/frontend/vite.config.js
	modified:   docs/REPO_BRAIN.html

Untracked files:
	apps/backend/src/__tests__/adaptiveDiagnostic.test.js
	apps/backend/src/__tests__/admin-permission.middleware.test.js
	apps/backend/src/__tests__/adminTestLifecycle.test.js
	apps/backend/src/__tests__/aiClient.test.js
	apps/backend/src/__tests__/aiMentor.service.test.js
	apps/backend/src/__tests__/attemptService.test.js
	apps/backend/src/__tests__/couponEngine.test.js
	apps/backend/src/__tests__/discussions.test.js
	apps/backend/src/__tests__/enrollmentService.test.js
	apps/backend/src/__tests__/gamificationService.test.js
	apps/backend/src/__tests__/lockout.middleware.test.js
	apps/backend/src/__tests__/maintenance.service.test.js
	apps/backend/src/__tests__/mockTestEngineSimulation.e2e.test.js
	apps/backend/src/__tests__/multiExamEngineSimulation.e2e.test.js
	apps/backend/src/__tests__/nodeEngineService.test.js
	apps/backend/src/__tests__/notificationService.test.js
	apps/backend/src/__tests__/performanceInsights.test.js
	apps/backend/src/__tests__/proctoringService.test.js
	apps/backend/src/__tests__/pushNotificationDispatcher.test.js
	apps/backend/src/__tests__/questionDifficultyCalibration.test.js
	apps/backend/src/__tests__/questionImportLinter.test.js
	apps/backend/src/__tests__/questionImportValidation.test.js
	apps/backend/src/__tests__/smartRevision.service.test.js
	apps/backend/src/__tests__/solutionExplainer.test.js
	apps/backend/src/__tests__/studyGroups.test.js
	apps/backend/src/__tests__/studyMatchmaker.test.js
	apps/backend/src/__tests__/subscriptionExpiryDowngrade.test.js
	apps/backend/src/__tests__/subscriptionService.test.js
	apps/backend/src/__tests__/testTimerSync.test.js
	apps/backend/src/__tests__/vectorSearch.service.test.js
	apps/backend/src/api/routes/admin-live-tests.js
	apps/backend/src/api/routes/faqs-public.js
	apps/backend/src/infrastructure/database/migrations/134_database_audit_remediation.sql
	apps/backend/src/infrastructure/database/migrations/135_test_lifecycle_and_shuffle_seed.sql
	apps/backend/src/services/core/adaptiveDiagnosticService.js
	apps/backend/src/services/core/gamificationService.js
	apps/backend/src/services/core/proctoringService.js
	apps/backend/src/services/core/solutionExplainerService.js
	apps/backend/src/services/core/studyMatchmakerService.js
	apps/backend/src/services/import/questionImportLinter.js
	apps/frontend/src/__tests__/IndexedDBAttemptVault.test.js
	apps/frontend/src/__tests__/PracticeSessionCanvas.test.jsx
	apps/frontend/src/__tests__/TelemetryService.test.js
	apps/frontend/src/__tests__/TestPaperPdfExport.test.jsx
	apps/frontend/src/__tests__/useAudioExplainer.test.js
	apps/frontend/src/pages/dashboard/components/InsightsTab.jsx
	apps/frontend/src/pages/dashboard/components/ScoreSparkline.jsx
	apps/frontend/src/pages/tests/components/LeaderboardCharts.jsx
	apps/frontend/src/pages/tests/components/QuestionViewer.jsx
	apps/frontend/src/pages/tests/components/SectionTabs.jsx
	apps/frontend/src/pages/tests/components/TestBottomBar.jsx
	apps/frontend/src/pages/tests/components/TestDetailsSidebar.jsx
	apps/frontend/src/pages/tests/components/TestSolutionsList.jsx
	apps/frontend/src/pages/tests/components/TestTimerHeader.jsx
	apps/frontend/src/shared/hooks/useAudioExplainer.js
```

---

## 📱 Comprehensive Responsive UI, Layout & Full-Text Accessibility Audit

An exhaustive multi-viewport responsive and text accessibility audit was conducted across all pages, tabs, UI components, sections, and managers in both `apps/frontend` and `apps/admin-panel`.

### 1. Key Layout & Text Truncation Remediations

| Workspace    | Component / Page                                                                                                                                                                                            | Issue Remedied                                                                                                                  | Verification                                                                                       |
| :----------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------- |
| **Frontend** | `TestInstructions.jsx`                                                                                                                                                                                      | Mobile agreement checkbox text and test title badge truncated on small screens ($< 360\text{px}$) without tooltip.              | Added bilingual `title` tooltip to agreement text and test title badge.                            |
| **Frontend** | `StudyMaterialDetail.jsx`                                                                                                                                                                                   | Tab labels in horizontal tab bar truncated on narrow viewports.                                                                 | Added `title={tab.label}` to tab spans; tab bar confirmed to use `overflow-x-auto scrollbar-hide`. |
| **Frontend** | `TestCategoryFilter.jsx`                                                                                                                                                                                    | Category names in nested hierarchy truncated on mobile.                                                                         | Added `title={cat.name}` to category badge spans.                                                  |
| **Frontend** | `RecentActivity.jsx`                                                                                                                                                                                        | Activity action heading and test detail truncated on narrow cards.                                                              | Added `title={item.action}` and `title={item.detail}` attributes.                                  |
| **Frontend** | `ProfileHeader.jsx`                                                                                                                                                                                         | User email and location tag truncated on small mobile screens.                                                                  | Added `title={user.email}` and `title={personalInfo.location}` tooltips.                           |
| **Frontend** | `Dashboard.jsx`                                                                                                                                                                                             | Live mock test title and availability date text clamped.                                                                        | Added `title={test.title}` and `title={test.timePeriod}` tooltips.                                 |
| **Frontend** | `Login.jsx`                                                                                                                                                                                                 | Active session location string truncated without hover/tap readout.                                                             | Added `title={locationStr}` tooltip.                                                               |
| **Frontend** | `Videos.jsx`                                                                                                                                                                                                | Instructor name, lecture subject, and topic title clamped.                                                                      | Added `title` attributes to instructor badges, lecture subjects, and video titles.                 |
| **Frontend** | `PassageGroup.jsx`                                                                                                                                                                                          | Passage title and collapsed preview truncated.                                                                                  | Added `title={group.title}` and `title={group.passage}`.                                           |
| **Frontend** | `HomeSections.jsx`                                                                                                                                                                                          | Hero live mock test titles and availability clamped.                                                                            | Added `title={test.title}` and dynamic availability date tooltips.                                 |
| **Frontend** | `TestSeries.jsx`                                                                                                                                                                                            | Series headings, categories, and recent attempt links truncated.                                                                | Added accessible `title` tooltips to card headers and attempt links.                               |
| **Frontend** | `TestReview.jsx`                                                                                                                                                                                            | Test solution header title and topic tags truncated.                                                                            | Added `title={testData.testTitle}` and `title={currentQuestion.topic}`.                            |
| **Frontend** | `TestResult.jsx`                                                                                                                                                                                            | Scorecard KPIs ("Correct", "Wrong", "Accuracy", "Time Taken"), section tabs, and fastest/slowest section indicators truncated.  | Added `title` attributes across KPI cards, section navigation tabs, and fastest/slowest badges.    |
| **Frontend** | `Navbar.jsx` & `BottomNav.jsx`                                                                                                                                                                              | Navigation item labels and category dropdown titles truncated.                                                                  | Added `title={label}` tooltips across desktop dropdowns and mobile bottom nav.                     |
| **Frontend** | `NavbarSearch.jsx` & `NavbarNotifications.jsx`                                                                                                                                                              | Search result titles and notification messages truncated.                                                                       | Added `title` attributes to search result list and notification descriptions.                      |
| **Frontend** | `PDFViewer.jsx` & `VideoPlayer.jsx`                                                                                                                                                                         | Document title and description text clamped.                                                                                    | Added `title` attributes to headers and subtext.                                                   |
| **Frontend** | `QuestionDiscussions.jsx`                                                                                                                                                                                   | Commenter user names truncated on mobile.                                                                                       | Added `title={userName}` tooltip.                                                                  |
| **Frontend** | `MaintenanceMode.jsx`                                                                                                                                                                                       | Sticky warning banner text truncated on mobile.                                                                                 | Added `title` tooltip with the full maintenance notice.                                            |
| **Frontend** | `CompactStatsCards.jsx`                                                                                                                                                                                     | Stat card labels truncated on mobile.                                                                                           | Added `title={card.label}`.                                                                        |
| **Frontend** | `ExamReadinessGauge.jsx`                                                                                                                                                                                    | High-ROI topic recommendation titles clamped.                                                                                   | Added `title={rec.topic}`.                                                                         |
| **Frontend** | `SocraticHintModal.jsx`                                                                                                                                                                                     | Header title and question description truncated.                                                                                | Added accessible `title` attributes.                                                               |
| **Frontend** | `Leaderboard.jsx`                                                                                                                                                                                           | Horizontal tabs lacked `no-scrollbar`; usernames in top ranking and table clamped.                                              | Added `no-scrollbar` to tab scroll container and `title` tooltips to all candidate names.          |
| **Frontend** | `PracticeWorkspace.jsx`, `PracticeTopicTree.jsx`, `FundamentalsGym.jsx`, `SpacedRepetition.jsx`                                                                                                             | Topic names and exercise titles clamped on small viewports.                                                                     | Added `title` attributes and responsive max-width bounds.                                          |
| **Frontend** | `AttemptedTests.jsx`, `Bookmarks.jsx`, `ExamInfoNew.jsx`                                                                                                                                                    | Attempt titles, bookmark question snippets, and conducting body badges truncated.                                               | Added `title` tooltips across all cards and table rows.                                            |
| **Admin**    | Core UI (`AdminPageHeader`, `StatCard`, `Card`, `AdminLayout`, `AdminBottomNav`, `FormModal`, `CompactStatsCards`, `CommandPalette`)                                                                        | Headers, stat labels, card titles, navigation items, modal titles, and search result titles truncated without tooltips.         | Added accessible `title` tooltips across all core admin components.                                |
| **Admin**    | Assessments & Questions (`LiveProctoringConsole`, `QuestionRow`, `TestFormModal`, `TestsManager`, `TestSeriesManager`, `SectionsManager`, `QuizzesManager`, `QuestionsManager`, `PracticeQuestionsManager`) | Test titles, question texts, candidate emails, section names, and topic tags truncated.                                         | Added accessible `title` tooltips across cards, tables, and modal dialogs.                         |
| **Admin**    | Users & Materials (`UsersManager`, `UserActivityLog`, `EnrollmentsManager`, `StudyMaterialsManager`, `CurriculumBuilder`, `CategoriesManager`, `StagesManager`, `ExamInfoManager`, `TagConfigsManager`)     | User emails, enrollment details, subject slugs, category descriptions, stage names, tag labels, and exam info titles truncated. | Added accessible `title` tooltips across all management views.                                     |

---

### 2. Monorepo Test Verification

- Ran full monorepo test suite: `pnpm -r test`
- **Result:** **All test suites passed (Exit Code 0)** with zero regressions.
- **Git State:** Strictly maintained in the working tree with **0 git commits**.
