# Shared Config — Admin Panel (`src/shared/config/`)

> Last verified: 2026-09-06. Admin-panel app (`:3002`).

Centralised configuration for the admin panel: navigation, emojis, question
taxonomies, exam/section presets, coming-soon gating. For image/asset helpers,
see the asset rule below — they live in the shared package, not here.

## Import rule

**Import asset helpers from `@trstprep/shared-config`** (canonical source:
`packages/shared-config/src/index.js`). Import everything else from this
directory's `index.js` barrel. Do **not** use the `@/shared/...` alias in new
code — it is not the convention in this repo and the old examples using it have
been removed from this doc.

```javascript
// Assets — canonical shared package (works in admin-panel AND frontend)
import { getValidThumbnail, getCategoryImage } from "@trstprep/shared-config";

// Everything else — local barrel
import { getCategoryEmoji, getSubjectEmoji } from "./index.js";
import { adminNavConfig, getFlatNavItems } from "./index.js";
import { DIFFICULTY_LEVELS } from "./index.js";
```

> Note: `index.js` currently re-exports the local `emojiConfig.js` /
> `assetConfig.js` modules. Prefer `@trstprep/shared-config` directly for any
> asset helper; treat the local asset re-export as legacy.

## Files (all 11 entries)

| File                    | Purpose                                                                                                              | Key exports / consumed by                                                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `adminNavConfig.js`     | Single source of truth for admin sidebar nav: `categories` + item metadata (`name`, `description`, `id`, `keywords`) | `adminNavConfig`, `getFlatNavItems`, `getNavItemByPath`, `getCategoryById`, `getBreadcrumbs` — consumed by `src/shared/components/AdminLayout.jsx` (permission filtering via `canViewItem`, search via `filterAndRank`, dropdown via `CommandPalette`) |
| `assetConfig.js`        | **DEPRECATED shim** — re-exports `@trstprep/shared-config` for backward compatibility only                           | Do not add code here. Canonical: `packages/shared-config/src/index.js` (`PICSUM_BASE_URL`, `THUMBNAIL_SIZES`, `CATEGORY_SEEDS`, `SUBJECT_SEEDS`, `getPicsumUrl`, `getCategoryImage`, `getSubjectImage`, `getValidThumbnail`, …)                        |
| `comingSoonConfig.js`   | Coming-soon / maintenance gating: per-page flags + site-wide maintenance mode, with backend-synced loaders/updaters  | `SITE_CONFIG`, `COMING_SOON_PAGES`, `isPageComingSoon(pageKey)`, `getComingSoonConfig(pageKey)`, `isSiteInMaintenance(role)`, `updatePageComingSoonStatus`, `updateMaintenanceMode`, `getAllPagesStatus`                                               |
| `difficultyConfig.js`   | Difficulty taxonomy                                                                                                  | `DIFFICULTY_LEVELS`, `DIFFICULTY_KEYS`, `getDifficultyMeta(value)`                                                                                                                                                                                     |
| `emojiConfig.js`        | All emoji maps + lookup helpers                                                                                      | See emoji section below                                                                                                                                                                                                                                |
| `examPresets.js`        | Ready-made exam blueprints (exam → sections matrix) extracted for reuse, e.g. SSC CGL Tier-I/II                      | `EXAM_PRESETS`                                                                                                                                                                                                                                         |
| `index.js`              | Barrel re-exporting `emojiConfig` + `assetConfig` (legacy, see import rule)                                          | `emojiConfig`, `assetConfig` (defaults) + all named exports                                                                                                                                                                                            |
| `questionCategories.js` | Question-category taxonomy + mapping between question-category and test-category values                              | `QUESTION_CATEGORIES`, `QUESTION_CAT_TO_TEST_CAT_MAP`, `TEST_CAT_TO_QUESTION_CAT`, `QUESTION_CATEGORY_ALIASES`, `normalizeKey`, `getQuestionCategoryId`                                                                                                |
| `questionConstants.js`  | Question form constants                                                                                              | `QUESTION_TYPES`, `STATUS_OPTIONS`                                                                                                                                                                                                                     |
| `sectionPresets.js`     | Ready-made section blueprints extracted from TestsManager (single source of truth for section shapes)                | default `SECTION_PRESETS`                                                                                                                                                                                                                              |
| `README.md`             | This file                                                                                                            | —                                                                                                                                                                                                                                                      |

