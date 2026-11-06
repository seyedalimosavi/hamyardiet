// server/engine/clinicalRules.js — Clinical Rules, scanX Persian Scanner & Metabolic Calculator

import { normalizeFa, toFaDigits } from "../../shared/persian.js";
import {
  CONDITIONS,
  DEFAULT_SLOTS_PCT,
  SLOT_META,
  SPORT_PHASES,
  SPORT_CATEGORIES,
} from "../../shared/constants.js";
import { analyzeBodyComposition } from "./bodyFat.js";

export function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

export function round10(n) {
  return Math.round(Number(n) / 10) * 10;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Pure Persian Contraindication Scanner (scanX)
 * Order: 1. normalizeFa -> 2. strip safe exceptions -> 3. match negative rules
 */
export function scanX(rawText) {
  if (!rawText) return [];
  let text = normalizeFa(rawText);

  const hits = new Set();

  // Safe exception stripping per category
  const stripExceptions = (src, exceptions) => {
    let tmp = src;
    for (const ex of exceptions) {
      const normEx = normalizeFa(ex);
      tmp = tmp.replaceAll(normEx, " ");
    }
    return tmp;
  };

  // 1. NEG_SUGAR
  const sugarText = stripExceptions(text, [
    "بدون قند",
    "بدون شکر",
    "قند خون",
    "مرباخوری",
    "رایس کیک",
    "رایسکیک",
    "کیک برنجی",
  ]);
  const sugarWords = [
    "قند",
    "شکر",
    "عسل",
    "مربا",
    "شیره",
    "نبات",
    "نوشابه",
    "کیک",
    "شیرینی",
    "شکلات",
    "بستنی",
    "گز",
    "سوهان",
    "حلوا",
    "زولبیا",
    "کمپوت",
    "کافی میکس",
  ];
  if (sugarWords.some((w) => sugarText.includes(normalizeFa(w)))) {
    hits.add("NEG_SUGAR");
  }

  // 2. NEG_KIDNEY
  const kidneyText = stripExceptions(text, ["لوبیا سبز", "نخودفرنگی", "نخود فرنگی"]);
  const kidneyWords = [
    "گوجه",
    "رب گوجه",
    "سیب زمینی",
    "موز",
    "پرتقال",
    "خرما",
    "اسفناج",
    "اووکادو",
    "زردالو",
    "برگه",
    "عدس",
    "لوبیا",
    "نخود",
    "لپه",
    "ماش",
    "کنسرو",
    "خیارشور",
    "ترشی",
    "دوغ شور",
    "سوسیس",
    "کالباس",
    "ژامبون",
    "پفک",
    "چیپس",
  ];
  if (kidneyWords.some((w) => kidneyText.includes(normalizeFa(w)))) {
    hits.add("NEG_KIDNEY");
  }

  // 3. NEG_GOUT
  const goutWords = ["جگر", "قلوه", "سیرابی", "کله پاچه", "پاچه"];
  if (goutWords.some((w) => text.includes(normalizeFa(w))) || /(^|[\s،+])دل(?=$|[\s،+])/.test(text)) {
    hits.add("NEG_GOUT");
  }

  // 4. NEG_RED_MEAT
  const redMeatText = stripExceptions(text, [
    "برگر مرغ",
    "برگر سویا",
    "همبرگر مرغ",
    "همبرگر سویا",
    "کوبیده مرغ",
  ]);
  const redMeatWords = [
    "گوشت قرمز",
    "گوسفند",
    "گوساله",
    "کوبیده",
    "کباب برگ",
    "شیشلیک",
    "استیک",
    "همبرگر",
    "ابگوشت",
    "دیزی",
    "سوسیس",
    "کالباس",
  ];
  if (redMeatWords.some((w) => redMeatText.includes(normalizeFa(w)))) {
    hits.add("NEG_RED_MEAT");
  }

  // 5. NEG_REFLUX
  const refluxWords = ["سوخاری", "سرخ شده", "خیلی تند", "فلفل قرمز", "ترشی"];
  if (refluxWords.some((w) => text.includes(normalizeFa(w)))) {
    hits.add("NEG_REFLUX");
  }

  // 6. NEG_PREGNANCY
  const pregWords = ["تن ماهی", "سوسیس", "کالباس", "ژامبون", "جگر"];
  if (pregWords.some((w) => text.includes(normalizeFa(w)))) {
    hits.add("NEG_PREGNANCY");
  }

  // 7. NEG_HIGH_GI
  const highGiText = stripExceptions(text, ["نان سنگک", "سنگک", "نان جو", "سبوس دار", "سبوسدار"]);
  const highGiWords = [
    "برنج سفید زیاد",
    "لواش",
    "تافتون",
    "باگت",
    "تست سفید",
    "سیب زمینی",
    "فرنی",
    "شله زرد",
    "کورن فلکس",
    "نودل",
  ];
  if (highGiWords.some((w) => highGiText.includes(normalizeFa(w)))) {
    hits.add("NEG_HIGH_GI");
  }

  // 8. NEG_GLUTEN
  const glutenText = stripExceptions(text, [
    "رایس کیک",
    "رایسکیک",
    "کیک برنجی",
    "ارد سوخاری ذرت",
    "ارد برنج",
    "ارد ذرت",
    "بدون گلوتن",
  ]);
  const glutenWords = [
    "گندم",
    "جو",
    "سنگک",
    "بربری",
    "لواش",
    "تافتون",
    "باگت",
    "ماکارونی",
    "پاستا",
    "لازانیا",
    "خمیر",
    "رشته",
    "حلیم",
    "کیک",
    "بیسکویت",
    "ساقه طلایی",
    "پتی بور",
    "ارد",
  ];
  if (glutenWords.some((w) => glutenText.includes(normalizeFa(w))) || (!text.includes("بدون گلوتن") && glutenText.includes("پیتزا"))) {
    hits.add("NEG_GLUTEN");
  }

  // 9. NEG_LACTOSE
  const lactoseText = stripExceptions(text, [
    "ماهی شیر",
    "شیر سویا",
    "شیر بادام",
    "شیر نارگیل",
    "کره بادام زمینی",
    "کره پسته",
    "کره فندق",
    "بدون لاکتوز",
  ]);
  // Check standalone "شیر" carefully so "شیرینی" or "ماهی شیر" don't false-trigger
  const lactoseWords = ["پنیر", "ماست", "دوغ", "کشک", "خامه", "کره", "بستنی"];
  const hasMilkToken = /(^|\s)شیر(\s|$| کم| پر| گرم| سرد| موز| خرما)/.test(lactoseText);
  if (hasMilkToken || lactoseWords.some((w) => lactoseText.includes(normalizeFa(w)))) {
    hits.add("NEG_LACTOSE");
  }

  // 10. NEG_EGG
  const eggWords = ["تخم مرغ", "سفیده", "املت", "نیمرو", "خاگینه", "کوکو"];
  if (eggWords.some((w) => text.includes(normalizeFa(w)))) {
    hits.add("NEG_EGG");
  }

  // 11. NEG_SOY
  const soyWords = ["سویا", "توفو"];
  if (soyWords.some((w) => text.includes(normalizeFa(w)))) {
    hits.add("NEG_SOY");
  }

  // 12. NEG_PEANUT
  const peanutWords = ["بادام زمینی"];
  if (peanutWords.some((w) => text.includes(normalizeFa(w)))) {
    hits.add("NEG_PEANUT");
  }

  // 13. NEG_FISH
  const fishText = stripExceptions(text, ["ماهی تابه", "ماهیتابه", "گوشت ماهیچه", "ماهیچه"]);
  const fishWords = ["ماهی", "میگو", "تن ماهی", "قزل الا", "سالمون"];
  if (fishWords.some((w) => fishText.includes(normalizeFa(w)))) {
    hits.add("NEG_FISH");
  }

  // These flags identify ingredients for review, not measured nutrient content.
  // Explicit absence phrases are removed to avoid treating “بدون اسفناج” as an ingredient.
  const riskText = text.replace(/بدون\s+(?:اسفناج|ریواس|بادام زمینی|بادام|سبوس گندم|جگر|ساردین|انچوی|نمک)/g, " ");
  if (/(اسفناج|ریواس|بادام زمینی|بادام|سبوس گندم)/.test(riskText)) hits.add("NEG_STONE_OXALATE_HIGH");
  if (/(جگر|قلوه|سیرابی|کله پاچه|ساردین|انچوی)/.test(riskText) || /(^|[\s،+])دل(?=$|[\s،+])/.test(riskText)) hits.add("NEG_STONE_PURINE_HIGH");
  if (/(خیارشور|سوسیس|کالباس|ژامبون|چیپس|پفک|دوغ شور|کنسرو شور|پنیر شور)/.test(riskText)) hits.add("NEG_HIGH_SALT");

  return Array.from(hits);
}

/**
 * Core Clinical Calculation Pipeline (Steps 1 to 17)
 */
export function calculateClinicalMetrics(profile) {
  const gender = profile.gender === "male" ? "male" : "female";
  const age = Number(profile.age) || 30;
  const height_cm = Number(profile.height_cm) || 165;
  const weight_kg = Number(profile.weight_kg) || 70;
  const activity_factor = Number(profile.activity_factor) || 1.375;
  const goal = profile.goal || "loss";
  const diet_pref = profile.diet_pref || "balanced";
  const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
  const allergies = Array.isArray(profile.allergies) ? profile.allergies : [];
  const restrictions = Array.isArray(profile.restrictions) ? profile.restrictions : [];

  const is_athlete = Boolean(profile.is_athlete);
  const sport_category = profile.sport_category || "bodybuilding";
  const sport_phase = profile.sport_phase || "lean_bulk";
  const is_dialysis = Boolean(profile.is_dialysis);
  const use_verified_body_fat = Boolean(profile.use_verified_body_fat);
  const body_fat_pct = Number(profile.body_fat_pct) || 0;

  const warnings_fa = [];
  let red_flag_stop = false;
  let red_flag_reason_fa = null;

  // Step 1: Safety Red-Flag Gate
  if (age < 16 || profile.has_eating_disorder_history === true) {
    red_flag_stop = true;
    red_flag_reason_fa =
      age < 16
        ? "به دلیل قرار داشتن در سنین حساس رشد (زیر ۱۶ سال)، صدور رژیم خودکار متوقف شده و پرونده شما نیازمند تنظیم مستقیم توسط کارشناس تغذیه است."
        : "به دلیل ثبت سابقه اختلالات خوردن، جهت حفظ کامل سلامت شما، برنامه صرفاً پس از بررسی مستقیم کارشناس تغذیه صادر می‌گردد.";
  }

  const stone = conditions.find((c) => c.startsWith("stone_"));
  if (stone) {
    const advice = {
      stone_calcium_oxalate: "در سنگ اگزالات کلسیم، دریافت طبیعی کلسیم غذایی را حفظ و منابع بسیار پر اگزالات و نمک را محدود کنید.",
      stone_calcium_phosphate: "در سنگ فسفات کلسیم، نمک را کاهش دهید و کلسیم غذایی طبیعی را بدون محدودیت خودسرانه حفظ کنید.",
      stone_uric_acid: "در سنگ اسید اوریکی، منابع پرپورین مانند احشا را محدود و مقدار پروتئین حیوانی را با کارشناس تنظیم کنید.",
      stone_cystine: "سنگ سیستینی نیازمند ارزیابی تخصصی و برنامه مایعات و درمان فردی است.",
      stone_struvite: "سنگ استروویت با عفونت مرتبط است و نیاز به بررسی و درمان پزشکی دارد؛ رژیم به‌تنهایی کافی نیست.",
    };
    warnings_fa.push((advice[stone] || "برای تعیین نوع سنگ و برنامه مناسب به پزشک مراجعه کنید.") + " برنامه باید با نوع سنگ، آزمایش ادرار و بیماری‌های همراه توسط پزشک یا کارشناس بازبینی شود؛ در صورت محدودیت مایعات، افزایش آب فقط با نظر پزشک.");
  }

  // Step 2: Anthropometrics
  const h_m = height_cm / 100;
  const h2 = h_m * h_m;
  const bmi = round1(weight_kg / h2);
  const ideal_weight_min = Math.round(18.5 * h2);
  const ideal_weight_max = Math.round(24.9 * h2);
  const ideal_weight_mid = Math.round(22 * h2);

  let effectiveGoal = goal;
  if (bmi < 18.5 && ["loss", "loss_slow", "loss_fast", "shock_plateau"].includes(effectiveGoal)) {
    effectiveGoal = "maintain";
    warnings_fa.push(
      "به دلیل شاخص توده بدنی کمتر از ۱۸.۵ (کم‌وزنی)، هدف کاهش وزن و فستینگ به طور خودکار لغو و روی تغذیه متعادل تنظیم شد."
    );
  }
  if (age >= 16 && age < 18 && ["loss_fast", "shock_plateau"].includes(effectiveGoal)) {
    effectiveGoal = "maintain";
    warnings_fa.push("برای رده سنی ۱۶ تا ۱۸ سال، کسری کالری تند و رژیم شوک به حالت متعادل رشد تغییر یافت.");
  }

  // Step 3: Metabolic Base Weight (Adjusted weight for BMI >= 40)
  let w_calc = weight_kg;
  if (bmi >= 40 && !is_athlete) {
    w_calc = ideal_weight_mid + 0.4 * (weight_kg - ideal_weight_mid);
    warnings_fa.push(
      `به دلیل BMI بالای ۴۰، کالری پایه بر اساس وزن تعدیل‌شده متابولیک (${toFaDigits(Math.round(w_calc))} کیلوگرم) محاسبه شد تا از تجویز کالری کاذب جلوگیری شود.`
    );
  }

  // Step 4: BMR Calculation (Mifflin-St Jeor default, or Katch-McArdle/Cunningham if verified body fat is enabled)
  let bmr;
  let body_comp_summary = null;
  if (use_verified_body_fat && body_fat_pct >= 4 && body_fat_pct <= 55) {
    body_comp_summary = analyzeBodyComposition({
      gender,
      weight_kg,
      height_cm,
      body_fat_pct,
      is_athlete,
    });
    bmr = body_comp_summary.recommended_bmr;
    warnings_fa.push(
      `محاسبه دقیق کالری بر اساس درصد چربی تاییدشده (${toFaDigits(body_fat_pct)}٪) و توده بدون چربی (${toFaDigits(body_comp_summary.lbm_kg)} کیلوگرم) با فرمول ${is_athlete ? "Cunningham ویژه ورزشکاران" : "Katch-McArdle"} انجام شد.`
    );
  } else {
    bmr =
      gender === "male"
        ? Math.round(10 * w_calc + 6.25 * height_cm - 5 * age + 5)
        : Math.round(10 * w_calc + 6.25 * height_cm - 5 * age - 161);
  }

  // Step 5: TDEE
  const tdee = Math.round(bmr * activity_factor);

  // Step 6: Goal / Athlete Phase Delta
  const goalDeltaMap = {
    loss_slow: -300,
    loss: -500,
    loss_fast: -750,
    shock_plateau: -500,
    maintain: 0,
    muscle: 250,
    gain: 400,
  };

  let deficitOrSurplus = goalDeltaMap[effectiveGoal] ?? -500;
  let athletePhaseObj = null;

  if (is_athlete && !conditions.includes("kidney") && bmi >= 18.5 && age >= 18 && SPORT_PHASES[sport_phase]) {
    athletePhaseObj = SPORT_PHASES[sport_phase];
    deficitOrSurplus = athletePhaseObj.delta_train;
  }

  // Step 7: Clinical Condition & Pregnancy Adjustments
  const hasPregnancy = conditions.includes("pregnancy");
  const hasKidney = conditions.includes("kidney");
  const hasDiabetes = conditions.includes("diabetes");
  const hasHypothyroid = conditions.includes("hypothyroid");
  const hasPcos = conditions.includes("pcos");
  const hasGout = conditions.includes("gout");
  const hasReflux = conditions.includes("reflux");
  const hasFattyLiver = conditions.includes("fatty_liver");
  const hasCholesterol = conditions.includes("cholesterol");
  const hasHeart = conditions.includes("heart");
  const hasHypertension = conditions.includes("hypertension");

  let rawTarget;
  if (hasPregnancy) {
    effectiveGoal = "maintain";
    rawTarget = tdee + 300;
    warnings_fa.push(
      "به دلیل شرایط بارداری/شیردهی، هرگونه کاهش وزن و فستینگ لغو شد و ۳۰۰ کالری مازاد ایمن برای حفظ سلامت مادر و شیرخوار اعمال گردید."
    );
  } else {
    if (deficitOrSurplus < 0 && (hasHypothyroid || hasPcos)) {
      deficitOrSurplus = Math.round(deficitOrSurplus * 0.85);
      warnings_fa.push(
        "به دلیل کم‌کاری تیروئید / PCOS، شیب کسری کالری ۱۵٪ ملایم‌تر شد تا از افت متابولیسم پایه جلوگیری شود."
      );
    }
    rawTarget = tdee + deficitOrSurplus;
  }

  // Step 8: Absolute Calorie Floor & Round to 10
  const floor = gender === "male" ? 1500 : 1200;
  const targetCal = Math.max(floor, round10(rawTarget));

  // Athlete Rest / Recovery Day Calorie
  let athlete_rest_day_cal = null;
  if (is_athlete && !hasPregnancy && athletePhaseObj) {
    const rawRest = tdee + (athletePhaseObj.delta_rest ?? 0);
    athlete_rest_day_cal = Math.max(floor, round10(rawRest));
  }

  // Step 9: Effective Diet Key & Medical Diet Ban Resolution
  let effectiveDietKey = diet_pref;
  const fastingBanConditions = ["diabetes", "kidney", "pregnancy", "gout"];
  const hasFastingBan =
     conditions.some((c) => fastingBanConditions.includes(c)) || age < 18 || bmi < 18.5;

  if (effectiveDietKey === "keto" && (hasPregnancy || hasKidney || hasFattyLiver)) {
    effectiveDietKey = "balanced";
    warnings_fa.push(
      "رژیم کتوژنیک به دلیل تداخل پزشکی با شرایط شما (بارداری/کلیه/کبد چرب) لغو و به رژیم درمانی متعادل تغییر یافت."
    );
  }
  if (
    (effectiveDietKey === "fast16" || effectiveDietKey === "fast14") &&
    hasFastingBan
  ) {
    effectiveDietKey = hasDiabetes ? "lowcarb" : "balanced";
    warnings_fa.push(
      "به دلیل شرایط بالینی شما (دیابت / کلیه / نقرس / بارداری)، فستینگ طولانی برای پیشگیری از افت قند یا آسیب کلیوی لغو شد."
    );
  }

  // Step 10: Protein Precedence Rule
  let proteinFactor = 1.4;
  if (hasKidney) {
    if (is_dialysis) {
      proteinFactor = 1.2;
      warnings_fa.push(
        "برآورد اولیه پروتئین دیالیز ۱.۲ گرم به ازای هر کیلوگرم است؛ مقدار دقیق، پتاسیم و فسفر باید با آزمایش‌ها، نوع دیالیز و وضعیت تغذیه تنظیم شود."
      );
    } else {
      proteinFactor = 0.8;
      warnings_fa.push(
        "پروتئین اولیه ۰.۸ گرم به ازای هر کیلوگرم برآورد شده است؛ مرحله بیماری، وضعیت تغذیه و شرایط بالینی باید توسط متخصص بررسی شود."
      );
    }
  } else if (hasPregnancy) {
    proteinFactor = 1.5;
  } else if (is_athlete && athletePhaseObj) {
    proteinFactor = Math.min(2.0, athletePhaseObj.protein_g_kg || 1.8);
  } else if (effectiveGoal === "muscle") {
    proteinFactor = 2.1;
  } else if (effectiveGoal === "shock_plateau") {
    proteinFactor = 2.0;
  } else if (["loss", "loss_slow", "loss_fast"].includes(effectiveGoal)) {
    proteinFactor = 1.8;
  } else if (effectiveGoal === "gain") {
    proteinFactor = 1.7;
  }

  let protein_g = Math.round(weight_kg * proteinFactor);
  // Cap at 35% of total calories unless kidney 0.8g/kg
  const maxProteinG = Math.round((targetCal * 0.35) / 4);
  if (!hasKidney && protein_g > maxProteinG && effectiveGoal !== "shock_plateau") {
    protein_g = maxProteinG;
  }

  // Step 11: Fat Percentage by Strictest Condition
  let fatPct = 28;
  if (effectiveDietKey === "keto") {
    fatPct = 70;
  } else if (is_athlete && athletePhaseObj && athletePhaseObj.carb_loading_mode) {
    fatPct = 18;
  } else {
    const candidateFatPcts = [28];
    if (effectiveDietKey === "lowcarb") candidateFatPcts.push(35);
    if (hasFattyLiver || hasCholesterol) candidateFatPcts.push(22);
    if (hasHeart || hasHypertension) candidateFatPcts.push(25);
    if (is_athlete && athletePhaseObj) candidateFatPcts.push(athletePhaseObj.fat_pct || 25);
    fatPct = Math.min(...candidateFatPcts);
  }

  // Step 12: Carbohydrate, Fiber, and Water
  let fat_kcal = Math.round(targetCal * (fatPct / 100));
  let protein_kcal = protein_g * 4;
  let carb_kcal = Math.max(0, targetCal - protein_kcal - fat_kcal);

  if (hasDiabetes) {
    const maxDiabetesCarbKcal = Math.round(targetCal * 0.45);
    if (carb_kcal > maxDiabetesCarbKcal) {
      const excess = carb_kcal - maxDiabetesCarbKcal;
      carb_kcal = maxDiabetesCarbKcal;
      fat_kcal += excess;
    }
  }

  let carbs_g = Math.round(carb_kcal / 4);
  if (effectiveDietKey !== "keto" && carbs_g < 50) {
    carbs_g = 50;
    carb_kcal = 200;
    fat_kcal = Math.max(180, targetCal - protein_kcal - carb_kcal);
  }
  const fat_g = Math.round(fat_kcal / 9);
  const fiber_g = Math.round((targetCal / 1000) * 14);
  // CKD/dialysis fluid allowance depends on urine output, edema and medical instructions.
  const water_l = hasKidney ? null : clamp(round1(weight_kg * 0.035), 1.5, 3.8);
  if (hasKidney) warnings_fa.push("نیاز مایعات در بیماری کلیه یا دیالیز بدون اطلاعات بالینی قابل تعیین نیست؛ مقدار روزانه را از پزشک یا کارشناس بگیرید. پروتئین و پتاسیم نیز باید با مرحله بیماری و آزمایش‌ها شخصی‌سازی شوند.");
  if (stone && !hasKidney) warnings_fa.push("عدد آب نمایش‌داده‌شده تخمین عمومی است، نه هدف اختصاصی پیشگیری از سنگ؛ هدف مایعات با پزشک، آزمایش ادرار و محدودیت احتمالی مایعات تعیین شود.");
  if (is_athlete && hasKidney) warnings_fa.push("هم‌زمانی ورزش و بیماری کلیه: اولویت با محدودیت‌های کلیوی است؛ انرژی، پروتئین و مایعات با تیم درمان تنظیم شوند.");

  // Step 13-16: Meal Slots & LOCK_GROUP
  const lockGroupConditions = ["diabetes", "kidney", "pregnancy"];
  const is_slot_locked =
    conditions.some((c) => lockGroupConditions.includes(c)) ||
    effectiveGoal === "shock_plateau" ||
    effectiveDietKey.startsWith("fast");

  const userSlotsOk = profile.meal_slots_ok || {
    b: true,
    s1: true,
    l: true,
    s2: true,
    d: true,
    s3: true,
  };
  const userSlotsPct = profile.meal_slots_pct || { ...DEFAULT_SLOTS_PCT };

  const activeSlots = [];
  const allSlotIds = ["b", "s1", "l", "s2", "d", "s3"];

  for (const sid of allSlotIds) {
    if (sid === "s3" && hasReflux && !hasDiabetes) {
      warnings_fa.push(
        "به دلیل رفلاکس معده، میان‌وعده آخر شب (قبل از خواب) به طور خودکار حذف و کالری آن در وعده‌های روز توزیع شد."
      );
      continue;
    }
    const isMain = ["b", "l", "d"].includes(sid);
    const ticked = userSlotsOk[sid] !== false;
    if (ticked || isMain || is_slot_locked) {
      activeSlots.push({
        slot_id: sid,
        slot_type: SLOT_META[sid].slot_type,
        title_fa: SLOT_META[sid].title_fa,
        time_window_fa: SLOT_META[sid].time_window_fa,
        raw_pct: Number(userSlotsPct[sid]) || DEFAULT_SLOTS_PCT[sid],
        forced_quick_mode: !ticked && (isMain || is_slot_locked),
      });
    }
  }

  // Normalize percentages to 100%
  const rawSum = activeSlots.reduce((acc, s) => acc + s.raw_pct, 0) || 100;
  if (profile.meal_slots_pct && Math.abs(rawSum - 100) > 1) {
    warnings_fa.push("مجموع درصد وعده‌ها به طور خودکار به ۱۰۰٪ تراز شد.");
  }

  let runningCal = 0;
  let largestIdx = 0;
  for (let i = 0; i < activeSlots.length; i++) {
    const normPct = (activeSlots[i].raw_pct / rawSum) * 100;
    activeSlots[i].pct_of_day = Math.round(normPct);
    activeSlots[i].target_calories = round10((targetCal * normPct) / 100);
    runningCal += activeSlots[i].target_calories;
    if (activeSlots[i].target_calories > activeSlots[largestIdx].target_calories) {
      largestIdx = i;
    }
  }
  const diffCal = targetCal - runningCal;
  if (activeSlots.length > 0 && diffCal !== 0) {
    activeSlots[largestIdx].target_calories += diffCal;
  }

  // Step 17: Day 2 Shock Protocol (ONLY when effectiveGoal === 'shock_plateau')
  let day2_shock = null;
  if (effectiveGoal === "shock_plateau" || diet_pref === "fast16") {
    let fastHours = 16;
    let day2Cal = Math.max(floor, round10(targetCal * 0.6));
    let protocol_note_fa =
      "روز دوم شوک (فستینگ ۱۶:۸ و کالری ۶۰٪ با حفظ کف امنیتی متابولیک) جهت شکستن استپ وزنی";

    if (hasFastingBan) {
      fastHours = 0;
      day2Cal = Math.max(floor, round10(targetCal * 0.85));
      protocol_note_fa =
        "به دلیل شرایط پزشکی شما (منع فستینگ در دیابت/کلیه/نقرس/بارداری)، گرسنگی طولانی روز دوم لغو شد و به جای آن از تکنیک شیفت درشت‌مغذی کم‌کربوهیدرات استفاده گردید.";
      warnings_fa.push(protocol_note_fa);
    } else if (conditions.some((c) => ["insulin_resistance", "hypothyroid", "pcos"].includes(c))) {
      fastHours = 14;
      protocol_note_fa = "روز دوم شوک با فستینگ ملایم ۱۴:۱۰ متناسب با تیروئید / مقاومت به انسولین";
    }

    if (effectiveGoal === "shock_plateau") {
      day2_shock = {
        enabled: true,
        fastHours,
        day2Cal,
        protocol_note_fa,
      };
    } else {
      // Only fast16 diet_pref on regular goal: record fastHours for GV-6 assertion without forcing a 2-day shock UI
      day2_shock = {
        enabled: false,
        fastHours,
        day2Cal: targetCal,
        protocol_note_fa,
      };
    }
  }

  // Collect all Hard Bans and Soft Penalties
  const hard_bans = new Set([...allergies, ...restrictions]);
  const soft_penalties = new Set();
  const pos_boosts = new Set();

  for (const condKey of conditions) {
    const cObj = CONDITIONS[condKey];
    if (!cObj) continue;
    cObj.hard_bans.forEach((b) => hard_bans.add(b));
    cObj.soft_penalties.forEach((p) => soft_penalties.add(p));
    cObj.pos_boost.forEach((pb) => pos_boosts.add(pb));
  }

  if (effectiveDietKey === "vegetarian") {
    hard_bans.add("NEG_RED_MEAT");
    hard_bans.add("NEG_FISH");
    pos_boosts.add("POS_VEG");
  } else if (effectiveDietKey === "keto") {
    hard_bans.add("NEG_SUGAR");
    pos_boosts.add("POS_KETO");
  }

  if (stone === "stone_calcium_oxalate") hard_bans.add("NEG_STONE_OXALATE_HIGH");
  if (stone === "stone_uric_acid") hard_bans.add("NEG_STONE_PURINE_HIGH");
  if (stone) soft_penalties.add("NEG_HIGH_SALT");

  if (is_athlete && !hasKidney) {
    pos_boosts.add("POS_HIGH_PROTEIN");
    if (["lean_bulk", "heavy_bulk", "carb_loading"].includes(sport_phase)) {
      pos_boosts.add("POS_GAIN");
    }
  }

  const zero_oil_cooking = hasFattyLiver || hasCholesterol || hasHeart;

  // Build Athlete Pre/Post Workout Clinical Protocol if is_athlete
  let athlete_protocol = null;
  if (is_athlete) {
    const catObj = SPORT_CATEGORIES.find((c) => c.key === sport_category) || SPORT_CATEGORIES[0];
    const phaseObj = SPORT_PHASES[sport_phase] || SPORT_PHASES.lean_bulk;
    athlete_protocol = {
      sport_category_key: sport_category,
      sport_category_title_fa: catObj.title_fa,
      sport_phase_key: sport_phase,
      sport_phase_title_fa: phaseObj.title_fa,
      sport_phase_desc_fa: phaseObj.desc_fa,
      training_day_cal: targetCal,
      rest_day_cal: athlete_rest_day_cal ?? targetCal,
      pre_workout_guide_fa: hasKidney
        ? "وعده قبل تمرین را با رعایت محدودیت‌های کلیوی و مایعات با کارشناس هماهنگ کنید."
        : "قبل از تمرین بر اساس زمان، تحمل گوارشی و گزینه‌های مجاز برنامه، وعده‌ای حاوی کربوهیدرات انتخاب کنید؛ از غذاهای ناسازگار با آلرژی یا بیماری خود استفاده نکنید.",
      post_workout_guide_fa: hasKidney
        ? "پروتئین و کربوهیدرات پس از تمرین باید در محدوده برنامه کلیوی و با نظر کارشناس انتخاب شود."
        : "پس از تمرین وعده‌ای از گزینه‌های مجاز برنامه شامل کربوهیدرات و پروتئین انتخاب کنید. نیاز، زمان و مقدار بر اساس کل برنامه و تمرین متفاوت است.",
      hydration_electrolyte_fa: hasKidney
        ? "مایعات و الکترولیت‌ها فقط مطابق محدودیت و دستور تیم درمان تنظیم شوند."
        : "آب و الکترولیت‌ها را متناسب با مدت تمرین، تعریق، شرایط هوا و توصیه درمانی تنظیم کنید؛ نمک یا مکمل را خودسرانه اضافه نکنید.",
    };
  }

  return {
    gender,
    age,
    height_cm,
    weight_kg,
    bmi,
    ideal_weight_min,
    ideal_weight_max,
    ideal_weight_mid,
    bmr,
    tdee,
    targetCal,
    effectiveGoal,
    effectiveDietKey,
    protein_g,
    fat_g,
    carbs_g,
    fiber_g,
    water_l,
    is_slot_locked,
    zero_oil_cooking,
    is_dialysis,
    is_athlete,
    athlete_protocol,
    athlete_rest_day_cal,
    body_comp_summary,
    activeSlots,
    day2_shock,
    hard_bans: Array.from(hard_bans),
    soft_penalties: Array.from(soft_penalties),
    pos_boosts: Array.from(pos_boosts),
    warnings_fa,
    red_flag_stop,
    red_flag_reason_fa,
  };
}
