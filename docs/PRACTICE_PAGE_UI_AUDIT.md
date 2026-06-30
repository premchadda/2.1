# Practice Page UI Audit — Trstprep V2.1

**Audited file:** `apps/frontend/src/pages/tests/PracticeQuestions.jsx` (368 lines)
**Supporting:** `AnimatedHero.jsx`, `Breadcrumb.jsx`, `Layout.jsx`, `tailwind.config.js`
**Stack:** React 18 + Vite + Tailwind v3 + react-query + lucide-react (no UI library)

---

## 1. What the page currently does well

| # | Strength | Evidence |
|---|---|---|
| 1 | Clean two-column (1:3) layout with sticky topic sidebar | `lg:grid-cols-4`, `sticky top-24` |
| 2 | Real-time feedback with color-coded options + explanation reveal | `getOptionClass`, `max-h` transition |
| 3 | HTML sanitization (XSS-safe) on question/option/explanation | `sanitizeHtml` |
| 4 | Tiered completion screen (green/amber/red) with stat grid | Lines 110–164 |
| 5 | Loading + empty ("Topic Under Construction") states handled | Lines 100–107, 337–362 |
| 6 | Subtle decorative blur + gradient progress bar | `blur-3xl`, `from-indigo-500 to-violet-600` |
| 7 | Keyboard-free but accessible hit targets (p-5 options, py-4 buttons) | Reasonable tap sizes |
| 8 | Data via react-query with staleTime caching | Lines 16–42 |

---

## 2. Issues found (severity-ranked)

### CRITICAL

**C1. No keyboard navigation / a11y**
- Options are `<button>` (good) but lack `aria-pressed`, `aria-label`, or role="radio" group. Screen readers announce them as unrelated buttons.
- No `Enter`/`1-4` shortcut to select, `Enter` to check, `→` for next. Every competitor supports this.
- `dangerouslySetInnerHTML` question has no `aria-live` — answer reveal is invisible to AT.

**C2. `dangerouslySetInnerHTML` everywhere without prose styling**
- Question/option/explanation HTML is injected raw. If backend sends `<p>`, `<ul>`, `<img>`, they render with **zero Tailwind typography** (no `prose` class). Results: unstyled lists, oversized images, broken tables.
- Compare: Khan/Magoosh wrap injected HTML in `prose prose-sm` for consistent typography.

**C3. No timer / pacing data**
- `score.skipped` is in state but **never incremented** and never shown. The progress card uses a `Clock` icon as decoration only.
- Practice platforms universally show per-question time + average time, even in untimed mode.

### HIGH

**H1. Hard-coded `window.history.back()` for "Exit Practice"**
- Line 154: `onClick={() => window.history.back()}`. If user deep-linked, this exits the app. Should `navigate('/test-series')` or `/`.

**H2. No "Previous Question" / "Skip"**
- Linear forward-only flow. Users can't revisit a question they got wrong to re-read the explanation. Every competitor (Quizlet, Magoosh, Testbook) allows back navigation in practice mode.

**H3. Category sidebar has no question counts**
- Just names. Users can't tell "All Topics = 240 questions" vs "Math = 18". Unacademy/Byju's always show counts + difficulty.

**H4. Bookmark button is a no-op**
- Line 262–264: `<button>` with Bookmark icon, **no onClick, no state**. Dead UI erodes trust.

**H5. "Discuss" button is a no-op**
- Line 330–332: no onClick. Same problem.

**H6. No persistence**
- Refreshing the page loses position + score. LocalStorage of `{category, idx, score}` is trivial and expected (Duolingo, Brilliant do this).

**H7. No question filter / difficulty / mode**
- No "Easy/Medium/Hard", no "Wrong-only", no "Bookmarked-only", no "Timed vs Untimed" toggle. This is table-stakes on Testbook/Embibe/PhysicsWallah practice labs.

### MEDIUM

**M1. AnimatedHero on every practice visit**
- Heavy animated gradient + particles on a **utility** page. Increases LCP, distracts from the actual task. Most platforms use a static slim header for practice pages.

