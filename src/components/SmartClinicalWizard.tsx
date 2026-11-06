"use client";

import React, { useState } from "react";
import {
  UserCheck,
  Dumbbell,
  HeartPulse,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Calculator,
} from "lucide-react";
import {
  ACTIVITY_LEVELS,
  GOALS,
  SPORT_CATEGORIES,
  SPORT_PHASES,
  DIET_PREFS,
  CONDITIONS,
  ALLERGIES_AND_RESTRICTIONS,
  DEFAULT_SLOTS_PCT,
  SLOT_META,
} from "../../shared/constants.js";
import { toFaDigits } from "../../shared/persian.js";
import BodyFatCalculatorSection from "./BodyFatCalculatorSection";

interface SmartWizardProps {
  initialProfile?: any;
  userFullName: string;
  onFullNameChange: (name: string) => void;
  onSubmitProfile: (profileData: any) => Promise<void>;
  submitting: boolean;
}

export default function SmartClinicalWizard({
  initialProfile,
  userFullName,
  onFullNameChange,
  onSubmitProfile,
  submitting,
}: SmartWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showBfCalcModal, setShowBfCalcModal] = useState(false);

  // Step 1: Athlete status + Basic Anthropometrics + Activity Level
  const [isAthlete, setIsAthlete] = useState<boolean>(Boolean(initialProfile?.isAthlete));
  const [gender, setGender] = useState<string>(initialProfile?.gender || "female");
  const [age, setAge] = useState<number>(initialProfile?.age || 38);
  const [heightCm, setHeightCm] = useState<number>(initialProfile?.heightCm || 165);
  const [weightKg, setWeightKg] = useState<number>(initialProfile?.weightKg || 74);
  const [targetWeightKg, setTargetWeightKg] = useState<number>(
    initialProfile?.targetWeightKg || 64
  );
  const [waistCm, setWaistCm] = useState<number>(initialProfile?.waistCm || 88);
  const [activityFactor, setActivityFactor] = useState<number>(
    initialProfile?.activityFactor || 1.375
  );

  // Step 2: Goal OR Athlete Sport & Phase + Verified Body Fat %
  const [goal, setGoal] = useState<string>(initialProfile?.goal || "loss");
  const [dietPref, setDietPref] = useState<string>(initialProfile?.dietPref || "balanced");
  const [sportCategory, setSportCategory] = useState<string>(
    initialProfile?.sportCategory || "bodybuilding"
  );
  const [sportPhase, setSportPhase] = useState<string>(
    initialProfile?.sportPhase || "cut_definition"
  );
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<number>(
    initialProfile?.trainingDaysPerWeek || 4
  );
  const [sessionDurationMin, setSessionDurationMin] = useState<number>(
    initialProfile?.sessionDurationMin || 60
  );
  const [trainingTimeSlot, setTrainingTimeSlot] = useState<string>(
    initialProfile?.trainingTimeSlot || "عصر"
  );
  const [useVerifiedBodyFat, setUseVerifiedBodyFat] = useState<boolean>(
    Boolean(initialProfile?.useVerifiedBodyFat)
  );
  const [bodyFatPct, setBodyFatPct] = useState<number>(initialProfile?.bodyFatPct || 15);
  const [bodyFatMethod, setBodyFatMethod] = useState<string>(
    initialProfile?.bodyFatMethod || "direct"
  );

  // Step 3: Medical Conditions, Dialysis sub-mode, Allergies, Disliked foods, Slots
  const [conditions, setConditions] = useState<string[]>(
    Array.isArray(initialProfile?.conditionsJson) ? initialProfile.conditionsJson : []
  );
  const [isDialysis, setIsDialysis] = useState<boolean>(Boolean(initialProfile?.isDialysis));
  const [allergies, setAllergies] = useState<string[]>(
    Array.isArray(initialProfile?.allergiesJson) ? initialProfile.allergiesJson : []
  );
  const [dislikedText, setDislikedText] = useState<string>(
    Array.isArray(initialProfile?.dislikedFoodsJson)
      ? initialProfile.dislikedFoodsJson.join("، ")
      : ""
  );
  const [medicationsText, setMedicationsText] = useState<string>(
    initialProfile?.medicationsText || ""
  );
  const [mealSlotsOk, setMealSlotsOk] = useState<Record<string, boolean>>({
    b: true,
    s1: true,
    l: true,
    s2: true,
    d: true,
    s3: true,
  });
  const [consentChecked, setConsentChecked] = useState<boolean>(true);

  const toggleCondition = (key: string) => {
    setConditions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleAllergy = (key: string) => {
    setAllergies((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectedSportCatObj =
    SPORT_CATEGORIES.find((c: any) => c.key === sportCategory) || SPORT_CATEGORIES[0];

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dislikedArray = dislikedText
      .split(/[،,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    await onSubmitProfile({
      gender,
      age: Number(age),
      height_cm: Number(heightCm),
      weight_kg: Number(weightKg),
      target_weight_kg: Math.round((heightCm / 100) ** 2 * 22 + (weightKg / ((heightCm / 100) ** 2) >= 25 ? 0.4 * (weightKg - (heightCm / 100) ** 2 * 22) : 0)),
      waist_cm: waistCm ? Number(waistCm) : null,
      activity_factor: Number(activityFactor),
      goal,
      diet_pref: dietPref,
      is_athlete: isAthlete,
      sport_category: isAthlete ? sportCategory : null,
      sport_phase: isAthlete ? sportPhase : null,
      training_days_per_week: isAthlete ? Number(trainingDaysPerWeek) : null,
      session_duration_min: isAthlete ? Number(sessionDurationMin) : null,
      training_time_slot: isAthlete ? trainingTimeSlot : null,
      use_verified_body_fat: useVerifiedBodyFat,
      body_fat_pct: useVerifiedBodyFat ? Number(bodyFatPct) : null,
      body_fat_method: useVerifiedBodyFat ? bodyFatMethod : null,
      is_dialysis: conditions.includes("kidney") ? isDialysis : false,
      conditions,
      allergies,
      restrictions: [],
      disliked_foods: dislikedArray,
      medications_text: medicationsText,
      meal_slots_ok: mealSlotsOk,
      meal_slots_pct: DEFAULT_SLOTS_PCT,
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-8 shadow-xs">
      {/* Stepper Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-2 mb-4">
          {[
            { num: 1, title: "۱. مشخصات بدنی و وضعیت ورزشی" },
            { num: 2, title: isAthlete ? "۲. رشته ورزشی، دوره و درصد چربی" : "۲. هدف وزنی و نوع رژیم" },
            { num: 3, title: "۳. وضعیت سلامتی، بیماری‌ها و صدور رژیم" },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num as 1 | 2 | 3)}
              className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm border transition text-center ${
                step === s.num
                  ? "bg-teal-700 text-white border-teal-700 shadow-xs"
                  : step > s.num
                  ? "bg-teal-50 text-teal-800 border-teal-200"
                  : "bg-slate-50 text-slate-500 border-slate-200"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleFinalSubmit}>
        {/* ================= STEP 1 ================= */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            {/* Athlete vs Non-Athlete Crucial First Question */}
            <div className="bg-slate-50 border-2 border-teal-600/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-teal-800 font-extrabold text-base md:text-lg mb-2">
                <Dumbbell className="w-5 h-5 text-teal-600 shrink-0" />
                سوال اول و تعیین‌کننده: آیا ورزشکار حرفه‌ای هستید یا کاربر عادی؟
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs sm:text-sm text-amber-950 leading-relaxed mb-4">
                <strong>💡 راهنمای بسیار مهم برای انتخاب درست:</strong>
                <ul className="list-disc pr-5 mt-1.5 space-y-1">
                  <li>
                    <strong>چه کسی باید «غیرورزشکار (کاربر عادی)» را انتخاب کند؟</strong> اگر هدف شما کاهش وزن، لاغری یا سلامتی است و مثلاً{" "}
                    <strong>۲ تا ۳ ماه است که به باشگاه، پیاده‌روی، ایروبیک یا شنا می‌روید</strong>، حتماً گزینه{" "}
                    <strong className="underline">«خیر، کاربر عادی هستم»</strong> را انتخاب کنید (ورزش باشگاهی شما در سوالِ «سطح فعالیت روزانه» پایین همین صفحه لحاظ می‌شود).
                  </li>
                  <li>
                    <strong>چه کسی باید «بله، ورزشکار هستم» را انتخاب کند؟</strong> فقط افرادی که سابقه طولانی تمرین سنگین و منظم دارند، توده عضلانی بالایی دارند، یا در{" "}
                    <strong>دوره‌های تخصصی ورزشی (حجم، کات و تفکیک، قبل از مسابقه، وزن‌کشی یا بارگیری کربوهیدرات)</strong> قرار دارند.
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setIsAthlete(false)}
                  className={`p-4 rounded-2xl border-2 text-right transition flex items-start gap-3 ${
                    !isAthlete
                      ? "bg-teal-700 text-white border-teal-700 shadow-md"
                      : "bg-white text-slate-800 border-slate-200 hover:border-teal-400"
                  }`}
                >
                  <UserCheck
                    className={`w-7 h-7 shrink-0 mt-0.5 ${
                      !isAthlete ? "text-teal-200" : "text-teal-600"
                    }`}
                  />
                  <div>
                    <div className="font-extrabold text-base mb-1">
                      خیر — کاربر عادی هستم (کاهش/افزایش وزن، تناسب اندام یا درمانی)
                    </div>
                    <div className={`text-xs leading-relaxed ${!isAthlete ? "text-teal-100" : "text-slate-500"}`}>
                      مناسب همه افراد، کارمندان، خانه‌داران و کسانی که برای لاغری و سلامتی به باشگاه یا پیاده‌روی می‌روند.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAthlete(true)}
                  className={`p-4 rounded-2xl border-2 text-right transition flex items-start gap-3 ${
                    isAthlete
                      ? "bg-teal-700 text-white border-teal-700 shadow-md"
                      : "bg-white text-slate-800 border-slate-200 hover:border-teal-400"
                  }`}
                >
                  <Dumbbell
                    className={`w-7 h-7 shrink-0 mt-0.5 ${
                      isAthlete ? "text-teal-200" : "text-teal-600"
                    }`}
                  />
                  <div>
                    <div className="font-extrabold text-base mb-1">
                      بله — ورزشکار هستم (بدنسازی، رزمی، قدرتی، استقامتی و مسابقه‌ای)
                    </div>
                    <div className={`text-xs leading-relaxed ${isAthlete ? "text-teal-100" : "text-slate-500"}`}>
                      فعال‌سازی تنظیمات تخصصی روز تمرینی و غیرتمرینی، دوره حجم/کات/بارگیری کربوهیدرات و وعده قبل/بعد تمرین.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Name & Basic Anthropometrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1.5">
                  نام و نام خانوادگی شما (جهت درج روی برگه رژیم)
                </label>
                <input
                  type="text"
                  value={userFullName}
                  onChange={(e) => onFullNameChange(e.target.value)}
                  placeholder="مثلاً: سارا محمدی"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-bold focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1.5">جنسیت</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender("female")}
                    className={`py-3 rounded-xl font-bold border transition ${
                      gender === "female"
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-slate-50 text-slate-700 border-slate-300"
                    }`}
                  >
                    👩 خانم
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("male")}
                    className={`py-3 rounded-xl font-bold border transition ${
                      gender === "male"
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-slate-50 text-slate-700 border-slate-300"
                    }`}
                  >
                    👨 آقا
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1.5">سن (سال)</label>
                <input
                  type="number"
                  min={10}
                  max={95}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1.5">
                  قد (سانتی‌متر — مثلاً ۱۶۵)
                </label>
                <input
                  type="number"
                  min={120}
                  max={220}
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1.5">
                  وزن فعلی (کیلوگرم — مثلاً ۷۴)
                </label>
                <input
                  type="number"
                  min={30}
                  max={220}
                  step="0.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 font-bold"
                />
              </div>

              <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
                <strong>{weightKg / ((heightCm / 100) ** 2) < 18.5 ? "وزن مرجع ایده‌آل" : weightKg / ((heightCm / 100) ** 2) >= 25 ? "وزن مرجع تعدیل‌یافته" : "وزن مرجع"}: </strong>
                {toFaDigits(Math.round((heightCm / 100) ** 2 * 22 + (weightKg / ((heightCm / 100) ** 2) >= 25 ? 0.4 * (weightKg - (heightCm / 100) ** 2 * 22) : 0)))} کیلوگرم
                <p className="text-xs mt-1">این عدد تخمینی است، هدف درمانی قطعی نیست؛ شرایط فردی و ورزشکاری باید بررسی شود.</p>
              </div>
            </div>

            {/* Activity Level Selection — NO NUMERIC FACTOR SHOWN! Tangible descriptions in parentheses */}
            <div>
              <label className="block text-base font-extrabold text-slate-900 mb-2">
                سطح تحرک و فعالیت روزانه شما چقدر است؟ (گزینه‌ای که به شرایط زندگی شما نزدیک‌تر است را بزنید)
              </label>
              <div className="space-y-2.5">
                {ACTIVITY_LEVELS.map((act: any) => {
                  const selected = Math.abs(activityFactor - act.factor) < 0.01;
                  return (
                    <button
                      key={act.key}
                      type="button"
                      onClick={() => setActivityFactor(act.factor)}
                      className={`w-full p-4 rounded-xl border-2 text-right transition flex items-center justify-between ${
                        selected
                          ? "bg-teal-50 border-teal-600 text-teal-950 font-bold"
                          : "bg-white border-slate-200 text-slate-800 hover:border-slate-300"
                      }`}
                    >
                      <span className="text-sm sm:text-base">{act.desc_fa}</span>
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300"
                        }`}
                      >
                        {selected && "✓"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold px-8 py-4 rounded-xl shadow-md transition flex items-center gap-2 text-base"
              >
                مرحله بعد: {isAthlete ? "تنظیمات تخصصی ورزشکار و درصد چربی" : "انتخاب هدف و نوع رژیم"}
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2 ================= */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            {isAthlete ? (
              /* ATHLETE SPECIALIZED QUESTIONS */
              <div className="space-y-6">
                <div className="bg-teal-900 text-white rounded-2xl p-5">
                  <h3 className="font-extrabold text-lg mb-1 flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-teal-300" />
                    تنظیمات تخصصی تغذیه ورزشی (Sports Nutrition Engine)
                  </h3>
                  <p className="text-xs sm:text-sm text-teal-100">
                    بر اساس رشته ورزشی و فازی که در آن قرار دارید، موتور بالینی کالری، پروتئین، چرخش کربوهیدرات، وعده قبل/بعد تمرین و تفکیک روز تمرینی و غیرتمرینی را محاسبه می‌کند.
                  </p>
                </div>

                {/* 1. Sport Category */}
                <div>
                  <label className="block text-base font-extrabold text-slate-900 mb-2.5">
                    ۱. دسته رشته ورزشی خود را انتخاب کنید:
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {SPORT_CATEGORIES.map((cat: any) => {
                      const active = sportCategory === cat.key;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => {
                            setSportCategory(cat.key);
                            if (!cat.phases.includes(sportPhase)) {
                              setSportPhase(cat.phases[0]);
                            }
                          }}
                          className={`p-4 rounded-xl border-2 text-right transition ${
                            active
                              ? "bg-teal-50 border-teal-600 text-teal-950"
                              : "bg-white border-slate-200 text-slate-800 hover:border-slate-300"
                          }`}
                        >
                          <div className="font-extrabold text-sm sm:text-base mb-1">
                            {cat.title_fa}
                          </div>
                          <div className="text-xs text-slate-500">{cat.desc_fa}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Sport Phase (Bulk, Cut, Carb Loading, Pre-Competition, Making Weight, etc.) */}
                <div>
                  <label className="block text-base font-extrabold text-slate-900 mb-2.5">
                    ۲. در حال حاضر در کدام دوره یا بازه ورزشی هستید؟
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(selectedSportCatObj.phases as string[]).map((pKey: string) => {
                      const pObj = SPORT_PHASES[pKey];
                      if (!pObj) return null;
                      const active = sportPhase === pKey;
                      return (
                        <button
                          key={pKey}
                          type="button"
                          onClick={() => setSportPhase(pKey)}
                          className={`p-4 rounded-xl border-2 text-right transition ${
                            active
                              ? "bg-teal-700 text-white border-teal-700 shadow-sm"
                              : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                          }`}
                        >
                          <div className="font-extrabold text-sm sm:text-base mb-1">
                            {pObj.title_fa}
                          </div>
                          <div
                            className={`text-xs leading-relaxed ${
                              active ? "text-teal-100" : "text-slate-600"
                            }`}
                          >
                            {pObj.desc_fa}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Training Schedule */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      تعداد جلسات تمرین در هفته
                    </label>
                    <select
                      value={trainingDaysPerWeek}
                      onChange={(e) => setTrainingDaysPerWeek(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-bold"
                    >
                      {[3, 4, 5, 6, 7].map((d) => (
                        <option key={d} value={d}>
                          {toFaDigits(d)} جلسه در هفته
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      مدت هر جلسه تمرین (دقیقه)
                    </label>
                    <select
                      value={sessionDurationMin}
                      onChange={(e) => setSessionDurationMin(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-bold"
                    >
                      {[45, 60, 75, 90, 120].map((m) => (
                        <option key={m} value={m}>
                          {toFaDigits(m)} دقیقه
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      زمان معمول تمرین
                    </label>
                    <select
                      value={trainingTimeSlot}
                      onChange={(e) => setTrainingTimeSlot(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-bold"
                    >
                      <option value="صبح">صبح (قبل از ظهر)</option>
                      <option value="عصر">عصر (۱۶ الی ۲۰)</option>
                      <option value="شب">شب (۲۰ به بعد)</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              /* NON-ATHLETE STANDARD GOALS */
              <div className="space-y-6">
                <div>
                  <label className="block text-base font-extrabold text-slate-900 mb-2.5">
                    هدف اصلی شما از دریافت این برنامه غذایی چیست؟
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {GOALS.map((g: any) => {
                      const active = goal === g.key;
                      return (
                        <button
                          key={g.key}
                          type="button"
                          onClick={() => setGoal(g.key)}
                          className={`p-4 rounded-xl border-2 text-right transition ${
                            active
                              ? "bg-teal-700 text-white border-teal-700 shadow-sm"
                              : "bg-white border-slate-200 text-slate-800 hover:border-teal-400"
                          }`}
                        >
                          <div className="font-extrabold text-base mb-1">{g.title_fa}</div>
                          <div
                            className={`text-xs ${active ? "text-teal-100" : "text-slate-500"}`}
                          >
                            {g.subtitle_fa}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-base font-extrabold text-slate-900 mb-2">
                    سبک تغذیه مورد علاقه شما (در صورت تداخل با بیماری، سیستم خودکار اصلاح می‌کند):
                  </label>
                  <select
                    value={dietPref}
                    onChange={(e) => setDietPref(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 font-bold"
                  >
                    {DIET_PREFS.map((dp: any) => (
                      <option key={dp.key} value={dp.key}>
                        {dp.title_fa}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* OPTIONAL VERIFIED BODY FAT % CALCULATION BOX */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useVerifiedBodyFat}
                    onChange={(e) => setUseVerifiedBodyFat(e.target.checked)}
                    className="mt-1 w-5 h-5 accent-teal-600 rounded"
                  />
                  <div>
                    <div className="font-extrabold text-slate-900 text-sm sm:text-base">
                      محاسبه دقیق‌تر کالری بر اساس «درصد چربی بدن» (اختیاری — مخصوص افرادی که از درصد چربی خود مطمئن هستند)
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      فقط در صورتی این تیک را بزنید که درصد چربی بدن خود را با دستگاه بادی‌کامپوزیشن (InBody)، کالیپر چین پوستی یا فرمول ارتش آمریکا (متر خیاطی) دقیق اندازه‌گیری کرده‌اید.
                    </div>
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => setShowBfCalcModal(!showBfCalcModal)}
                  className="bg-teal-100 hover:bg-teal-200 text-teal-900 font-bold text-xs px-4 py-2.5 rounded-xl shrink-0 flex items-center gap-1.5 transition"
                >
                  <Calculator className="w-4 h-4" />
                  {showBfCalcModal ? "بستن محاسبه‌گر درصد چربی" : "📐 باز کردن محاسبه‌گر درصد چربی (۴ روش معتبر)"}
                </button>
              </div>

              {useVerifiedBodyFat && (
                <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-64">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      عدد درصد چربی مطمئن شما (%):
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={55}
                      step="0.5"
                      value={bodyFatPct}
                      onChange={(e) => setBodyFatPct(Number(e.target.value))}
                      className="w-full rounded-xl border border-teal-500 bg-white px-4 py-2.5 font-extrabold text-teal-900"
                    />
                  </div>
                  <div className="text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-xl p-3 flex-1">
                    ✅ کالری پایه شما با فرمول{" "}
                    <strong>{isAthlete ? "Cunningham (ویژه ورزشکاران)" : "Katch-McArdle"}</strong>{" "}
                    بر مبنای توده عضلانی خالص بدون چربی ({toFaDigits(Math.round(weightKg * (1 - bodyFatPct / 100)))} کیلوگرم LBM) محاسبه خواهد شد.
                  </div>
                </div>
              )}

              {showBfCalcModal && (
                <div className="mt-4">
                  <BodyFatCalculatorSection
                    initialGender={gender}
                    initialAge={age}
                    initialHeight={heightCm}
                    initialWeight={weightKg}
                    initialWaist={waistCm}
                    isAthlete={isAthlete}
                    onApplyBodyFat={(bf, meth) => {
                      setBodyFatPct(bf);
                      setBodyFatMethod(meth);
                      setUseVerifiedBodyFat(true);
                      setShowBfCalcModal(false);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 rounded-xl transition flex items-center gap-1"
              >
                <ChevronRight className="w-5 h-5" />
                مرحله قبل
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold px-8 py-4 rounded-xl shadow-md transition flex items-center gap-2 text-base"
              >
                مرحله بعد: بررسی بیماری‌ها و ساخت رژیم
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3 ================= */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h3 className="text-base md:text-lg font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-teal-600" />
                وضعیت سلامتی و بیماری‌های زمینه‌ای (در صورت نداشتن بیماری، هیچ‌کدام را تیک نزنید)
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                گزینه‌ها بر اساس اطلاعات ثبت‌شده غربال می‌شوند؛ برای بیماری کلیه و سنگ، ارزیابی آزمایش‌ها و بازبینی کارشناس ضروری است.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {Object.values(CONDITIONS).map((c: any) => {
                  if (c.key === "pregnancy" && gender === "male") return null;
                  const checked = conditions.includes(c.key);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => toggleCondition(c.key)}
                      className={`p-3.5 rounded-xl border text-right transition flex items-center justify-between ${
                        checked
                          ? "bg-teal-700 text-white border-teal-700 font-bold shadow-xs"
                          : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-sm">{c.label_fa}</span>
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs ${
                          checked
                            ? "bg-white text-teal-700 border-white font-extrabold"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 p-4 space-y-2">
                <label className="block text-sm font-bold">سابقه سنگ کلیه و نوع سنگ</label>
                <select className="w-full rounded-lg border border-slate-300 p-3 text-sm" value={conditions.find(c => c.startsWith("stone_")) || ""} onChange={e => setConditions(prev => [...prev.filter(c => !c.startsWith("stone_")), ...(e.target.value ? [e.target.value] : [])])}>
                  <option value="">ندارم</option><option value="stone_unknown">دارم، نوع نامشخص</option><option value="stone_calcium_oxalate">اگزالات کلسیم</option><option value="stone_calcium_phosphate">فسفات کلسیم</option><option value="stone_uric_acid">اسید اوریکی</option><option value="stone_cystine">سیستینی</option><option value="stone_struvite">استروویت / عفونی</option><option value="stone_other">نوع دیگر یا ترکیبی</option>
                </select>
                <p className="text-xs text-amber-800">نوع سنگ، آزمایش ادرار و بیماری‌های همراه برای نسخه دقیق لازم‌اند؛ سنگ عفونی و سیستینی حتماً به بررسی پزشک نیاز دارند. اگر محدودیت مایعات دارید خودسرانه مصرف آب را افزایش ندهید.</p>
              </div>

              {/* Conditional Sub-Question for Kidney: Non-Dialysis (0.8g/kg) vs Hemodialysis (1.2g/kg) */}
              {conditions.includes("kidney") && <div className="mt-4 rounded-xl border border-slate-200 p-4 space-y-2">
                <label className="block text-sm font-bold">مرحله بیماری مزمن کلیه (در صورت اطلاع از پزشک)</label>
                <select className="w-full rounded-lg border border-slate-300 p-3 text-sm" value={conditions.find(c => c.startsWith("ckd_stage_")) || ""} onChange={e => setConditions(prev => [...prev.filter(c => !c.startsWith("ckd_stage_")), ...(e.target.value ? [e.target.value] : [])])}>
                  <option value="">نامشخص</option><option value="ckd_stage_1">مرحله ۱</option><option value="ckd_stage_2">مرحله ۲</option><option value="ckd_stage_3">مرحله ۳</option><option value="ckd_stage_4">مرحله ۴</option><option value="ckd_stage_5">مرحله ۵</option>
                </select>
                <p className="text-xs text-amber-800">مرحله به‌تنهایی برای تعیین پروتئین، پتاسیم یا مایعات کافی نیست؛ آزمایش و نظر تیم درمان لازم است.</p>
              </div>}
              {conditions.includes("kidney") && (
                <div className="mt-4 bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
                  <div className="font-extrabold text-amber-950 text-sm mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    سوال حیاتی کلیوی: آیا بیمار تحت «همودیالیز» قرار دارد؟
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsDialysis(false)}
                      className={`p-3 rounded-xl border text-right text-xs sm:text-sm font-bold ${
                        !isDialysis
                          ? "bg-amber-700 text-white border-amber-700"
                          : "bg-white text-slate-800 border-amber-200"
                      }`}
                    >
                      ⚪ خیر — بیماری کلیوی بدون همودیالیز (نیازمند تعیین مرحله و بازبینی پروتئین)
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDialysis(true)}
                      className={`p-3 rounded-xl border text-right text-xs sm:text-sm font-bold ${
                        isDialysis
                          ? "bg-amber-700 text-white border-amber-700"
                          : "bg-white text-slate-800 border-amber-200"
                      }`}
                    >
                      🔵 بله — همودیالیز (برنامه مایعات و مواد معدنی طبق آزمایش و نظر تیم درمان)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Allergies & Restrictions */}
            <div>
              <label className="block text-sm font-extrabold text-slate-900 mb-2">
                حساسیت غذایی یا محدودیت مصرف (اختیاری):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ALLERGIES_AND_RESTRICTIONS.map((al: any) => {
                  const checked = allergies.includes(al.key);
                  return (
                    <button
                      key={al.key}
                      type="button"
                      onClick={() => toggleAllergy(al.key)}
                      className={`p-3 rounded-xl border text-right text-xs sm:text-sm transition flex items-center justify-between ${
                        checked
                          ? "bg-rose-600 text-white border-rose-600 font-bold"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span>{al.label_fa}</span>
                      <span>{checked ? "✓" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Disliked Foods & Medications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1">
                  غذاهایی که اصلاً دوست ندارید (با ویرگول جدا کنید — از رژیم شما حذف می‌شوند):
                </label>
                <input
                  type="text"
                  value={dislikedText}
                  onChange={(e) => setDislikedText(e.target.value)}
                  placeholder="مثلاً: بادمجان، کرفس، ماهی"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1">
                  داروها یا مکمل‌های مصرفی (جهت بررسی تداخل دارو و غذا و مشاهده کارشناس):
                </label>
                <input
                  type="text"
                  value={medicationsText}
                  onChange={(e) => setMedicationsText(e.target.value)}
                  placeholder="مثلاً: متفورمین، لووتیروکسین، قرص آهن"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm"
                />
              </div>
            </div>

            {/* Active Meal Slots */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-2">
                وعده‌های غذایی روزانه شما (در دیابت، کلیه و بارداری تمام ۶ وعده به صورت علمی قفل می‌شوند):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {Object.values(SLOT_META).map((slot: any) => {
                  const active = mealSlotsOk[slot.id] !== false;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() =>
                        setMealSlotsOk((prev) => ({ ...prev, [slot.id]: !active }))
                      }
                      className={`p-2.5 rounded-xl border text-center text-xs font-bold transition ${
                        active
                          ? "bg-teal-50 border-teal-600 text-teal-900"
                          : "bg-white border-slate-200 text-slate-400"
                      }`}
                    >
                      <div>{slot.title_fa}</div>
                      <div className="text-[10px] font-normal mt-0.5">
                        {active ? "✅ فعال" : "⚡ حاضری/حذف"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Medical Disclaimer Consent */}
            <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-1 w-5 h-5 accent-teal-600 rounded"
              />
              <div className="text-xs text-slate-700 leading-relaxed">
                <strong>تاییدیه سلامت و رضایت‌نامه آگاهانه:</strong> اطلاعات واردشده صحیح است و می‌دانم این برنامه جایگزین دستور مستقیم پزشک معالج در شرایط اورژانسی نیست و پرونده من برای بازبینی در اختیار کارشناس تغذیه کلینیک قرار می‌گیرد.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 rounded-xl transition flex items-center justify-center gap-1"
              >
                <ChevronRight className="w-5 h-5" />
                مرحله قبل
              </button>

              <button
                type="submit"
                disabled={submitting || !consentChecked}
                className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-extrabold px-8 py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base"
              >
                <Sparkles className="w-5 h-5" />
                {submitting
                  ? "در حال محاسبه بالینی و چیدمان منو..."
                  : "✨ محاسبه و دریافت فوری برنامه غذایی هوشمند من"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
