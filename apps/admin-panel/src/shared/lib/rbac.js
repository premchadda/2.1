// Centralized RBAC helpers - single source for AdminLayout + ProtectedRoute resource mapping (fixes duplication/drift)
export const RESOURCE_ALIASES = {
  system: "settings",
  settings: "system",
  user: "users",
  users: "user",
  test: "tests",
  tests: "test",
  assessment: "tests",
};

export const SEGMENT_TO_RESOURCE = {
  users: "users",
  enrollments: "users",
  sessions: "users",
  "roles-permissions": "users",
  "user-activity-log": "users",
  "activity-log": "users",
  tests: "tests",
  "test-series": "tests",
  questions: "tests",
  quizzes: "tests",
  sections: "tests",
  // COARSE-INTENT: exam taxonomy segments (stages, exam-categories,
  // exam-info, categories, tag-configs) deliberately stay under the "tests"
  // resource. They are assessment taxonomy, not standalone products, so
  // tests:view/read grants them. Split only if taxonomy gets its own team.
  stages: "tests",
  "exam-categories": "tests",
  "exam-info": "tests",
  categories: "tests",
  "tag-configs": "tests",
  settings: "settings",
  analytics: "settings",
  backups: "settings",
  "recycle-bin": "settings",
  "system-health": "settings",
  "coming-soon": "settings",
  "two-factor": "settings",
  navigation: "settings",
  logs: "settings",
  terminal: "settings",
  payments: "monetization",
  "subscription-plans": "monetization",
  plans: "monetization",
  coupons: "monetization",
  promotions: "monetization",
  banners: "communications",
  faqs: "communications",
  "email-templates": "communications",
  notifications: "communications",
  moderation: "moderation",
  audit: "audit",
  "audit-trail": "audit",
  results: "audit",
  "deep-analytics": "analytics",
  leaderboards: "analytics",
  // Study / content hub segments (StudyMaterialsManager tabs + redirects)
  content: "content",
  "study-materials": "content",
  subjects: "content",
  "subject-relations": "content",
  "subject-hierarchy": "content",
  topics: "content",
  curriculum: "content",
  "content-management": "content",
  "current-affairs": "content",
  // Practice + live assessment segments.
  // Least-privilege split: live operations get dedicated resources ("live",
  // "proctoring") instead of inheriting broad "tests" access. Route guards
  // in App.jsx additionally require "tests:admin" for these paths, so a
  // tests:view-only user can manage questions but cannot proctor live rooms.
  "practice-questions": "tests",
  "live-monitor": "live",
  live: "live",
  "live-tests": "live",
  "live-proctoring": "proctoring",
};

export function getResourceFromSegment(segment = "content") {
  const seg = String(segment).trim().toLowerCase();
  return SEGMENT_TO_RESOURCE[seg] ?? null;
}

export function getResourceFromPath(pathname = "/") {
  // PREFIX ASSERT: admin routes are always /admin/<segment>/... so the
  // resource segment is index [1] after filtering empty parts. Non-admin
  // paths (e.g. /login) fall back to "content" and are handled by auth
  // guards, not resource checks.
  const segment = String(pathname).split("/").filter(Boolean)[1] || "content";
  return getResourceFromSegment(segment);
}

export function hasPermission(userPerms = [], requiredPerm, isSuper = false) {
  if (isSuper) return true;
  if (userPerms.includes("*") || userPerms.includes(requiredPerm)) return true;
  const [resource, action] = String(requiredPerm).split(":");
  if (!resource || !action) return false;
  const aliasActions =
    action === "view"
      ? ["read"]
      : action === "read"
        ? ["view"]
        : action === "create" || action === "edit"
          ? ["write"]
          : action === "write"
            ? ["create", "edit"]
            : [];
  if (aliasActions.some((act) => userPerms.includes(`${resource}:${act}`)))
    return true;
  if (userPerms.includes(`${resource}:*`)) return true;
  if (resource === "system" || resource === "settings") {
    const alt = resource === "system" ? "settings" : "system";
    if (
      userPerms.includes(`${alt}:${action}`) ||
      aliasActions.some((act) => userPerms.includes(`${alt}:${act}`)) ||
      userPerms.includes(`${alt}:*`)
    )
      return true;
  }
  // alias resource
  const aliasRes = RESOURCE_ALIASES[resource];
  if (
    aliasRes &&
    (userPerms.includes(`${aliasRes}:${action}`) ||
      userPerms.includes(`${aliasRes}:*`))
  )
    return true;
  return false;
}