**M2. Option grid is `md:grid-cols-2` always**
- Long option text (common in English/Reasoning) wraps awkwardly in 2 columns. Should be `grid-cols-1` for options with >120 chars. No responsiveness to content length.

**M3. `currentQ` can be undefined → crash**
- Line 45: `const currentQ = questions[currentQuestionIdx]`. If API returns questions then index advances past length on the same render cycle before the finish-state branch (line 110) fires, `currentQ.category` (line 260) throws. Guard needed.

**M4. Color contrast**
- `text-[10px] font-black text-gray-400 uppercase` on `bg-white` ≈ 3.2:1 — fails WCAG AA for small text (needs 4.5:1). Used heavily for labels.

**M5. Score state shape is inconsistent**
- `score: {correct, incorrect, skipped}` but `skipped` never used; completion screen (line 131) shows Correct/Missed/**Total** — Total is derived from `questions.length`, not from score. If a user exits early, "Total" is wrong.

**M6. No "Report Issue" / "Flag question"**
- Bad questions can't be reported. Kaplan/Manhattan/ETS all have this on practice questions.

### LOW

**L1. `font-black` overuse** — nearly every text node is `font-black` (900). Visual hierarchy flattens; nothing stands out.
**L2. `rounded-[2.5rem]`** on the question card is very large — feels like a marketing card, not a work surface. TCS-iON/Khan use 12-16px radius for content surfaces.
**L3. No favicon / doc-title update** per question ("Q3 / 20 — Practice Lab").
**L4. No share / copy-link to a specific question.**
**L5. `window.history.back()` instead of `useNavigate`** — also breaks SPA back-stack expectations.

---

## 3. Comparison with 20 practice platforms

Legend: ✅ present in Trstprep | ❌ missing | ⚠️ partial

| # | Platform | Feature Trstprep lacks / should copy | Trstprep |
|---|---|---|---|
| 1 | **Khan Academy** | Hint button + "Why?" before revealing answer; prose-styled question HTML; mastery points | ❌ |
| 2 | **Magoosh** | Per-question timer + "Avg time" benchmark; difficulty tag; video explanation fallback | ❌ |
| 3 | **Khan/Duolingo** | Streak counter + daily goal on practice page header | ❌ |
| 4 | **Duolingo** | Heart/lives system; audio for questions; celebrations on correct streak | ❌ |
| 5 | **Quizlet** | Flashcard vs Test vs Match modes; "Wrong-questions-only" re-practice | ❌ |
| 6 | **Brilliant.org** | Interactive (drag/canvas) questions, not just MCQ; course progress bar | ❌ |
| 7 | **Unacademy** | Topic sidebar with question counts + difficulty dots; filter by status | ⚠️ sidebar exists, no counts |
| 8 | **Testbook** | Question palette (answered/visited/marked) **in practice mode too**; sectional filter | ❌ |
| 9 | **PhysicsWallah** | "Solution" vs "Video Solution" tabs; bookmark that actually saves; DPP download | ❌ (bookmark dead) |
| 10 | **Adda247** | Bilingual toggle (EN/HI) on practice questions; "Add to notes" | ❌ (only in TestInterface) |
| 11 | **Byju's** | Adaptive difficulty — next question difficulty based on correctness | ❌ |
| 12 | **Embibe** | "Embibe Big Book" style: per-skill mastery %, weakness chips, smart re-attempt | ❌ |
| 13 | **Vedantu** | "Ask doubt" inline on a question; teacher response time | ❌ (Discuss is no-op) |
| 14 | **Kaplan** | "Review Later" queue; official vs Kaplan-explanation toggle | ❌ |
| 15 | **Manhattan Prep (GRE)** | Mark-for-review in practice; question-type tag (e.g., "Sentence Equivalence") | ❌ |
| 16 | **Princeton Review** | Pacing indicator ("You're 20% ahead of target time") | ❌ |
| 17 | **ETS Official (GRE)** | Calculator widget for math questions; standard-test answer sheet view | ❌ |
| 18 | **TCS-iON (exam shell)** | Tight 8-12px radius content surfaces; dense, work-first UI — opposite of Trstprep's `rounded-[2.5rem]` | ❌ |
| 19 | **Coursera (practice quizzes)** | Retry-incorrect-only; show attempted answers inline on retry; peer-comparison % | ❌ |
| 20 | **Udemy (practice tests)** | "Retake incorrect only"; explanation appears immediately under each option (not a separate panel); pause/resume | ❌ |

### Pattern: what the top 5 all do that Trstprep doesn't
1. **Per-question timer** (Khan, Magoosh, Testbook, Embibe, Kaplan)
2. **Working bookmark + bookmarked-questions re-practice** (Quizlet, PW, Unacademy, Testbook, Udemy)
3. **Difficulty tag on every question** (Magoosh, Embibe, Byju's, Testbook, Manhattan)
4. **"Practice wrong ones again" loop** (Coursera, Udemy, Quizlet, Khan, Embibe)
5. **Inline explanation under the chosen option, not a separate panel** (Udemy, Coursera, Brilliant, Quizlet)

---

## 4. Recommended redesign (priority order)

### Phase 1 — Fix what's broken (1–2 days)
1. Wire **Bookmark** → `localStorage` set of question IDs + filled icon state.
2. Wire **Discuss** → open a doubt modal or remove it.
3. Replace `window.history.back()` with `useNavigate('/test-series')`.
4. Guard `currentQ` undefined (line 45) before rendering.
5. Add `aria-pressed`, `role="radiogroup"`, `aria-live="polite"` on answer reveal.
6. Wrap injected HTML in `prose prose-sm max-w-none` (install `@tailwindcss/typography`).

### Phase 2 — Match industry basics (3–5 days)
7. Add **per-question timer** + "Avg: 42s" benchmark (PracticeQuestions.jsx).
8. Add **Prev / Skip** buttons alongside Check/Next.
9. Show **question counts + difficulty** per category in the sidebar.
10. Add **difficulty pill** (Easy/Medium/Hard) on each question.
11. Add **mode toggle**: Untimed / Timed / Flashcard / Wrong-only.
12. Persist `{category, idx, score, bookmarks, wrongIds[]}` to `localStorage`.

### Phase 3 — Differentiators (1–2 weeks)
13. **"Re-practice wrong questions"** end-of-session CTA — pull from `wrongIds[]`.
14. **Inline explanation** option (toggle: inline vs panel).
15. **Streak / daily-goal** chip in header.
16. **Report question** (flag) → POST `/api/practice/:id/report`.
17. **Adaptive next-question** based on last-3 correctness.
18. **Bilingual EN/HI** toggle (reuse `TestInterface.jsx` i18n pattern).
19. **Keyboard shortcuts**: 1–4 select, Enter = Check/Next, ← = Prev, B = bookmark.
20. **Slim, static header** instead of `AnimatedHero` on the practice work surface.

### Quick visual tweaks (do today)
- Reduce card radius `rounded-[2.5rem]` → `rounded-2xl` (16px) for the question card.
- Drop `font-black` on body text; reserve it for numbers + CTAs only.
- Fix `text-gray-400` small-text contrast → `text-gray-500` minimum.
- Constrain option grid to `grid-cols-1` when any option > 120 chars.

---

## 5. Scorecard

| Dimension | Score | Notes |
|---|---|---|
| Visual polish | 7/10 | Pretty but over-rounded; marketing-flavored |
| Functionality | 4/10 | Two dead buttons, no prev/skip, no persistence |
| Accessibility | 2/10 | No ARIA, no keyboard, contrast failures |
| Content rendering | 3/10 | Raw HTML, no prose styling, images unstyled |
| Industry parity | 3/10 | Missing 18 of 20 common practice features |
| Robustness | 5/10 | Undefined-`currentQ` risk; otherwise OK |
| **Overall** | **4/10** | Strong start, below median vs competitors |

The page is a good **demo** but not yet a **product**. Phase 1 alone would lift it from 4→6/10; Phases 1–2 to 8/10.