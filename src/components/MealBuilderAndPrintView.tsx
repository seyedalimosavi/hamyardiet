"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  RefreshCw,
  Check,
  Trash2,
  Plus,
  Search,
  Printer,
  ChefHat,
  FileText,
  ShoppingCart,
  Sliders,
  AlertCircle,
  Dumbbell,
  Award,
  Sparkles,
  X,
} from "lucide-react";
import { toFaDigits, formatJalali } from "../../shared/persian.js";
import { getPatientEducation } from "../../shared/patientEducation.js";

interface MealBuilderProps {
  regimen: any;
  onRegimenUpdated: (updated: any) => void;
  onEditProfileClick: () => void;
}

export default function MealBuilderAndPrintView({
  regimen,
  onRegimenUpdated,
  onEditProfileClick,
}: MealBuilderProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "builder" | "print_diet" | "cooking_guide" | "weekly_shop"
  >("builder");

  // Day mode toggle ONLY used if shock_plateau ('day1' | 'day2') or athlete ('day1' | 'rest')
  const [dayMode, setDayMode] = useState<"day1" | "day2" | "rest">("day1");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [clientRejectedCodes, setClientRejectedCodes] = useState<string[]>([]);

  // Cooking Guide N persons state
  const [persons, setPersons] = useState<number>(4);
  const [cookingGuide, setCookingGuide] = useState<any>(null);
  const [loadingGuide, setLoadingGuide] = useState<boolean>(false);

  // Search Modal state
  const [searchModalSlot, setSearchModalSlot] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchTab, setSearchTab] = useState<"meals" | "general">("meals");
  const [searchResults, setSearchResults] = useState<{ meals: any[]; generalFoods: any[] }>({
    meals: [],
    generalFoods: [],
  });
  const [searching, setSearching] = useState<boolean>(false);
  const searchSequence = useRef(0);

  // Shopping list checked items
  const [checkedShopItems, setCheckedShopItems] = useState<Record<string, boolean>>({});

  const metrics = regimen?.calculatedMetricsJson || {};
  const profile = regimen?.profileSnapshotJson || {};
  const educationSections = getPatientEducation(profile, metrics);
  const day1Slots = Array.isArray(regimen?.day1SlotsJson) ? regimen.day1SlotsJson : [];
  const day2Shock = regimen?.day2ShockJson || null;
  const athleteRest = regimen?.athleteRestDayJson || null;
  const treatAllowance = regimen?.treatAllowanceJson || null;
  const weeklySchedule = regimen?.weeklyScheduleJson || { weekly_days: [], shopping_list: [] };

  const isShockRegimen =
    metrics.effectiveGoal === "shock_plateau" && Boolean(day2Shock?.enabled);
  const isAthleteRegimen = Boolean(profile.is_athlete) && Boolean(athleteRest?.enabled);

  const displayedSlots =
    dayMode === "day2" && isShockRegimen && Array.isArray(day2Shock?.slots)
      ? day2Shock.slots
      : dayMode === "rest" && isAthleteRegimen && Array.isArray(athleteRest?.slots)
      ? athleteRest.slots
      : day1Slots;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Load cooking guide when persons or regimen changes
  useEffect(() => {
    if (!regimen?.id) return;
    let active = true;
    setLoadingGuide(true);
    fetch("/api/v1/regimens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cooking_guide",
        regimenId: regimen.id,
        persons,
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (active && json.ok) {
          setCookingGuide(json.data.cookingGuide);
        }
      })
      .finally(() => {
        if (active) setLoadingGuide(false);
      });
    return () => {
      active = false;
    };
  }, [regimen?.id, regimen?.updatedAt, persons]);

  // Reject & Next (Smart Non-Repeating Refresh)
  const handleRejectAndNext = async (slotId: string, optionId?: string, mealCode?: string) => {
    const key = optionId || slotId;
    setBusyKey(key);
    const updatedRejected = mealCode
      ? Array.from(new Set([...clientRejectedCodes, mealCode]))
      : clientRejectedCodes;
    setClientRejectedCodes(updatedRejected);

    try {
      const res = await fetch("/api/v1/regimens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refresh_option",
          regimenId: regimen.id,
          slotId,
          optionId: optionId || null,
          dayMode,
          clientRejectedCodes: updatedRejected,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        onRegimenUpdated(json.data.regimen);
        showToast(json.message_fa || "✅ گزینه‌های وعده به‌روزرسانی شدند.");
      } else {
        showToast(`⚠️ ${json.error?.message_fa || "خطا در تعویض گزینه"}`);
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleApprove = async (slotId: string, optionId: string) => {
    setBusyKey(`app_${optionId}`);
    try {
      const res = await fetch("/api/v1/regimens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_option",
          regimenId: regimen.id,
          slotId,
          optionId,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        onRegimenUpdated(json.data.regimen);
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteOption = async (slotId: string, optionId: string, mealCode?: string) => {
    setBusyKey(`del_${optionId}`);
    if (mealCode) {
      setClientRejectedCodes((prev) => Array.from(new Set([...prev, mealCode])));
    }
    try {
      const res = await fetch("/api/v1/regimens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_option",
          regimenId: regimen.id,
          slotId,
          optionId,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        onRegimenUpdated(json.data.regimen);
        showToast("🗑️ گزینه حذف شد و دیگر تکرار نخواهد شد.");
      } else {
        showToast(`⚠️ ${json.error?.message_fa}`);
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleAddOption = async (
    slotId: string,
    mealCode?: string,
    generalFoodCode?: string
  ) => {
    setBusyKey(`add_${slotId}`);
    try {
      const res = await fetch("/api/v1/regimens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_option",
          regimenId: regimen.id,
          slotId,
          mealCode,
          generalFoodCode,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        onRegimenUpdated(json.data.regimen);
        setSearchModalSlot(null);
        showToast("✅ گزینه جدید به وعده اضافه شد.");
      } else {
        showToast(`🚫 ${json.error?.message_fa}`);
      }
    } finally {
      setBusyKey(null);
    }
  };

  const openSearchModal = async (slot: any) => {
    setSearchModalSlot(slot);
    setSearchQuery("");
    await runFoodSearch("", slot);
  };

  const runFoodSearch = async (q: string, slotObj = searchModalSlot) => {
    if (!slotObj) return;
    const requestId = ++searchSequence.current;
    setSearching(true);
    try {
      const hardBans = (metrics.hard_bans || []).join(",");
      const res = await fetch(
        `/api/v1/foods?q=${encodeURIComponent(q)}&slotId=${slotObj.slot_id}&slotCal=${slotObj.target_calories}&hardBans=${encodeURIComponent(hardBans)}&regimenId=${encodeURIComponent(regimen.id)}`
      );
      const json = await res.json();
      if (json.ok && requestId === searchSequence.current) {
        setSearchResults(json.data);
      }
    } finally {
      if (requestId === searchSequence.current) setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="no-print fixed bottom-20 md:bottom-6 left-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-bold border border-teal-500 animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Top Navigation Sub-Tabs (Hidden in Print) */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("builder")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition ${
              activeSubTab === "builder"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Sliders className="w-4 h-4" />
            ۱. میز شخصی‌سازی منوها (رد و جایگزینی)
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("print_diet")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition ${
              activeSubTab === "print_diet"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            ۲. برگه چاپ برنامه غذایی (≤۲ صفحه A4)
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("cooking_guide")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition ${
              activeSubTab === "cooking_guide"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <ChefHat className="w-4 h-4" />
            ۳. راهنمای پخت و مقیاس قابلمه خانواده (۱ تا N نفر)
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("weekly_shop")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2 transition ${
              activeSubTab === "weekly_shop"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            ۴. برنامه هفتگی و لیست خرید
          </button>
        </div>

        <button
          type="button"
          onClick={onEditProfileClick}
          className="text-xs font-bold text-teal-700 hover:bg-teal-50 px-3 py-2 rounded-xl border border-teal-200 transition"
        >
          ✏️ ویرایش اطلاعات پرونده / بیماری‌ها
        </button>
      </div>

      {/* =====================================================================
          SUB-TAB 1: INTERACTIVE MULTI-OPTION MEAL BUILDER
         ===================================================================== */}
      {activeSubTab === "builder" && (
        <div className="space-y-6 no-print">
          {/* Metabolism & Macro Summary Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-teal-100 text-teal-900 text-xs font-extrabold px-3 py-1 rounded-full">
                    کد پیگیری: {toFaDigits(regimen.trackingCode)}
                  </span>
                  {regimen.signedByConsultantName && (
                    <span className="bg-emerald-100 text-emerald-900 text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      تایید و امضاشده توسط: {regimen.signedByConsultantName} (نظام پزشکی:{" "}
                      {regimen.signedByCouncilCode})
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 mt-2">
                  خلاصه متابولیسم و بودجه تغذیه‌ای روزانه — {regimen.userName}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSubTab("print_diet")}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow flex items-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  مشاهده و چاپ برگه ۲ صفحه‌ای رژیم
                </button>
              </div>
            </div>

            <p className="text-[10px] text-slate-600 mb-2">مقادیر انرژی و درشت‌مغذی جدول بالا هدف تخمینی‌اند، نه جمع تأییدشده مواد غذایی گزینه‌ها.</p>

            {regimen.consultantOverrideNote && (
              <div className="mb-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 text-sm text-emerald-950">
                <strong>🩺 یادداشت اختصاصی کارشناس تغذیه ({regimen.signedByConsultantName || "محمدرضا فرحانی"}):</strong>{" "}
                {regimen.consultantOverrideNote}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-[11px] text-slate-500">BMI فعلی</div>
                <div className="text-lg font-extrabold text-slate-900">
                  {toFaDigits(metrics.bmi)}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-[11px] text-slate-500">بازه وزن سلامت</div>
                <div className="text-sm font-extrabold text-slate-900">
                  {toFaDigits(metrics.ideal_weight_min)} تا {toFaDigits(metrics.ideal_weight_max)} ک‌گ
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-[11px] text-slate-500">متابولیسم پایه (BMR)</div>
                <div className="text-base font-extrabold text-slate-900">
                  {toFaDigits(metrics.bmr)}
                </div>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
                <div className="text-[11px] text-teal-800 font-bold">کالری هدف روزانه</div>
                <div className="text-lg font-extrabold text-teal-900">
                  {toFaDigits(metrics.targetCal)} کالری
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <div className="text-[11px] text-emerald-800 font-bold">پروتئین روزانه</div>
                <div className="text-base font-extrabold text-emerald-900">
                  {toFaDigits(metrics.protein_g)} گرم
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <div className="text-[11px] text-amber-800 font-bold">کربوهیدرات</div>
                <div className="text-base font-extrabold text-amber-900">
                  {toFaDigits(metrics.carbs_g)} گرم
                </div>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                <div className="text-[11px] text-rose-800 font-bold">چربی مجاز</div>
                <div className="text-base font-extrabold text-rose-900">
                  {toFaDigits(metrics.fat_g)} گرم
                </div>
              </div>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-center">
                <div className="text-[11px] text-sky-800 font-bold">آب روزانه</div>
                <div className="text-base font-extrabold text-sky-900">
                  {metrics.water_l == null ? "طبق نظر پزشک" : `${toFaDigits(metrics.water_l)} لیتر`}
                </div>
              </div>
            </div>

            {/* Athlete Specialized Protocol Box */}
            <p className="text-xs text-amber-800 mt-2">انرژی و درشت‌مغذی‌های بالا هدف تخمینی‌اند؛ مجموع واقعی گزینه‌های انتخابی هنوز به‌صورت دقیق محاسبه نشده و باید بازبینی شود.</p>

            {metrics.athlete_protocol && (
              <div className="mt-5 bg-slate-900 text-white rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-3">
                  <div className="font-extrabold text-base flex items-center gap-2 text-teal-300">
                    <Dumbbell className="w-5 h-5" />
                    پروتکل تخصصی ورزشکار: {metrics.athlete_protocol.sport_category_title_fa} —{" "}
                    {metrics.athlete_protocol.sport_phase_title_fa}
                  </div>
                  <div className="text-xs bg-teal-500/20 border border-teal-400/40 text-teal-200 px-3 py-1 rounded-full">
                    کالری روز تمرین: {toFaDigits(metrics.athlete_protocol.training_day_cal)} | روز استراحت:{" "}
                    {toFaDigits(metrics.athlete_protocol.rest_day_cal)}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
                  <div className="bg-slate-800/90 p-3.5 rounded-xl border border-slate-700">
                    <strong className="text-amber-300 block mb-1">⚡ وعده قبل از تمرین (Pre-Workout):</strong>
                    {metrics.athlete_protocol.pre_workout_guide_fa}
                  </div>
                  <div className="bg-slate-800/90 p-3.5 rounded-xl border border-slate-700">
                    <strong className="text-emerald-300 block mb-1">
                      🏆 وعده طلایی بعد از تمرین (Post-Workout Recovery):
                    </strong>
                    {metrics.athlete_protocol.post_workout_guide_fa}
                  </div>
                </div>
              </div>
            )}

            {/* Clinical Warnings */}
            {Array.isArray(metrics.warnings_fa) && metrics.warnings_fa.length > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
                <div className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  تنظیمات هوشمند اعمال‌شده روی پرونده شما:
                </div>
                {metrics.warnings_fa.map((w: string, idx: number) => (
                  <p key={idx} className="text-xs text-amber-900 leading-relaxed">
                    • {w}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Day Switcher ONLY for Athlete (Training vs Rest Day) OR Shock Plateau (Day 1 vs Day 2) */}
          {isAthleteRegimen && (
            <div className="bg-white border-2 border-teal-600 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900 px-2">
                🏋️ تفکیک برنامه ورزشی شما بر اساس روز تمرین و روز استراحت:
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setDayMode("day1")}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition ${
                    dayMode === "day1"
                      ? "bg-teal-700 text-white shadow"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  🏋️ برنامه روزهای تمرینی ({toFaDigits(metrics.targetCal)} کالری)
                </button>
                <button
                  type="button"
                  onClick={() => setDayMode("rest")}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition ${
                    dayMode === "rest"
                      ? "bg-teal-700 text-white shadow"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  🧘 برنامه روزهای غیرتمرینی / ریکاوری (
                  {toFaDigits(athleteRest?.rest_day_calories || metrics.targetCal - 250)} کالری)
                </button>
              </div>
            </div>
          )}

          {isShockRegimen && (
            <div className="bg-white border-2 border-amber-500 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-amber-950 px-2">
                ⚡ چرخش ۲ روزه ویژه شکستن استپ وزنی (رژیم شوک):
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setDayMode("day1")}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition ${
                    dayMode === "day1"
                      ? "bg-amber-600 text-white shadow"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  روز اول: پروتئینی ({toFaDigits(metrics.targetCal)} کالری)
                </button>
                <button
                  type="button"
                  onClick={() => setDayMode("day2")}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition ${
                    dayMode === "day2"
                      ? "bg-amber-600 text-white shadow"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  روز دوم: شوک / سبک درمانی ({toFaDigits(day2Shock?.day2Cal)} کالری)
                </button>
              </div>
            </div>
          )}

          <section className="rounded-2xl border border-teal-200 bg-teal-50 p-4 sm:p-5 text-sm text-teal-950 leading-7" aria-label="راهنمای انتخاب وعده‌ها">
            <h3 className="font-extrabold text-base mb-2">چطور برنامه‌ام را شخصی‌سازی کنم؟</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>غذایی را می‌پسندید؟</strong> دکمه «تأیید» همان گزینه را بزنید تا هنگام تعویض کل وعده حفظ شود. تأیید برای چاپ الزامی نیست.</li>
              <li><strong>غذایی را نمی‌خواهید؟</strong> روی «رد و پیشنهاد بعدی» بزنید تا فقط همان گزینه عوض شود. علامت سطل هم گزینه را حذف می‌کند.</li>
              <li><strong>گزینه بیشتری می‌خواهید؟</strong> از «افزودن پیشنهاد جدید» یا «جستجو از بانک غذا» استفاده کنید؛ گزینه‌های فعلی سر جای خود می‌مانند.</li>
              <li>در هر وعده فقط <strong>یک گزینه</strong> بخورید. همه گزینه‌های باقی‌مانده، حتی موارد تأییدنشده، در برگه چاپی نمایش داده می‌شوند.</li>
            </ul>
            <p className="text-xs mt-2">«تعویض کل این وعده» گزینه‌های تأییدشده را نگه می‌دارد و بقیه را در صورت وجود پیشنهاد جایگزین عوض می‌کند.</p>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3" aria-label="توصیه‌های مربوط به شرایط شما">
            <div><h3 className="font-extrabold text-base text-slate-900">توصیه‌های مربوط به شرایط شما</h3><p className="text-xs text-slate-500 mt-1 leading-relaxed">این نکات آموزشی بر اساس اطلاعات ثبت‌شده‌اند، نه تشخیص یا تأیید قطعی منو. آزمایش‌ها، داروها و شرایط هم‌زمان باید توسط تیم درمان بررسی شوند.</p></div>
            <div className="space-y-2">{educationSections.map((section) => <details key={section.title} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><summary className="cursor-pointer text-sm font-bold text-teal-900">{section.title}</summary><ul className="list-disc list-inside space-y-2 mt-3 text-xs sm:text-sm text-slate-700 leading-7">{section.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></details>)}</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">منابع آموزشی: <a className="underline text-teal-700" target="_blank" rel="noreferrer" href="https://www.niddk.nih.gov/health-information/urologic-diseases/kidney-stones/eating-diet-nutrition">NIDDK، تغذیه و سنگ کلیه</a> و <a className="underline text-teal-700" target="_blank" rel="noreferrer" href="https://www.kidney.org/kidney-topics/creating-kidney-friendly-plate">بنیاد ملی کلیه، تغذیه در بیماری کلیه</a>، <a className="underline text-teal-700" target="_blank" rel="noreferrer" href="https://www.thyroid.org/patient-thyroid-information/ct-for-patients/march-2026/vol-19-issue-2-p-3-4/">انجمن تیروئید آمریکا</a> و <a className="underline text-teal-700" target="_blank" rel="noreferrer" href="https://diabetes.org/living-with-diabetes/treatment-care/using-cgm-manage-diabetes">انجمن دیابت آمریکا</a>.</p>
          </section>

          {/* Meal Slots & Multi-Option Cards */}
          <div className="space-y-6">
            {displayedSlots.map((slot: any) => (
              <div
                key={slot.slot_id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
              >
                {/* Slot Header */}
                <div className="bg-teal-700 text-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base sm:text-lg">{slot.title_fa}</h3>
                      <span className="text-xs bg-teal-800 text-teal-100 px-2.5 py-0.5 rounded-full">
                        ساعت پیشنهادی: {slot.time_window_fa}
                      </span>
                      <span className="text-xs bg-white/20 text-white font-bold px-2.5 py-0.5 rounded-full">
                        {toFaDigits(slot.target_calories)} کالری ({toFaDigits(slot.pct_of_day)}٪)
                      </span>
                    </div>
                    <p className="text-xs text-teal-100 mt-0.5">
                      هر روز فقط <strong>یکی از گزینه‌های زیر</strong> را انتخاب کنید؛ کالری گزینه‌ها تقریبی است و ممکن است متفاوت باشد:
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleAddOption(slot.slot_id)}
                      disabled={busyKey === `add_${slot.slot_id}`}
                      className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      افزودن پیشنهاد جدید
                    </button>
                    <button
                      type="button"
                      onClick={() => openSearchModal(slot)}
                      className="bg-white text-teal-900 hover:bg-teal-50 text-xs font-extrabold px-3 py-2 rounded-xl flex items-center gap-1 transition shadow-2xs"
                    >
                      <Search className="w-3.5 h-3.5" />
                      جستجو از بانک غذا
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectAndNext(slot.slot_id)}
                      disabled={busyKey === slot.slot_id}
                      className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold px-3 py-2 rounded-xl flex items-center gap-1 transition"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${busyKey === slot.slot_id ? "animate-spin" : ""}`}
                      />
                      تعویض کل این وعده
                    </button>
                  </div>
                </div>

                {/* Options Grid */}
                <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {(slot.options || []).map((opt: any, idx: number) => (
                    <div
                      key={opt.option_id}
                      className={`rounded-2xl border-2 p-4 flex flex-col justify-between transition ${
                        opt.is_approved
                          ? "bg-emerald-50/40 border-emerald-500 shadow-sm"
                          : "bg-slate-50/60 border-slate-200 hover:border-teal-400"
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Option Title & Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block text-[11px] font-extrabold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-md mb-1">
                              گزینه {toFaDigits(idx + 1)}
                            </span>
                            <h4 className="font-extrabold text-slate-900 text-base leading-snug">
                              {opt.title_fa}
                            </h4>
                          </div>
                          <span className="text-xs font-extrabold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shrink-0">
                            کالری تخمینی: {toFaDigits(opt.final_calories)}
                          </span>
                        </div>

                        <p className="text-[11px] text-amber-800">کالری برآوردی است و به دلیل گرد کردن و کامل نبودن داده مواد غذایی ممکن است با مقدار واقعی متفاوت باشد؛ نیازمند بازبینی کارشناس است.</p>
                        {/* Main Scaled Ingredients with Tangible Bread Palms & Meat Matchboxes */}
                        <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-800 leading-relaxed font-medium">
                          {opt.scaled_ingredients_fa}
                        </div>

                        {opt.preparation_fa && <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs leading-relaxed"><strong>روش تهیه: </strong>{opt.preparation_fa}</div>}
                        {(opt.soft_warnings_fa || []).map((warning: string, i: number) => <div key={i} className="text-xs text-amber-900 bg-amber-50 p-2 rounded-lg">{warning}</div>)}
                        {/* Context-Aware Grain Substitution Sub-Menu */}
                        {opt.grain_box && opt.grain_box.show_substitution_box && (
                          <div className="bg-[#F0FDF4] border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 space-y-1.5">
                            <div className="font-extrabold text-emerald-900">
                              🌾 {opt.grain_box.header_fa}
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {(opt.grain_box.substitutions_list_fa || []).map(
                                (subItem: string, sIdx: number) => (
                                  <span
                                    key={sIdx}
                                    className="bg-white border border-emerald-200 text-emerald-900 px-2 py-1 rounded-lg font-medium"
                                  >
                                    • {subItem}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {/* Special Note for Flour in Recipe (e.g. Khagineh F25 or Fereni) */}
                        {opt.grain_box && opt.grain_box.flour_recipe_note_fa && (
                          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 leading-relaxed font-medium">
                            {opt.grain_box.flour_recipe_note_fa}
                          </div>
                        )}

                        {/* Synchronized Oil & Cooking Box (Interactive View Only) */}
                        {opt.oil_box && (
                          <div className="bg-[#FEF3C7] border border-amber-200 rounded-xl p-3 text-xs text-amber-950 leading-relaxed">
                            <span className="font-extrabold">🍳 روغن و روش پخت: </span>
                            {opt.oil_box.instruction_fa}
                          </div>
                        )}

                        {/* Clinical Why Chosen */}
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>{opt.why_chosen_fa}</span>
                        </div>
                      </div>

                      {/* Card Action Bar: Approve | Non-Repeating Reject & Next | Delete */}
                      <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleApprove(slot.slot_id, opt.option_id)}
                          disabled={busyKey === `app_${opt.option_id}`}
                          className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1 transition ${
                            opt.is_approved
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-400"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {opt.is_approved ? "تایید شد" : "تایید"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleRejectAndNext(slot.slot_id, opt.option_id, opt.meal_code)
                          }
                          disabled={busyKey === opt.option_id}
                          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow-2xs"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              busyKey === opt.option_id ? "animate-spin" : ""
                            }`}
                          />
                          رد و پیشنهاد بعدی
                        </button>

                        {(slot.options || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteOption(slot.slot_id, opt.option_id, opt.meal_code)
                            }
                            disabled={busyKey === `del_${opt.option_id}`}
                            title="حذف این گزینه"
                            className="p-2 rounded-xl bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Treat Allowance Box */}
          {treatAllowance && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h3 className="font-extrabold text-base text-slate-900 mb-1">
                🍫 سهمیه تفریحی مجاز هفتگی (بدون آسیب به رژیم)
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mb-3">{treatAllowance.reason_fa}</p>
              {treatAllowance.enabled &&
                Array.isArray(treatAllowance.suggestions_fa) &&
                treatAllowance.suggestions_fa.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {treatAllowance.suggestions_fa.map((sug: string, i: number) => (
                      <div
                        key={i}
                        className="bg-purple-50 border border-purple-200 text-purple-950 rounded-xl p-3 text-xs font-bold"
                      >
                        • {sug}
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: OFFICIAL 2-PAGE A4 PRINTABLE DIET SHEET (NO OIL BOX!)
         ===================================================================== */}
      {activeSubTab === "print_diet" && (
        <div className="space-y-4">
          {/* Print Control Bar (Hidden in Print) */}
          <div className="no-print bg-teal-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow">
            <div>
              <h3 className="font-extrabold text-base">
                📄 پیش‌نمایش برگه رسمی چاپ برنامه غذایی (طراحی فشرده حداکثر ۲ صفحه A4)
              </h3>
              <p className="text-xs text-teal-200 mt-0.5">
                بدون باکس جداگانه «وضعیت روغن» (سهم روغن و معادل نان به صورت طبیعی و کوتاه داخل خط غذا درج شده‌اند).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-white text-teal-900 hover:bg-teal-50 font-extrabold px-5 py-3 rounded-xl shadow flex items-center gap-2 transition text-sm"
              >
                <Printer className="w-4 h-4" />
                🖨️ چاپ برگه برنامه غذایی (A4 / PDF)
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("cooking_guide")}
                className="bg-teal-700 hover:bg-teal-600 text-white font-bold px-4 py-3 rounded-xl border border-teal-500 text-xs sm:text-sm transition"
              >
                👩‍🍳 رفتن به برگه راهنمای پخت خانواده (۱ تا N نفر) ←
              </button>
            </div>
          </div>

          {/* Printable A4 Sheet Container */}
          <div className="print-sheet-container bg-white border border-slate-300 rounded-2xl p-6 md:p-8 shadow-sm max-w-4xl mx-auto">
            {/* Compact Clinical Header (<= 28mm height) */}
            <div className="bg-[#0F766E] text-white rounded-xl px-5 py-3.5 mb-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/15 border border-white/30 flex items-center justify-center font-extrabold text-base shrink-0">
                  NC
                </div>
                <div>
                  <h1 className="font-extrabold text-base sm:text-lg leading-tight">
                    برنامه غذایی شخصی‌سازی‌شده — کلینیک تغذیه و رژیم‌درمانی نوتری‌کلینیک
                  </h1>
                  <p className="text-[11px] text-teal-100">
                    برنامه غذایی بر پایه سفره ایرانی {regimen.signedByConsultantName && regimen.signedByCouncilCode ? `| تأیید کارشناس: ${regimen.signedByConsultantName} (نظام پزشکی: ${regimen.signedByCouncilCode})` : "| تنظیم خودکار، بدون تأیید کارشناس"}
                  </p>
                </div>
              </div>
              <div className="text-left text-xs shrink-0">
                <div className="font-bold">کد پیگیری: {toFaDigits(regimen.trackingCode)}</div>
                <div className="text-teal-100 text-[11px]">
                  تاریخ صدور: {formatJalali(regimen.createdAt || new Date())}
                </div>
              </div>
            </div>

            {/* 2-Row Compact Patient Summary Table */}
            <table className="w-full border-collapse border border-slate-300 text-xs mb-3">
              <tbody>
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 px-2.5 py-1.5 font-bold">
                    نام مراجع: {regimen.userName}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5">
                    سن و قد: {toFaDigits(metrics.age)} سال / {toFaDigits(metrics.height_cm)} سانتی‌متر
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5">
                    وزن فعلی: <strong>{toFaDigits(metrics.weight_kg)} کیلوگرم</strong> (BMI:{" "}
                    {toFaDigits(metrics.bmi)})
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5">
                    وزن ایده‌آل: {toFaDigits(metrics.ideal_weight_min)} تا{" "}
                    {toFaDigits(metrics.ideal_weight_max)} ک‌گ
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-2.5 py-1.5 font-bold text-teal-900">
                    بودجه روزانه: {toFaDigits(metrics.targetCal)} کیلوکالری
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5">
                    پروتئین: {toFaDigits(metrics.protein_g)}g | کربوهیدرات:{" "}
                    {toFaDigits(metrics.carbs_g)}g | چربی: {toFaDigits(metrics.fat_g)}g
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5">
                    آب روزانه: {metrics.water_l == null ? "طبق نظر پزشک" : `${toFaDigits(metrics.water_l)} لیتر`}
                  </td>
                  <td className="border border-slate-300 px-2.5 py-1.5">
                    پایش بعدی: ۱۴ روز پس از شروع
                  </td>
                </tr>
              </tbody>
            </table>

            {regimen.consultantOverrideNote && (
              <div className="border border-teal-600 bg-teal-50/50 rounded-lg px-3 py-1.5 text-xs text-slate-900 mb-3">
                <strong>یادداشت بالینی کارشناس تغذیه:</strong> {regimen.consultantOverrideNote}
              </div>
            )}

            {/* Compact Meals Table (NO separate "وضعیت روغن" box or column!) */}
            <div className="space-y-2.5 mb-3">
              {day1Slots.map((slot: any) => (
                <div key={slot.slot_id} className="border border-slate-300 rounded-lg overflow-hidden">
                  <div className="bg-teal-50 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs font-extrabold text-teal-950">
                    <span>
                      🍽️ {slot.title_fa} ({slot.time_window_fa}) — هر روز فقط یکی از گزینه‌های زیر را انتخاب کنید:
                    </span>
                    <span>{toFaDigits(slot.target_calories)} کالری</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {(slot.options || []).map((opt: any, oIdx: number) => (
                      <div
                        key={opt.option_id}
                        className="px-3 py-1.5 text-[12px] leading-relaxed text-slate-900"
                      >
                        <strong className="text-teal-800">گزینه {toFaDigits(oIdx + 1)} — </strong>
                        {opt.print_compact_line_fa}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Compact Fruit Unit Definition Box */}
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg px-3.5 py-2 text-[11.5px] leading-relaxed text-emerald-950 mb-3">
              🍏 میوه و سبزیجات را در مقدار مناسب و با توجه به آلرژی، نوع سنگ و آزمایش‌های کلیوی انتخاب کنید.
            </div>

            {/* 5 Golden Clinical Recommendations at the Bottom */}
            <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/60">
              <div className="font-extrabold text-xs text-slate-900 mb-1.5">
                📌 نکات کوتاه بر اساس شرایط ثبت‌شده:
              </div>
              <div className="space-y-1 text-[11px] leading-relaxed text-slate-800">
                {educationSections.slice(0, 5).map((section, idx) => (
                  <div key={section.title}>{toFaDigits(idx + 1)}. {section.print}</div>
                ))}
                {educationSections.length > 5 && <div>سایر توصیه‌های مربوط به شرایط شما در بخش «توصیه‌های مربوط به شرایط شما» در برنامه قابل مشاهده است.</div>}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-[10.5px] text-slate-500">
                <span>
                  مقادیر درج‌شده در این برگه، سهم پخته ۱ نفره سر سفره است. برای مقادیر خام و پخت قابلمه خانواده به «برگه راهنمای پخت» مراجعه فرمایید.
                </span>
                {regimen.signedByConsultantName && regimen.signedByCouncilCode && <span className="font-bold text-slate-700">تأیید کارشناس: {regimen.signedByConsultantName} (نظام پزشکی {regimen.signedByCouncilCode})</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: SEPARATE FAMILY POT & COOKING GUIDE SHEET (1..N PERSONS)
         ===================================================================== */}
      {activeSubTab === "cooking_guide" && (
        <div className="space-y-4">
          {/* Interactive Person Selector & Print Button (Hidden in Print) */}
          <div className="no-print bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-teal-600" />
                برگه مجزای «راهنمای پخت‌وپز، تبدیل خام‌به‌پخته و مقیاس قابلمه خانواده»
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                تعداد نفرات قابلمه خانواده را انتخاب کنید تا مقادیر دقیق خام، پخته و مانور روغن کل قابلمه بدون هیچ ابهامی محاسبه شود:
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPersons(n)}
                  className={`px-3.5 py-2 rounded-xl font-extrabold text-xs sm:text-sm border transition ${
                    persons === n
                      ? "bg-teal-700 text-white border-teal-700 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {toFaDigits(n)} نفر
                </button>
              ))}
              <div className="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-600">تعداد دلخواه:</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={persons}
                  onChange={(e) =>
                    setPersons(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                  }
                  className="w-14 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-extrabold text-sm"
                />
                <span className="text-xs text-slate-600">نفر</span>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold px-4 py-2.5 rounded-xl shadow flex items-center gap-1.5 text-xs sm:text-sm transition"
              >
                <Printer className="w-4 h-4" />
                🖨️ چاپ مجزای راهنمای آشپزی برای {toFaDigits(persons)} نفر
              </button>
            </div>
          </div>

          {/* Printable Cooking Guide Sheet */}
          {loadingGuide || !cookingGuide ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 font-bold">
              در حال محاسبه مقیاس قابلمه برای {toFaDigits(persons)} نفر...
            </div>
          ) : (
            <div className="print-sheet-container bg-white border border-slate-300 rounded-2xl p-6 md:p-8 shadow-sm max-w-5xl mx-auto space-y-5">
              <div className="bg-teal-800 text-white rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h2 className="font-extrabold text-base sm:text-lg">
                    👩‍🍳 راهنمای آشپزی، تبدیل خام‌به‌پخته و تنظیم روغن قابلمه (مقیاس{" "}
                    {toFaDigits(cookingGuide.persons)} نفره)
                  </h2>
                  <p className="text-xs text-teal-100 mt-0.5">
                    مراجع: {regimen.userName} | کد پیگیری: {toFaDigits(regimen.trackingCode)}
                  </p>
                </div>
                <span className="bg-white text-teal-900 font-extrabold px-3 py-1.5 rounded-lg text-xs">
                  قابلمه {toFaDigits(cookingGuide.persons)} نفره
                </span>
              </div>

              {/* 1. Reassuring Banner */}
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium">
                {cookingGuide.reassurance_banner_fa}
              </div>

              {/* 2. Family Pot Trick (How not to cook 2 separate pots!) */}
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs sm:text-sm text-amber-950 leading-relaxed">
                {cookingGuide.family_pot_trick_fa}
              </div>

              {/* 3. Condition-Specific Cooking Protocols */}
              <div className="space-y-2.5">
                <h3 className="font-extrabold text-sm text-slate-900">
                  🩺 اصول پخت اختصاصی متناسب با رژیم و شرایط پرونده شما:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(cookingGuide.condition_protocols_fa || []).map((p: any, i: number) => (
                    <div
                      key={i}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs leading-relaxed"
                    >
                      <div className="font-extrabold text-teal-800 mb-1">• {p.title_fa}</div>
                      <div className="text-slate-700">{p.body_fa}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Standard Raw-to-Cooked Conversion Reference Table */}
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 mb-2">
                  ⚖️ جدول مرجع ضرایب تبدیل تقریبی «خام به پخته» در آشپزخانه ایرانی:
                </h3>
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800">
                      <th className="border border-slate-300 px-3 py-2 text-right">گروه غذایی</th>
                      <th className="border border-slate-300 px-3 py-2 text-right">
                        واحد پخته در برگه رژیم
                      </th>
                      <th className="border border-slate-300 px-3 py-2 text-right">
                        معادل تقریبی ماده خام قبل از پخت
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cookingGuide.conversion_reference || []).map((row: any, idx: number) => (
                      <tr key={idx} className="odd:bg-white even:bg-slate-50">
                        <td className="border border-slate-300 px-3 py-2 font-bold">
                          {row.category_fa}
                        </td>
                        <td className="border border-slate-300 px-3 py-2">{row.cooked_unit_fa}</td>
                        <td className="border border-slate-300 px-3 py-2 text-teal-900 font-medium">
                          {row.raw_equiv_fa}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 5. Itemized N-Person Pot Scaling Table for User's Approved Options */}
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 mb-2">
                  🍲 جدول مقادیر پخت قابلمه برای {toFaDigits(cookingGuide.persons)} نفر (بر اساس منوهای برنامه شما):
                </h3>
                <div className="space-y-3">
                  {(cookingGuide.items || []).map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="border border-slate-300 rounded-xl p-3.5 bg-white text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="font-extrabold text-teal-800 text-sm">
                          [{item.slot_title_fa}] {item.option_title_fa}
                        </span>
                        <span className="bg-teal-50 text-teal-800 px-2.5 py-0.5 rounded-md font-bold">
                          مقیاس {toFaDigits(item.persons)} نفره
                        </span>
                      </div>
                      <div>
                        <strong>🍽️ سهم پخته ۱ نفره شما سر سفره:</strong>{" "}
                        {item.cooked_single_share_fa}
                      </div>
                      {item.persons > 1 && (
                        <div>
                          <strong>👨‍👩‍👧‍👦 مجموع پخته برای {toFaDigits(item.persons)} نفر:</strong>{" "}
                          {item.cooked_family_total_fa}
                        </div>
                      )}
                      <div className="text-emerald-900 bg-emerald-50/70 px-2.5 py-1.5 rounded-lg">
                        <strong>🌾 معادل تقریبی مواد خام برای بستن قابلمه:</strong>{" "}
                        {item.approx_raw_for_pot_fa}
                      </div>
                      <div className="text-amber-950 bg-amber-50/80 px-2.5 py-1.5 rounded-lg">
                        <strong>🫒 مانور روغن کل قابلمه:</strong> {item.pot_oil_allowance_fa}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 4: 7-DAY ROTATING SCHEDULE & SUPERMARKET SHOPPING LIST
         ===================================================================== */}
      {activeSubTab === "weekly_shop" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 7-Day Rotating Table */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <h3 className="font-extrabold text-lg text-slate-900 mb-1">
              📅 برنامه پیشنهادی ۷ روزه چرخشی (چیده شده از گزینه‌های تاییدشده شما)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              این جدول به شما کمک می‌کند در طول هفته تنوع کامل بین گزینه‌های هر وعده داشته باشید:
            </p>
            <div className="space-y-3">
              {(weeklySchedule.weekly_days || []).map((day: any) => (
                <div
                  key={day.day_index}
                  className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50"
                >
                  <div className="font-extrabold text-teal-800 text-sm mb-2 border-b border-slate-200 pb-1.5">
                    روز {day.day_name_fa}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(day.slots || []).map((s: any) => (
                      <div key={s.slot_id} className="bg-white border border-slate-200 p-2.5 rounded-lg">
                        <span className="font-bold text-slate-900">{s.slot_title_fa}: </span>
                        <span className="text-teal-700 font-bold">{s.option_title_fa}</span>
                        <div className="text-[11px] text-slate-600 mt-0.5">{s.compact_line_fa}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Supermarket Checklist */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs h-fit">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                🛒 لیست خرید سوپرمارکتی تیک‌خور
              </h3>
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print text-xs bg-teal-50 text-teal-700 font-bold px-3 py-1.5 rounded-lg"
              >
                🖨️ چاپ لیست
              </button>
            </div>
            <div className="space-y-4">
              {(weeklySchedule.shopping_list || []).map((cat: any, cIdx: number) => (
                <div key={cIdx} className="border-b border-slate-100 pb-3 last:border-none">
                  <div className="font-extrabold text-xs text-teal-800 mb-2">{cat.category_fa}</div>
                  <div className="space-y-1.5">
                    {(cat.items || []).map((itemText: string, iIdx: number) => {
                      const key = `${cIdx}_${iIdx}`;
                      const checked = Boolean(checkedShopItems[key]);
                      return (
                        <label
                          key={key}
                          className="flex items-start gap-2 text-xs cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setCheckedShopItems((p) => ({ ...p, [key]: !checked }))
                            }
                            className="mt-0.5 w-4 h-4 accent-teal-600 rounded"
                          />
                          <span className={checked ? "line-through text-slate-400" : "text-slate-700"}>
                            {itemText}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL / BOTTOM SHEET: SEARCH & ADD FROM FOOD BANK
         ===================================================================== */}
      {searchModalSlot && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-teal-700 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base">
                  🔍 جستجو و افزودن به وعده «{searchModalSlot.title_fa}» (
                  {toFaDigits(searchModalSlot.target_calories)} کالری)
                </h3>
                <p className="text-xs text-teal-100">
                  دستورهای جایگزین با سهم مشخص در ابتدای نتایج می‌آیند. کالری تقریبی است و انتخاب باید با شرایط شما بررسی شود.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSearchModalSlot(null)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    runFoodSearch(e.target.value);
                  }}
                  placeholder="نام غذا یا ماده غذایی را بنویسید (مثلاً: قیمه، عدسی، اوتمیل، مرغ)..."
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSearchTab("meals")}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold ${
                    searchTab === "meals"
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  🍲 وعده‌های پخته استاندارد ({toFaDigits(searchResults.meals.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setSearchTab("general")}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold ${
                    searchTab === "general"
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  🍎 بانک مواد غذایی پایه ({toFaDigits(searchResults.generalFoods.length)})
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {searching ? (
                <div className="text-center py-8 text-slate-500 text-sm font-bold">
                  در حال جستجو در بانک تغذیه...
                </div>
              ) : searchTab === "meals" && searchResults.meals.length === 0 ? (
                <p className="text-center text-sm text-slate-600 py-8">برای این وعده موردی پیدا نشد. نام دیگری را امتحان کنید یا از کارشناس برای ساخت دستور مناسب کمک بگیرید.</p>
              ) : searchTab === "general" && searchResults.generalFoods.length === 0 ? (
                <p className="text-center text-sm text-slate-600 py-8">ماده غذایی یافت نشد.</p>
              ) : searchTab === "meals" ? (
                searchResults.meals.map((m: any) => (
                  <div
                    key={m.code}
                    className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-teal-400"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{m.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            m.safety_status === "SAFE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {m.safety_label_fa}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{m.ingredients_desc}</p>
                      {m.search_only && <p className="text-xs text-teal-800 mt-1">کالری تخمینی سهم: {toFaDigits(m.base_calories)} | روش پخت: {m.preparation_fa}</p>}
                    </div>
                    <button
                      type="button"
                      disabled={m.safety_status !== "SAFE"}
                      onClick={() => {
                        if (m.requires_review && !window.confirm("این نسخهٔ معمولی ممکن است با شرایط شما مناسب نباشد. در صورت امکان دستور جایگزین را انتخاب کنید. همچنان می‌خواهید آن را برای بررسی اضافه کنید؟")) return;
                        handleAddOption(searchModalSlot.slot_id, m.code, undefined);
                      }}
                      className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-bold px-3.5 py-2 rounded-xl shrink-0"
                    >
                      + افزودن
                    </button>
                  </div>
                ))
              ) : (
                searchResults.generalFoods.map((gf: any) => (
                  <div
                    key={gf.code}
                    className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{gf.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            gf.safety_status === "SAFE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {gf.safety_label_fa}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        هر {toFaDigits(gf.unit_label)} = {toFaDigits(gf.calories_per_unit)} کالری
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={gf.safety_status !== "SAFE"}
                      onClick={() => handleAddOption(searchModalSlot.slot_id, undefined, gf.code)}
                      className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-bold px-3.5 py-2 rounded-xl shrink-0"
                    >
                      + افزودن
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
