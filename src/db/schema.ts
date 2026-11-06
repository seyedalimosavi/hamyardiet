import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// SQLite port of the original PostgreSQL schema (see CHANGES-SQLITE-PORT.md).
// Mapping used across every table:
//   serial          -> integer primary key autoincrement
//   doublePrecision -> real
//   boolean         -> integer with { mode: "boolean" } (stored as 0/1)
//   jsonb           -> text with { mode: "json" } (stored as JSON strings, parsed on read)
//   timestamp       -> integer with { mode: "timestamp_ms" } (unix milliseconds, Date in JS)
// Field names, defaults and the shapes returned to the application are unchanged.

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull().unique(),
  username: text("username"),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("USER"), // 'USER' | 'CONSULTANT' | 'ADMIN'
  specialtyTitle: text("specialty_title"),
  medicalCouncilCode: text("medical_council_code"),
  planSlug: text("plan_slug").notNull().default("vip_premium"),
  questionsQuota: integer("questions_quota").notNull().default(5),
  questionsUsed: integer("questions_used").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const clinicalProfiles = sqliteTable("clinical_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().unique(),
  gender: text("gender").notNull().default("female"),
  age: integer("age").notNull().default(35),
  heightCm: real("height_cm").notNull().default(165),
  weightKg: real("weight_kg").notNull().default(75),
  targetWeightKg: real("target_weight_kg").default(63),
  waistCm: real("waist_cm"),
  neckCm: real("neck_cm"),
  hipCm: real("hip_cm"),
  activityFactor: real("activity_factor").notNull().default(1.375),
  goal: text("goal").notNull().default("loss"),
  dietPref: text("diet_pref").notNull().default("balanced"),
  isAthlete: integer("is_athlete", { mode: "boolean" }).notNull().default(false),
  sportCategory: text("sport_category"),
  sportPhase: text("sport_phase"),
  trainingDaysPerWeek: integer("training_days_per_week").default(4),
  sessionDurationMin: integer("session_duration_min").default(60),
  trainingTimeSlot: text("training_time_slot").default("عصر"),
  supplementsListJson: text("supplements_list_json", { mode: "json" })
    .$type<unknown[]>()
    .default(sql`'[]'`),
  bodyFatPct: real("body_fat_pct"),
  useVerifiedBodyFat: integer("use_verified_body_fat", { mode: "boolean" })
    .notNull()
    .default(false),
  bodyFatMethod: text("body_fat_method"),
  isDialysis: integer("is_dialysis", { mode: "boolean" }).notNull().default(false),
  hasEatingDisorderHistory: integer("has_eating_disorder_history", { mode: "boolean" })
    .notNull()
    .default(false),
  usesInsulinOrSulfonylurea: integer("uses_insulin_or_sulfonylurea", { mode: "boolean" })
    .notNull()
    .default(false),
  pregnancyTrimester: integer("pregnancy_trimester"),
  conditionsJson: text("conditions_json", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`),
  restrictionsJson: text("restrictions_json", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`),
  allergiesJson: text("allergies_json", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`),
  dislikedFoodsJson: text("disliked_foods_json", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`),
  medicationsText: text("medications_text").default(""),
  mealSlotsOkJson: text("meal_slots_ok_json", { mode: "json" }).$type<unknown>(),
  mealSlotsPctJson: text("meal_slots_pct_json", { mode: "json" }).$type<unknown>(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userRegimens = sqliteTable("user_regimens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackingCode: text("tracking_code").notNull(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userPhone: text("user_phone").notNull(),
  status: text("status").notNull().default("FINAL_ACTIVE"), // 'FINAL_ACTIVE' | 'PROFESSIONAL_REVIEW_REQUIRED'
  profileSnapshotJson: text("profile_snapshot_json", { mode: "json" })
    .$type<unknown>()
    .notNull(),
  calculatedMetricsJson: text("calculated_metrics_json", { mode: "json" })
    .$type<unknown>()
    .notNull(),
  day1SlotsJson: text("day1_slots_json", { mode: "json" }).$type<unknown>().notNull(),
  day2ShockJson: text("day2_shock_json", { mode: "json" }).$type<unknown>(),
  athleteRestDayJson: text("athlete_rest_day_json", { mode: "json" }).$type<unknown>(),
  treatAllowanceJson: text("treat_allowance_json", { mode: "json" }).$type<unknown>(),
  weeklyScheduleJson: text("weekly_schedule_json", { mode: "json" }).$type<unknown>(),
  rejectedMealCodesJson: text("rejected_meal_codes_json", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`),
  approvedMealCodesJson: text("approved_meal_codes_json", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`),
  consultantOverrideNote: text("consultant_override_note"),
  signedByConsultantName: text("signed_by_consultant_name"),
  signedByCouncilCode: text("signed_by_council_code"),
  versionNum: integer("version_num").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const consultationThreads = sqliteTable("consultation_threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userPhone: text("user_phone").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("WAITING_CONSULTANT"), // 'WAITING_CONSULTANT' | 'ANSWERED' | 'CLOSED'
  userRating: integer("user_rating"),
  lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const consultationMessages = sqliteTable("consultation_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  threadId: integer("thread_id").notNull(),
  senderId: integer("sender_id").notNull(),
  senderRole: text("sender_role").notNull(), // 'USER' | 'CONSULTANT' | 'ADMIN'
  senderName: text("sender_name").notNull(),
  bodyText: text("body_text").notNull(),
  countedAgainstQuota: integer("counted_against_quota", { mode: "boolean" })
    .notNull()
    .default(false),
  quotaRefunded: integer("quota_refunded", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const weightLogs = sqliteTable("weight_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  logDate: text("log_date").notNull(), // Jalali display date, e.g. '۱۴۰۴/۱۲/۰۱' (kept as-is for UI parity)
  weightKg: real("weight_kg").notNull(),
  waistCm: real("waist_cm"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const customMeals = sqliteTable("custom_meals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  slotType: text("slot_type").notNull(),
  name: text("name").notNull(),
  baseCalories: integer("base_calories").notNull(),
  ingredientsDesc: text("ingredients_desc").notNull(),
  cookKind: text("cook_kind").notNull().default("pot"),
  posTagsJson: text("pos_tags_json", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`),
  negTagsJson: text("neg_tags_json", { mode: "json" })
    .$type<string[]>()
    .default(sql`'[]'`),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json", { mode: "json" }).$type<unknown>().notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
