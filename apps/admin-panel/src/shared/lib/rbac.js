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
};

export function getResourceFromSegment(segment = "content") {
  const seg = String(segment).trim().toLowerCase();
  return SEGMENT_TO_RESOURCE[seg] || "content";
}

export function getResourceFromPath(pathname = "/") {
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
