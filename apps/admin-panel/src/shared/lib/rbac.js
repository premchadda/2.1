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
  dashboard: "dashboard",
  "": "dashboard",
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
  blogs: "content",
  blog: "content",
  // Practice + live assessment segments.
  // Backend canonical RBAC vocab has NO "live"/"proctoring" resource — all
  // live operations are enforced as "tests" server-side. These segments map
  // to "tests" here so UI gating matches backend enforcement (least-privilege
  // splits for live rooms, if needed, must be done with tests:* scoping or
  // backend vocab extension, not phantom resources).
  "practice-questions": "tests",
  "live-monitor": "tests",
  live: "tests",
  "live-tests": "tests",
  "live-proctoring": "tests",
  proctoring: "tests",
};

export function getResourceFromSegment(segment = "content") {
  const seg = String(segment).trim().toLowerCase();
  return SEGMENT_TO_RESOURCE[seg] ?? null;
}

export function getResourceFromPath(pathname = "/") {
  const segments = String(pathname).split("/").filter(Boolean);
  if (segments.length <= 1) return "dashboard";
  return getResourceFromSegment(segments[1]);
}

export function hasPermission(userPerms = [], requiredPerm, isSuper = false) {
  if (isSuper) return true;
  const [resource, action] = String(requiredPerm).split(":");
  if (resource === "dashboard") return true;
  if (userPerms.includes("*") || userPerms.includes(requiredPerm)) return true;
  if (!resource || !action) return false;
  // "manage" is UI-gating-only wildcard for a resource (view+create+edit+
  // delete). Backend has no "manage" action — it enforces canonical
  // view|create|edit|delete (+ read/write/update aliases, resource:*).
  if (action === "manage") {
    return (
      userPerms.includes(`${resource}:view`) ||
      userPerms.includes(`${resource}:read`) ||
      userPerms.includes(`${resource}:create`) ||
      userPerms.includes(`${resource}:edit`) ||
      userPerms.includes(`${resource}:write`) ||
      userPerms.includes(`${resource}:*`)
    );
  }
  if (
    userPerms.includes(`${resource}:manage`) ||
    userPerms.includes(`${resource}:*`)
  )
    return true;
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