## Emoji maps (regenerated from `emojiConfig.js`, 2026-09-06)

Helpers: `getEmoji(key, map, fallback)`, `getCategoryEmoji`, `getSubjectEmoji`,
`getTestTypeEmoji`, `getStageEmoji`, `getAchievementEmoji`, `getNavEmoji`,
`getStatusEmoji`, `getRandomHeroEmoji`, `getRandomEmojis(count, exclude)`,
plus `ALL_EMOJIS`. Every map has a `'default'` fallback key.

- `CATEGORY_EMOJIS` — `SSC, Banking, Railway, Railways, UPSC, Defence, Teaching, State, Insurance, CAT, CLAT, NEET, Engineering, Other`
- `SUBJECT_EMOJIS` — `Quantitative Aptitude, Quant, Maths, Mathematics, Reasoning, Logical Reasoning, Verbal Reasoning, English, English Language & Comprehension, General Awareness, GK, Current Affairs, Science, History, Geography, Polity, Economics, Computer, General Science`
- `TEST_TYPE_EMOJIS` — `Mock Tests, Full Mocks, Mock Test, PYPs, PYQs, Previous Year, PRO, Pro, Live Tests, Live Test, Sectional Tests, Sectional, Grand Tests, Grand Test, Special Quizzes, Quiz, Chapter Tests, Chapter, Practice, Free, Paid`
- `STAGE_EMOJIS` — `Beginner, Intermediate, Advanced, Expert, Foundation, Complete`
- `ACHIEVEMENT_EMOJIS` — `First Test, Top 100, Top 50, Top 10, 10 Tests, 50 Tests, 100 Tests, 5 Series, 10 Series, Pro Member, Streak 7, Streak 30, Perfect Score, Early Bird, Night Owl`
- `NAVIGATION_EMOJIS` — `Home, Dashboard, Test Series, Study Materials, Practice Tests, Exams, Results, Profile, Settings, Help, Pro Pass, Leaderboard, Achievements, Bookmarks, Notifications, Community, Videos, Current Affairs, Blog, Contact`
- `FEATURE_EMOJIS` — `Tests, Questions, Videos, Notes, PDFs, Live Classes, Doubts, Analysis, Rank, Performance, Study Plan, Reminders, Pro, Free, Download, Upload`
- `STATUS_EMOJIS` — `success, error, warning, info, pending, loading, completed, locked, unlocked, active, inactive, new, hot`
- `HERO_EMOJIS` — array of 16 decorative emoji (no keys)

## Where do I add X?

| I want to…                                   | Edit this                                                   | Notes                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Add a sidebar section / page                 | `adminNavConfig.js` (`categories` → `items`)                | `AdminLayout` picks it up automatically (permission filter + search index). Keep `id` stable — it feeds breadcrumbs + `getNavItemByPath` |
| Add search keywords for a nav item           | Same item's `keywords` array in `adminNavConfig.js`         | Searched by `filterAndRank` in `AdminLayout` + `CommandPalette`                                                                          |
| Add a category / subject / status emoji      | `emojiConfig.js` map                                        | Add the key to the right map; helpers fall back to `'default'`                                                                           |
| Add a difficulty level                       | `difficultyConfig.js` (`DIFFICULTY_LEVELS`)                 | `DIFFICULTY_KEYS` derives automatically                                                                                                  |
| Add a question type or status option         | `questionConstants.js`                                      | Form dropdowns consume these                                                                                                             |
| Add a question-category mapping              | `questionCategories.js`                                     | Keep both map directions + aliases in sync                                                                                               |
| Add an exam or section preset                | `examPresets.js` / `sectionPresets.js`                      | Exam presets are exam-level; section presets are section-level (TestsManager source)                                                     |
| Gate a page behind coming-soon / maintenance | `comingSoonConfig.js` (`COMING_SOON_PAGES` / `SITE_CONFIG`) | Or toggle via backend sync (`updatePageComingSoonStatus`)                                                                                |
| Add an image/thumbnail helper                | **Don't** — use `packages/shared-config/src/index.js`       | `assetConfig.js` here is a deprecated shim                                                                                               |
