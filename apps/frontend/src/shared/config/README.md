# Shared Config — Frontend (`src/shared/config/`)

> Last verified: 2026-09-06. Frontend app (`:3000`).

Centralised configuration for the frontend: user/admin navigation, emojis,
coming-soon gating, app version. For image/asset helpers, see the decision box
below — they live in the shared package, not here.

## Import rule

**Import asset helpers from `@trstprep/shared-config`** (canonical source:
`packages/shared-config/src/index.js`). Import everything else from this
directory's `index.js` barrel. Do **not** use the `@/shared/...` alias in new
code — it is not the convention in this repo and the old examples using it have
been removed from this doc.

```javascript
// Assets — canonical shared package (works in frontend AND admin-panel)
import { getValidThumbnail, getCategoryImage } from "@trstprep/shared-config";

// Everything else — local barrel
import { getCategoryEmoji, getSubjectEmoji } from "./index.js";
import { userNavSections } from "./index.js";
import { APP_VERSION } from "./index.js";
```

## Files (8 entries — adminNavConfig.js removed 2026-09-08, zero consumers)

| File                    | Purpose                                                                                                                                               | Key exports                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~`adminNavConfig.js`~~ | **REMOVED** — dead admin nav mirror, zero imports in frontend. Admin nav owned by admin-panel only                                                    | —                                                                                                                                                     |
| `assetConfig.js`        | **DEPRECATED shim** — re-exports `@trstprep/shared-config` for backward compatibility only                                                            | Do not add code here (see decision box)                                                                                                               |
| `assets-config.js`      | **Legacy local asset module** (full implementation, predates the shared package): picsum/placeholder helpers, thumbnail sizes, category/subject seeds | `PICSUM_BASE_URL`, `ICON_LIBRARY`, `THUMBNAIL_SIZES`, `CATEGORY_SEEDS`, `SUBJECT_SEEDS`, `getPicsumUrl`, … — do not extend; migrate to shared package |
| `comingSoonConfig.js`   | Coming-soon / maintenance gating: per-page flags + site-wide maintenance mode                                                                         | `SITE_CONFIG`, `COMING_SOON_PAGES`, `isPageComingSoon(pageKey)`, `getComingSoonConfig(pageKey)`, `isSiteInMaintenance(role)`                          |
| `emojiConfig.js`        | All emoji maps + lookup helpers                                                                                                                       | See emoji section below                                                                                                                               |
| `index.js`              | Barrel re-exporting `emojiConfig` + `assetConfig` (legacy)                                                                                            | `emojiConfig`, `assetConfig` (defaults) + all named exports                                                                                           |
| `userNavConfig.js`      | Single source of truth for user-facing sidebar nav                                                                                                    | `userNavSections` (grouped sections: "Learning & Tests", …), `moreNavItems` (pages without dedicated sidebar links)                                   |
| `version.js`            | Single source of truth for UI version strings — edit here, not in components                                                                          | `APP_VERSION` (`2.1.0`), `APP_BUILD_DATE` (`2026.07.10`)                                                                                              |
| `README.md`             | This file                                                                                                                                             | —                                                                                                                                                     |

## Decision: `assets-config.js` vs `assetConfig.js`

|          | `assets-config.js`                               | `assetConfig.js`                                              |
| -------- | ------------------------------------------------ | ------------------------------------------------------------- |
| What     | Legacy full local implementation (~374 lines)    | 12-line shim re-exporting `@trstprep/shared-config`           |
| Status   | **Frozen** — do not add helpers here             | **Deprecated as a location** — do not add helpers here either |
| Use when | Only to understand old imports you are migrating | Never in new code                                             |

**Decision: all new asset code goes to `@trstprep/shared-config`
(`packages/shared-config/src/index.js`), imported directly.** When touching a
file that imports from `./assets-config` or `./assetConfig`, migrate that
import to `@trstprep/shared-config` and delete the indirection. Both local
files stay until the last importer is migrated.

## Emoji maps (from `emojiConfig.js`, 2026-09-06)

