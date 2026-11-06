import { sqlite, db } from "./index";
import {
  users,
  clinicalProfiles,
  userRegimens,
  consultationThreads,
  consultationMessages,
  weightLogs,
  customMeals,
  systemSettings,
} from "./schema";
import { eq, desc } from "drizzle-orm";
import { generateRegimenPipeline } from "../../server/engine/pipeline.js";

let initialized = false;
let initializationPromise: Promise<void> | null = null;
export async function ensureDbInitialized() {
  if (initialized) return;
  if (!initializationPromise) initializationPromise = initializeDatabase().catch(err => { initializationPromise = null; throw err; });
  return initializationPromise;
}
async function initializeDatabase() {
  if (initialized) return;
  {
    sqlite.exec(`
      -- SQLite port: timestamps are unix milliseconds (INTEGER), booleans 0/1,
      -- JSON columns are TEXT holding JSON strings. Defaults mirror the pg schema.
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL UNIQUE,
        username TEXT,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','CONSULTANT','ADMIN')),
        specialty_title TEXT,
        medical_council_code TEXT,
        plan_slug TEXT NOT NULL DEFAULT 'vip_premium',
        questions_quota INTEGER NOT NULL DEFAULT 5,
        questions_used INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_login_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clinical_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        gender TEXT NOT NULL DEFAULT 'female',
        age INTEGER NOT NULL DEFAULT 35,
        height_cm REAL NOT NULL DEFAULT 165,
        weight_kg REAL NOT NULL DEFAULT 75,
        target_weight_kg REAL DEFAULT 63,
        waist_cm REAL,
        neck_cm REAL,
        hip_cm REAL,
        activity_factor REAL NOT NULL DEFAULT 1.375,
        goal TEXT NOT NULL DEFAULT 'loss',
        diet_pref TEXT NOT NULL DEFAULT 'balanced',
        is_athlete INTEGER NOT NULL DEFAULT 0,
        sport_category TEXT,
        sport_phase TEXT,
        training_days_per_week INTEGER DEFAULT 4,
        session_duration_min INTEGER DEFAULT 60,
        training_time_slot TEXT DEFAULT 'عصر',
        supplements_list_json TEXT DEFAULT '[]',
        body_fat_pct REAL,
        use_verified_body_fat INTEGER NOT NULL DEFAULT 0,
        body_fat_method TEXT,
        is_dialysis INTEGER NOT NULL DEFAULT 0,
        has_eating_disorder_history INTEGER NOT NULL DEFAULT 0,
        uses_insulin_or_sulfonylurea INTEGER NOT NULL DEFAULT 0,
        pregnancy_trimester INTEGER,
        conditions_json TEXT DEFAULT '[]',
        restrictions_json TEXT DEFAULT '[]',
        allergies_json TEXT DEFAULT '[]',
        disliked_foods_json TEXT DEFAULT '[]',
        medications_text TEXT DEFAULT '',
        meal_slots_ok_json TEXT,
        meal_slots_pct_json TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_regimens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_code TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        user_phone TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'FINAL_ACTIVE' CHECK (status IN ('FINAL_ACTIVE','PROFESSIONAL_REVIEW_REQUIRED')),
        profile_snapshot_json TEXT NOT NULL,
        calculated_metrics_json TEXT NOT NULL,
        day1_slots_json TEXT NOT NULL,
        day2_shock_json TEXT,
        athlete_rest_day_json TEXT,
        treat_allowance_json TEXT,
        weekly_schedule_json TEXT,
        rejected_meal_codes_json TEXT DEFAULT '[]',
        approved_meal_codes_json TEXT DEFAULT '[]',
        consultant_override_note TEXT,
        signed_by_consultant_name TEXT,
        signed_by_council_code TEXT,
        version_num INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_regimens_user ON user_regimens(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS consultation_threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        user_phone TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'WAITING_CONSULTANT' CHECK (status IN ('WAITING_CONSULTANT','ANSWERED','CLOSED')),
        user_rating INTEGER,
        last_message_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_threads_user ON consultation_threads(user_id, last_message_at DESC);

      CREATE TABLE IF NOT EXISTS consultation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        sender_role TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        body_text TEXT NOT NULL,
        counted_against_quota INTEGER NOT NULL DEFAULT 0,
        quota_refunded INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_thread ON consultation_messages(thread_id, created_at, id);

      CREATE TABLE IF NOT EXISTS weight_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        log_date TEXT NOT NULL,
        weight_kg REAL NOT NULL,
        waist_cm REAL,
        note TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_weights_user ON weight_logs(user_id, id DESC);

      CREATE TABLE IF NOT EXISTS custom_meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        slot_type TEXT NOT NULL,
        name TEXT NOT NULL,
        base_calories INTEGER NOT NULL,
        ingredients_desc TEXT NOT NULL,
        cook_kind TEXT NOT NULL DEFAULT 'pot',
        pos_tags_json TEXT DEFAULT '[]',
        neg_tags_json TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Check if staff & demo data already exist
    const existingUsers = await db.select().from(users);
    if (existingUsers.length === 0) {
      // 1. Seed Admin & Consultant
      await db.insert(users).values([
        {
          phone: "09120000001",
          username: "admin",
          fullName: "مدیر کل کلینیک (پنل مدیریت)",
          role: "ADMIN",
          specialtyTitle: "مدیریت سامانه نوتری‌کلینیک",
          medicalCouncilCode: "ADM-100",
          planSlug: "vip_premium",
          questionsQuota: 99,
          questionsUsed: 0,
        },
        {
          phone: "09120000002",
          username: "consultant",
          fullName: "محمدرضا فرحانی (کارشناس تغذیه)",
          role: "CONSULTANT",
          specialtyTitle: "کارشناس ارشد تغذیه و رژیم‌درمانی بالینی و ورزشی",
          medicalCouncilCode: "ت-۱۲۱۹۰",
          planSlug: "vip_premium",
          questionsQuota: 99,
          questionsUsed: 0,
        },
      ]);

      // 2. Seed 3 Realistic Demo Patients with Profiles, Regimens & Chats
      const demoPatients = [
        {
          phone: "09120000003",
          fullName: "سارا محمدی (مراجع کبد چرب و کاهش وزن)",
          profile: {
            gender: "female",
            age: 41,
            height_cm: 163,
            weight_kg: 78,
            target_weight_kg: 64,
            waist_cm: 92,
            activity_factor: 1.2,
            goal: "loss",
            diet_pref: "mediterranean",
            is_athlete: false,
            is_dialysis: false,
            conditions: ["fatty_liver", "hypothyroid"],
            allergies: [],
            restrictions: [],
            disliked_foods: ["کله پاچه"],
            medications_text: "لووتیروکسین صبح ناشتا نصف قرص",
          },
          chatSubject: "سوال درباره مصرف خرما با چای و زمان قرص تیروئید",
          chatMsg:
            "سلام آقای فرحانی وقتتون بخیر، من برنامه‌ام رو دریافت کردم خیلی عالی و واضحه. فقط می‌خواستم بدونم عصرها می‌تونم با چای ۱ دونه خرما بخورم؟",
          consultantReply:
            "سلام خانم محمدی عزیز، در کبد چرب به دلیل جذب سریع قند خرما در حالت میان‌وعده، بهتر است خرما را به تنهایی با چای میل نکنید و در صورت تمایل حداکثر ۱ تا ۲ عدد خرما را بلافاصله بعد از وعده ناهار میل بفرمایید تا فیبر سالاد و پروتئین غذا مانع جهش انسولین شود.",
        },
        {
          phone: "09120000004",
          fullName: "امیرعلی احمدی (ورزشکار بدنسازی — دوره کات)",
          profile: {
            gender: "male",
            age: 27,
            height_cm: 181,
            weight_kg: 86,
            target_weight_kg: 79,
            waist_cm: 81,
            neck_cm: 40,
            activity_factor: 1.725,
            goal: "loss",
            diet_pref: "high_protein",
            is_athlete: true,
            sport_category: "bodybuilding",
            sport_phase: "cut_definition",
            training_days_per_week: 5,
            session_duration_min: 75,
            training_time_slot: "عصر",
            body_fat_pct: 12.5,
            use_verified_body_fat: true,
            body_fat_method: "navy_caliper",
            is_dialysis: false,
            conditions: [],
            allergies: [],
            restrictions: [],
            disliked_foods: [],
            medications_text: "پروتئین وی ایزوله، کراتین مونوهیدرات ۵ گرم",
          },
          chatSubject: "تنظیم وعده قبل تمرین و روزهای غیرتمرینی در دوره کات",
          chatMsg:
            "سلام استاد، درصد چربیم با کالیپر ۱۲.۵ درصد درومد و برنامه روز تمرین و استراحتم ساخته شد. آیا در روزهای غیرتمرینی هم ۵ گرم کراتین رو ادامه بدم؟",
          consultantReply: null,
        },
        {
          phone: "09120000005",
          fullName: "عبدالمجید ذاکری (پرونده ویژه همودیالیز)",
          profile: {
            gender: "male",
            age: 56,
            height_cm: 172,
            weight_kg: 74,
            target_weight_kg: 72,
            waist_cm: 94,
            activity_factor: 1.2,
            goal: "maintain",
            diet_pref: "balanced",
            is_athlete: false,
            is_dialysis: true,
            conditions: ["kidney", "hypertension"],
            allergies: [],
            restrictions: [],
            disliked_foods: [],
            medications_text: "جلسات دیالیز شنبه، دوشنبه و چهارشنبه — قرص فسفربایندر همراه غذا",
          },
          chatSubject: "مصرف سفیده تخم‌مرغ در روزهای دیالیز",
          chatMsg:
            "سلام وقت بخیر، برای پدرم که دیالیز میشن برنامه رو گرفتیم. خیار پوست‌کنده و حذف رب گوجه رو کامل رعایت می‌کنیم. سفیده تخم‌مرغ رو هر روز بدن؟",
          consultantReply:
            "سلام و درود، بله دقیقاً؛ به دلیل دفع آمینواسیدها در دستگاه همودیالیز، سفیده تخم‌مرغ بهترین پروتئین با حداقل فسفر است و طبق برگه رژیم روزانه میل شود.",
        },
      ];

      for (const dp of demoPatients) {
        const [insertedUser] = await db
          .insert(users)
          .values({
            phone: dp.phone,
            username: dp.phone,
            fullName: dp.fullName,
            role: "USER",
            planSlug: "vip_premium",
            questionsQuota: 5,
            questionsUsed: 1,
          })
          .returning();

        await db.insert(clinicalProfiles).values({
          userId: insertedUser.id,
          gender: dp.profile.gender,
          age: dp.profile.age,
          heightCm: dp.profile.height_cm,
          weightKg: dp.profile.weight_kg,
          targetWeightKg: dp.profile.target_weight_kg,
          waistCm: dp.profile.waist_cm,
          neckCm: dp.profile.neck_cm || null,
          activityFactor: dp.profile.activity_factor,
          goal: dp.profile.goal,
          dietPref: dp.profile.diet_pref,
          isAthlete: dp.profile.is_athlete,
          sportCategory: dp.profile.sport_category || null,
          sportPhase: dp.profile.sport_phase || null,
          trainingDaysPerWeek: dp.profile.training_days_per_week || 4,
          sessionDurationMin: dp.profile.session_duration_min || 60,
          trainingTimeSlot: dp.profile.training_time_slot || "عصر",
          bodyFatPct: dp.profile.body_fat_pct || null,
          useVerifiedBodyFat: dp.profile.use_verified_body_fat || false,
          bodyFatMethod: dp.profile.body_fat_method || null,
          isDialysis: dp.profile.is_dialysis || false,
          conditionsJson: dp.profile.conditions,
          allergiesJson: dp.profile.allergies,
          restrictionsJson: dp.profile.restrictions,
          dislikedFoodsJson: dp.profile.disliked_foods,
          medicationsText: dp.profile.medications_text,
        });

        const generated = generateRegimenPipeline(dp.profile, 3);

        await db.insert(userRegimens).values({
          trackingCode: generated.tracking_code,
          userId: insertedUser.id,
          userName: insertedUser.fullName,
          userPhone: insertedUser.phone,
          status: generated.status,
          profileSnapshotJson: dp.profile,
          calculatedMetricsJson: generated.calculated_metrics,
          day1SlotsJson: generated.day1_slots,
          day2ShockJson: generated.day2_shock,
          athleteRestDayJson: generated.athlete_rest_day,
          treatAllowanceJson: generated.treat_allowance,
          weeklyScheduleJson: generated.weekly_schedule,
          rejectedMealCodesJson: generated.rejected_meal_codes,
          approvedMealCodesJson: [],
          consultantOverrideNote:
            dp.phone === "09120000003"
              ? "برنامه شما توسط کارشناس تغذیه بازبینی و تایید شد. لطفاً قانون ترتیب مصرف در وعده ناهار و شام را جدی بگیرید."
              : null,
          signedByConsultantName: dp.phone === "09120000003" ? "محمدرضا فرحانی" : null,
          signedByCouncilCode: dp.phone === "09120000003" ? "ت-۱۲۱۹۰" : null,
        });

        const [thread] = await db
          .insert(consultationThreads)
          .values({
            userId: insertedUser.id,
            userName: insertedUser.fullName,
            userPhone: insertedUser.phone,
            subject: dp.chatSubject,
            status: dp.consultantReply ? "ANSWERED" : "WAITING_CONSULTANT",
          })
          .returning();

        await db.insert(consultationMessages).values({
          threadId: thread.id,
          senderId: insertedUser.id,
          senderRole: "USER",
          senderName: insertedUser.fullName,
          bodyText: dp.chatMsg,
          countedAgainstQuota: true,
        });

        if (dp.consultantReply) {
          await db.insert(consultationMessages).values({
            threadId: thread.id,
            senderId: 2,
            senderRole: "CONSULTANT",
            senderName: "محمدرضا فرحانی (کارشناس تغذیه)",
            bodyText: dp.consultantReply,
            countedAgainstQuota: false,
          });
        }

        // Seed weight logs for demo patient
        await db.insert(weightLogs).values([
          {
            userId: insertedUser.id,
            logDate: "۱۴۰۴/۱۲/۰۱",
            weightKg: dp.profile.weight_kg + 1.8,
            waistCm: (dp.profile.waist_cm || 85) + 2,
            note: "شروع دوره اول",
          },
          {
            userId: insertedUser.id,
            logDate: "۱۴۰۴/۱۲/۱۵",
            weightKg: dp.profile.weight_kg + 0.9,
            waistCm: (dp.profile.waist_cm || 85) + 1,
            note: "پایان هفته دوم",
          },
          {
            userId: insertedUser.id,
            logDate: "۱۴۰۵/۰۱/۰۵",
            weightKg: dp.profile.weight_kg,
            waistCm: dp.profile.waist_cm || 85,
            note: "وزن فعلی",
          },
        ]);
      }
    }

    initialized = true;
  }
}

export {
  users,
  clinicalProfiles,
  userRegimens,
  consultationThreads,
  consultationMessages,
  weightLogs,
  customMeals,
  systemSettings,
  eq,
  desc,
};
