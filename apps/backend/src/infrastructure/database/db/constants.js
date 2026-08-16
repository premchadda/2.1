// Entity prefix registry for public_id generation
// CRITICAL: Each prefix must be GLOBALLY UNIQUE to prevent collisions
export const ENTITY_PREFIXES = Object.freeze({
  users: "usr_",
  tests: "tst_",
  questions: "qst_",
  attempts: "att_",
  test_series: "ser_",
  exams: "exm_",
  subjects: "subj_", // Changed from 'sub_' to avoid collision with subscriptions
  chapters: "chp_",
  topics: "tpc_",
  subtopics: "stp_",
  stages: "stg_",
  bookmarks: "bkm_",
  doubts: "dbt_",
  doubt_replies: "dbr_",
  notifications: "nfy_",
  subscriptions: "subs_", // Changed from 'sub_' to avoid collision with subjects
  study_streaks: "sts_",
  user_achievements: "uac_",
  enrollments: "enr_",
  leaderboard_entries: "lbe_",
  results: "res_",
  daily_quizzes: "dqz_",
  revision_queue: "rvq_",
  wrong_questions: "wq_",
  test_categories: "tct_",
  exam_categories: "ect_",
  videos: "vid_",
});

// Regex patterns for validating public_id format per entity type
export const PUBLIC_ID_PATTERNS = Object.freeze({
  users: /^usr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  tests: /^tst_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  questions:
    /^qst_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  attempts:
    /^att_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  test_series:
    /^ser_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  exams: /^exm_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  subjects:
    /^subj_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  chapters:
    /^chp_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  topics: /^tpc_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  subtopics:
    /^stp_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  stages: /^stg_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  bookmarks:
    /^bkm_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  doubts: /^dbt_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  doubt_replies:
    /^dbr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  notifications:
    /^nfy_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  subscriptions:
    /^subs_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  study_streaks:
    /^sts_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  user_achievements:
    /^uac_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  enrollments:
    /^enr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  leaderboard_entries:
    /^lbe_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  results:
    /^res_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  daily_quizzes:
    /^dqz_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  revision_queue:
    /^rvq_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  wrong_questions:
    /^wq_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  test_categories:
    /^tct_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  exam_categories:
    /^ect_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  videos:
    /^vid_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
});

// JSONB columns per table - arrays in these columns must be stringified for PostgreSQL
export const JSONB_COLUMNS = Object.freeze({
  tests: [
    "languages",
    "category_path_ids",
    "category_path_names",
    "show_config",
    "timing_config",
    "optional_section_config",
    "attempt_rules",
    "analysis_config",
    "access_config",
    "availability",
    "cutoff_marks",
  ],
  quizzes: ["question_ids"],
  test_series: [
    "sections",
    "languages",
    "category_path_ids",
    "category_path_names",
  ],
  attempts: [
    "questions",
    "answers",
    "question_results",
    "solutions",
    "marked_for_review",
    "section_timers",
  ],
  live_tests: [
    "questions",
    "answers",
    "question_results",
    "solutions",
    "category_path_ids",
    "category_path_names",
  ],
  pyp_papers: ["category_path_ids", "category_path_names"],
  exam_yearly_data: ["vacancy_breakup", "cutoff", "important_dates"],
  exam_info: ["exam_pattern", "important_dates", "salary_structure"],
  achievement_definitions: ["criteria"],
  activity_logs: ["metadata"],
  affiliates: ["social_links", "features", "payment"],
  app_settings: ["metadata"],
  attempt_events: ["event_data"],
  coupons: ["used_by_users"],
  daily_quiz_attempts: ["answers"],
  doubts: ["metadata"],
  exams: ["tags"],
  leaderboards: ["metadata", "rankings", "ranking_criteria"],
  leaderboard_entries: ["rankings"],
  media: ["metadata"],
  messages: ["metadata"],
  results: ["answers"],
  revision_queue: ["metadata"],
  subscription_plans: ["features"],
  topics: ["related_chapters"],
  users: ["attempted_tests", "notification_preferences", "privacy"],
  wrong_questions: ["metadata"],
});

// Timestamp columns per table - empty strings must be converted to NULL for PostgreSQL
export const TIMESTAMP_COLUMNS = Object.freeze({
  tests: ["coming_soon_date"],
  live_tests: ["start_time", "end_time", "result_time"],
  users: ["pro_expiry"],
  pro_passes: ["start_date", "end_date"],
});