Helpers: `getEmoji(key, map, fallback)`, `getCategoryEmoji`, `getSubjectEmoji`,
`getTestTypeEmoji`, `getStageEmoji`, `getAchievementEmoji`, `getNavEmoji`,
`getStatusEmoji`, `getRandomHeroEmoji`, plus `ALL_EMOJIS`. Every map has a
`'default'` fallback key.

- `CATEGORY_EMOJIS` — `SSC, Banking, Railway, Railways, UPSC, Defence, Teaching, State, Insurance, CAT, CLAT, NEET, Engineering, Other`
- `SUBJECT_EMOJIS` — `Quantitative Aptitude, Quant, Maths, Mathematics, Reasoning, Logical Reasoning, Verbal Reasoning, English, General Awareness, GK, Current Affairs, Science, History, Geography, Polity, Economics, Computer, General Science`
- `TEST_TYPE_EMOJIS` — `Mock Tests, Full Mocks, Mock Test, PYPs, PYQs, Previous Year, PRO, Pro, Live Tests, Live Test, Sectional Tests, Sectional, Grand Tests, Grand Test, Special Quizzes, Quiz, Chapter Tests, Chapter, Practice, Free, Paid`
- `STAGE_EMOJIS` — `Beginner, Intermediate, Advanced, Expert, Foundation, Complete`
- `ACHIEVEMENT_EMOJIS`, `NAVIGATION_EMOJIS`, `FEATURE_EMOJIS`, `STATUS_EMOJIS`, `HERO_EMOJIS` — same shape as the admin-panel config (see `apps/admin-panel/src/shared/config/README.md`); read `emojiConfig.js` directly for exact keys.

> Verified divergence (2026-09-06): the frontend `SUBJECT_EMOJIS` does **not**
> contain `'English Language & Comprehension'` (present in the admin-panel
> copy). If a subject label misses its emoji here, add the key to this file's
> `SUBJECT_EMOJIS` — or, better, unify the two copies behind the shared package.

## Gating: `comingSoonConfig` + `userNavConfig` + `FeatureGate`/`pageKey`

- Routes opt into gating via `createRoute(path, el, { pageKey })` (`src/App.jsx`,
  `src/app/routes.jsx`): e.g. `/videos` → `pageKey: "videos"`,
  `/current-affairs` → `"currentAffairs"`, `/community` → `"doubtForum"`,
  `/achievements` → `"achievements"`.
- `FeatureGate` (`src/shared/components/common/FeatureGate.jsx`) accepts
  `sectionKey` / `pageKey` / `featureKey`: page keys resolve through
  `comingSoonConfig` (ungated pages render `PageComingSoon`), `featureKey`
  (e.g. `analytics`) checks feature flags.
- `userNavConfig.js` drives the user sidebar. Keep nav labels and `comingSoonConfig` page keys in sync — a rename
  in one without the other breaks gating or search.

## Where do I add X?

| I want to…                                   | Edit this                                                                                         | Notes                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Add a user sidebar link                      | `userNavConfig.js` (`userNavSections`, or `moreNavItems` for link-less pages)                     | Sync with `comingSoonConfig` page keys if the page is gated |
| Gate a page behind coming-soon / maintenance | `comingSoonConfig.js` (`COMING_SOON_PAGES` / `SITE_CONFIG`) + `pageKey` on the route in `App.jsx` | —                                                           |
| Add a category / subject / status emoji      | `emojiConfig.js` map                                                                              | See divergence note above before duplicating admin keys     |
| Bump the displayed app version               | `version.js` (`APP_VERSION`, `APP_BUILD_DATE`)                                                    | Never hardcode version strings in components                |
| Add an image/thumbnail helper                | **Don't here** — use `packages/shared-config/src/index.js`                                        | Migrate old `./assets-config` imports when you touch them   |
| Change admin nav data                        | Admin panel owns it (no frontend mirror — `adminNavConfig.js` removed 2026-09-08)                 | —                                                           |
