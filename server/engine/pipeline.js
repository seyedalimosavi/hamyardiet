// server/engine/pipeline.js — 24-Step Clinical Regimen Pipeline & Non-Repeating Option Engine

import fs from "node:fs";
import path from "node:path";
import { normalizeFa, toFaDigits } from "../../shared/persian.js";
import { calculateClinicalMetrics, scanX, round10 } from "./clinicalRules.js";
import { isRestrictedAutomaticMeal } from "./searchPolicy.js";
import {
  scaleIngredientText,
  buildGrainBox,
  buildOilBox,
  buildPrintCompactLine,
} from "./scaler.js";

let cachedSeedData = null;

export function getSeedData() {
  if (cachedSeedData) return cachedSeedData;
  const seedPath = path.join(process.cwd(), "seed-data.json");
  const raw = fs.readFileSync(seedPath, "utf-8");
  const parsed = JSON.parse(raw);

  const extensionPath = path.join(process.cwd(), "data", "renal-athlete-meals.json");
  if (fs.existsSync(extensionPath)) parsed.meals.push(...JSON.parse(fs.readFileSync(extensionPath, "utf-8")));

  const searchRecipesPath = path.join(process.cwd(), "data", "search-adapted-recipes.json");
  if (fs.existsSync(searchRecipesPath)) parsed.meals.push(...JSON.parse(fs.readFileSync(searchRecipesPath, "utf-8")));

  // Precompute final neg_tags = UNION(scanX, neg_tags)
  parsed.meals = parsed.meals.map((m) => {
    const scanned = scanX(`${m.name || ""} ${m.ingredients_desc || ""}`);
    const finalNeg = Array.from(new Set([...(m.neg_tags || []), ...scanned]));
    return {
      ...m,
      neg_tags_final: finalNeg,
    };
  });

  cachedSeedData = parsed;
  return cachedSeedData;
}

/**
 * Extract normalized base dish signature to prevent near-duplicate dishes
 * (e.g. "زرشک پلو با مرغ — سبک" and "زرشک پلو با مرغ — استاندارد") from appearing together
 */
export function getDishBaseSignature(mealName) {
  const norm = normalizeFa(mealName || "").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/‌/g, " ");
  // Families override superficial adjectives and different presentations of the same dish.
  const families = [
    /عدس\s*پلو/, /لوبیا\s*پلو/, /زرشک\s*پلو/,
    /(عدسی|خوراک عدس|سوپ عدس|دال عدس|عدس پخته)/,
    /(املت|نیمرو)/, /(خوراک لوبیا|لوبیا چیتی)/,
    /(ماکارونی|پاستا)/, /پیتزا/, /لازانیا/, /کتلت/, /کوکو سبزی/, /کوکو سیب زمینی/,
  ];
  const family = families.find((r) => r.test(norm));
  if (family) return String(family);
  return norm.replace(/[-—–].*$/, "").replace(/(سبک|استاندارد|مجلسی|حجیم|رژیمی|کامل|دیابتی|کتو|باشگاهی|ویژه|خانگی|کم روغن|کم چرب)/g, "").replace(/\s+/g, " ").trim().slice(0, 22);
}

/**
 * Build a human-friendly clinical explanation ("چرا این گزینه برای شما انتخاب شد؟")
 */
function buildWhyChosenFa(meal, profile, metrics) {
  const reasons = [];
  const conditions = profile.conditions || [];
  if (profile.is_athlete) {
    if (profile.sport_phase === "carb_loading") {
      reasons.push("تامین کربوهیدرات باکیفیت جهت پر کردن ذخایر گلیکوژن عضلات پیش از رقابت");
    } else if (profile.sport_phase === "cut_definition" || profile.sport_phase === "weight_make") {
      reasons.push("گزینه‌ای برای بررسی در برنامه ورزشی؛ مقدار پروتئین کل روز باید جداگانه کنترل شود");
    } else {
      reasons.push("مناسب برای ریکاوری و سنتز پروتئین عضلانی ورزشکار");
    }
  }
  if (conditions.includes("fatty_liver") || conditions.includes("cholesterol")) {
    reasons.push("گزینه‌ای برای بررسی در الگوی غذایی کم‌چربی اشباع");
  }
  if (conditions.includes("diabetes") || conditions.includes("insulin_resistance") || conditions.includes("pcos")) {
    reasons.push("گزینه‌ای برای بررسی در الگوی غذایی کنترل قند؛ سهم و پاسخ فردی اهمیت دارد");
  }
  if (conditions.includes("kidney")) {
    reasons.push(
      "گزینه اولیه برای بررسی در برنامه کلیوی؛ میزان پروتئین و مواد معدنی باید با آزمایش و نسخه فردی بررسی شود"
    );
  }
  if (reasons.length === 0) {
    reasons.push("تامین متوازن انرژی، پروتئین و ریزمغذی‌ها بر پایه سفره ایرانی");
  }
  return reasons.join(" • ");
}

/**
 * Format a single meal record into a scaled SlotOption
 */
export function formatMealAsOption(meal, slotId, slotTargetCalories, profile, metrics, source = "auto") {
  const baseCal = Math.max(50, Number(meal.base_calories) || 250);
  const scaleFactor = meal.fixed_portion ? 1 : Math.max(0.45, Math.min(2.2, slotTargetCalories / baseCal));

  let scaled_ingredients_fa = meal.fixed_portion ? toFaDigits(meal.ingredients_desc) : scaleIngredientText(meal.ingredients_desc, scaleFactor, {
    zeroOil: false,
    isDialysis: Boolean(profile.is_dialysis),
  });

  // The seed uses “۱ سیب” without a count unit, which the generic scaler cannot scale.
  // Keep that portion and its estimate in sync instead of displaying the slot budget.
  const appleOnly = /سیب متوسط با دارچین/.test(meal.name || "");
  if (appleOnly) scaled_ingredients_fa = scaled_ingredients_fa.replace(/۱ سیب/, "۱ عدد سیب");

  const grain_box = meal.search_only ? null : buildGrainBox(meal, scaleFactor, slotId, Boolean(profile.is_dialysis));
  const oil_box = buildOilBox(meal, metrics, slotId);

  // Clean title if it's overly long or has trailing punctuation
  const cleanTitle = toFaDigits(String(meal.name || "").replace(/\s*\(باقیمانده شام!\)/g, "").trim());

  const print_compact_line_fa = buildPrintCompactLine({
    title_fa: cleanTitle,
    scaled_ingredients_fa,
    grain_box,
    oil_box,
  });

  return {
    option_id: `${slotId}_${meal.code}_${Math.random().toString(36).slice(2, 6)}`,
    meal_code: meal.code,
    source,
    title_fa: cleanTitle,
    scaled_ingredients_fa,
    print_compact_line_fa,
    final_calories: appleOnly ? baseCal : Math.round(baseCal * scaleFactor),
    grain_box,
    oil_box,
    why_chosen_fa: buildWhyChosenFa(meal, profile, metrics),
    soft_warnings_fa: meal.search_only ? ["این دستور پیشنهادی با سهم ثابت و کالری تقریبی است؛ با آزمایش‌ها، آلرژی و برنامه فردی باید توسط کارشناس بررسی شود."] : [],
    preparation_fa: meal.preparation_fa || null,
    is_approved: false,
  };
}

/**
 * Rank and select diverse, non-repeating candidates for a slot
 */
export function selectCandidatesForSlot({
  allMeals,
  slotId,
  slotType,
  slotCal,
  profile,
  metrics,
  count = 3,
  strictExcludeCodes = new Set(),
  strictExcludeSignatures = new Set(),
  softRejectedCodes = new Set(),
}) {
  const dislikedList = (profile.disliked_foods || [])
    .map((d) => normalizeFa(d))
    .filter(Boolean);

  const hardBans = new Set(metrics.hard_bans || []);
  const softPenalties = new Set(metrics.soft_penalties || []);
  const posBoosts = new Set(metrics.pos_boosts || []);

  // Filter step: 100% respect Hard Bans and disliked foods
  const safePool = allMeals.filter((m) => {
    if (m.slot_type !== slotType || isRestrictedAutomaticMeal(m, profile)) return false;
    const negs = [...(m.neg_tags_final || m.neg_tags || []), ...scanX(`${m.name} ${m.ingredients_desc}`)];
    for (const hb of hardBans) {
      if (negs.includes(hb)) return false;
    }
    const normDesc = normalizeFa(`${m.name} ${m.ingredients_desc}`);
    for (const dis of dislikedList) {
      if (dis && normDesc.includes(dis)) return false;
    }
    // In dialysis/kidney, strictly avoid tomato paste or high potassium
    if ((profile.conditions || []).includes("kidney") && normDesc.includes("رب گوجه")) {
      return false;
    }
    return true;
  });

  // Score each safe candidate
  const scored = safePool.map((m) => {
    const baseCal = Number(m.base_calories) || 250;
    const calDiffRatio = Math.abs(baseCal - slotCal) / Math.max(100, slotCal);
    const inIdealScaleRange = baseCal >= 0.45 * slotCal && baseCal <= 2.1 * slotCal;

    const negs = m.neg_tags_final || m.neg_tags || [];
    const pos = m.pos_tags || [];

    let softHits = 0;
    for (const sp of softPenalties) {
      if (negs.includes(sp)) softHits++;
    }

    let matchedPos = 0;
    for (const pb of posBoosts) {
      if (pos.includes(pb)) matchedPos++;
    }

    // Athlete phase specific scoring
    let athleteBoost = 0;
    const normDesc = normalizeFa(`${m.name} ${m.ingredients_desc}`);
    if (profile.is_athlete && !(profile.conditions || []).includes("kidney")) {
      if (profile.sport_phase === "carb_loading") {
        if (/(برنج|ماکارونی|پاستا|سیب زمینی|جو دوسر|موز|عسل|فرنی)/.test(normDesc)) {
          athleteBoost += 25;
        }
      } else if (profile.sport_phase === "cut_definition" || profile.sport_phase === "weight_make") {
        if (/(سینه مرغ|سفیده|ماهی|بوقلمون|توفو)/.test(normDesc)) {
          athleteBoost += 22;
        }
      } else {
        if (pos.includes("POS_HIGH_PROTEIN")) athleteBoost += 15;
      }
    }

    const score =
      100 -
      calDiffRatio * 40 -
      18 * softHits +
      12 * matchedPos +
      (m.is_popular ? 10 : 0) +
      (inIdealScaleRange ? 15 : -25) +
      athleteBoost +
      ((m.focus === "renal" && (profile.conditions || []).includes("kidney")) || (m.focus === "athlete" && profile.is_athlete && !(profile.conditions || []).includes("kidney")) ? 18 : 0);

    return {
      meal: m,
      score,
      signature: getDishBaseSignature(m.name),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const chosen = [];
  const usedCodes = new Set(strictExcludeCodes);
  const usedSignatures = new Set(strictExcludeSignatures);
  const rejectedSignatures = new Set(allMeals.filter(m => softRejectedCodes.has(m.code)).map(m => getDishBaseSignature(m.name)));

  // Pass 1: Strictly exclude current codes, current signatures, AND all rejected history
  for (const item of scored) {
    if (chosen.length >= count) break;
    if (usedCodes.has(item.meal.code)) continue;
    if (softRejectedCodes.has(item.meal.code)) continue;
    if (usedSignatures.has(item.signature) || rejectedSignatures.has(item.signature)) continue;

    chosen.push(item.meal);
    usedCodes.add(item.meal.code);
    usedSignatures.add(item.signature);
  }

  // Pass 2: If still need more (e.g. narrow medical diet), allow same signature if code is unseen & not rejected
  if (chosen.length < count && softRejectedCodes.size >= 20) {
    for (const item of scored) {
      if (chosen.length >= count) break;
      if (usedCodes.has(item.meal.code) || strictExcludeSignatures.has(item.signature)) continue;
      if (softRejectedCodes.has(item.meal.code)) continue;
      chosen.push(item.meal);
      usedCodes.add(item.meal.code);
    }
  }

  // Pass 3: Only if user rejected literally every single dish in the database for this slot, allow older rejected ones except what's currently on screen
  if (chosen.length < count && softRejectedCodes.size >= 20) {
    for (const item of scored) {
      if (chosen.length >= count) break;
      if (strictExcludeCodes.has(item.meal.code) || strictExcludeSignatures.has(item.signature)) continue;
      if (usedCodes.has(item.meal.code)) continue;
      chosen.push(item.meal);
      usedCodes.add(item.meal.code);
    }
  }

  return chosen.map((m) => formatMealAsOption(m, slotId, slotCal, profile, metrics, "auto"));
}

/**
 * Build Condition-Specific Fruit Exchange Box & 5 Golden Clinical Tips for the Print Sheet
 */
export function buildClinicalPrintFooter(profile, metrics) {
  const conditions = profile.conditions || [];
  const isDialysis = Boolean(profile.is_dialysis);
  const hasKidney = conditions.includes("kidney") || isDialysis;
  const hasDiabetes = conditions.includes("diabetes") || conditions.includes("insulin_resistance") || conditions.includes("pcos");
  const hasFattyLiver = conditions.includes("fatty_liver");

  let fruit_unit_box_fa;
  if (hasKidney) {
    fruit_unit_box_fa =
      "🍏 انتخاب میوه و سبزی در بیماری کلیه بر اساس آزمایش پتاسیم، مقدار مصرف و نظر تیم درمان است؛ هیچ فهرست ثابتی برای همه بیماران مناسب نیست.";
  } else if (hasDiabetes || hasFattyLiver) {
    fruit_unit_box_fa =
      "🍏 تعریف ۱ واحد میوه مجاز (شاخص گلیسمی کنترل‌شده): ۱ عدد سیب، گلابی، هلو یا شلیل متوسط با پوست | ۲ عدد کیوی یا نارنگی متوسط | ۱ لیوان توت‌فرنگی یا آلبالو | ۳ عدد زردآلو. (⚠️ قانون طلایی خرما در کبد چرب و قند خون: از مصرف خرما، موز رسیده و آبمیوه در حالت ناشتا یا میان‌وعده خالی خودداری فرمایید؛ در صورت تمایل حداکثر ۱ تا ۲ عدد خرما بلافاصله پس از وعده ناهار میل شود).";
  } else {
    fruit_unit_box_fa =
      "🍏 تعریف هر ۱ واحد میوه مجاز در برنامه: ۱ عدد سیب یا پرتقال یا هلو متوسط | ۲ عدد نارنگی یا کیوی متوسط | ۱ لیوان هندوانه، طالبی یا توت‌فرنگی | ۱۲ عدد گیلاس | ۱۵ حبه انگور | ۳ عدد خرما یا زردآلو متوسط (همیشه خودِ میوه کامل جویده شود و از آبمیوه پرهیز گردد).";
  }

  const golden_tips_fa = [
    "۱. قانون طلایی ترتیب مصرف در وعده اصلی (کنترل قند، انسولین و چربی کبد): ابتدا نیمی از بشقاب سبزیجات/سالاد ← سپس سهم پروتئین (مرغ/گوشت/ماهی/تخم‌مرغ) ← و در انتها کربوهیدرات (نان یا برنج) میل شود.",
    "۲. مدیریت جذب آهن و کلسیم: چای، قهوه و دمنوش‌ها را حداقل ۱ ساعت قبل یا ۱.۵ تا ۲ ساعت بعد از وعده‌های اصلی میل کنید. مکمل آهن هرگز همزمان با شیر، ماست و لبنیات مصرف نشود.",
    "۳. پروتکل نمک یددار و چاشنی‌های طبیعی: نمک تصفیه‌شده یددار را به مقدار کم در ۱۰ دقیقه پایانی پخت اضافه کنید، نمکدان را از سفره بردارید و از آبلیمو تازه، آبغوره بی‌نمک، سماق، پودر سیر، زیره و آویشن استفاده نمایید.",
    "۴. قانون میوه کامل و تکنیک جویدن: پیام سیری حدود ۲۰ دقیقه زمان می‌برد؛ هر لقمه را ۱۵ تا ۲۰ بار بجوید و همیشه میوه کامل را به جای آبمیوه مصرف کنید.",
  ];

  if (conditions.includes("hypothyroid")) {
    golden_tips_fa.push(
      "۵. نکته ویژه کم‌کاری تیروئید: قرص لووتیروکسین را صبح ناشتا با ۱ لیوان آب میل کرده و تا ۳۰ الی ۶۰ دقیقه بعد هیچ ماده غذایی نخورید (فاصله ۴ ساعته با قرص آهن، کلسیم و سویا رعایت شود)."
    );
  } else if (profile.is_athlete) {
    golden_tips_fa.push(
      "۵. وعده‌های تمرین و ریکاوری را با شرایط گوارشی، برنامه روزانه و بیماری‌های همراه هماهنگ کنید؛ خواب کافی نیز مهم است."
    );
  } else if (hasFattyLiver) {
    golden_tips_fa.push(
      "۵. نکته ویژه کبد چرب: شام را حداکثر تا ساعت ۲۰:۳۰ الی ۲۱:۰۰ میل فرمایید تا کبد در طول ۱۰ تا ۱۲ ساعت ناشتایی شبانه فرصت پاک‌سازی چربی‌های رسوب‌کرده را داشته باشد."
    );
  } else {
    golden_tips_fa.push(
      "۵. پایش هوشمند وزن: هفته‌ای یک‌بار صبح ناشتا (پس از تخلیه مثانه و با لباس سبک) وزن خود را ثبت کنید؛ ملاک موفقیت، کاهش سایز دور کمر و پایداری عادات غذایی است."
    );
  }

  return {
    fruit_unit_box_fa,
    golden_tips_fa,
  };
}

/**
 * Generate 7-Day Rotating Weekly Schedule & Categorized Shopping List
 */
export function buildWeeklyScheduleAndShoppingList(day1Slots) {
  const daysFa = [
    "شنبه",
    "یکشنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنج‌شنبه",
    "جمعه",
  ];

  const weekly_days = daysFa.map((dayName, dayIdx) => {
    const mealsForDay = day1Slots.map((slot) => {
      const opts = slot.options || [];
      const chosenOpt = opts[dayIdx % Math.max(1, opts.length)] || opts[0];
      return {
        slot_id: slot.slot_id,
        slot_title_fa: slot.title_fa,
        target_calories: slot.target_calories,
        option_title_fa: chosenOpt ? chosenOpt.title_fa : "—",
        compact_line_fa: chosenOpt ? chosenOpt.scaled_ingredients_fa : "—",
      };
    });
    return {
      day_index: dayIdx + 1,
      day_name_fa: dayName,
      slots: mealsForDay,
    };
  });

  // Aggregate shopping list categories from selected options
  const categories = {
    "پروتئین، گوشت، مرغ، ماهی و تخم‌مرغ": new Set(),
    "لبنیات کم‌چرب": new Set(),
    "نان، برنج، غلات و حبوبات": new Set(),
    "میوه، سبزیجات تازه و صیفی‌جات": new Set(),
    "مغزها، دانه‌ها و روغن‌های سالم": new Set(),
  };

  for (const slot of day1Slots) {
    for (const opt of slot.options || []) {
      const desc = opt.scaled_ingredients_fa || "";
      if (/(مرغ|گوشت|ماهی|بوقلمون|تخم‌مرغ|سفیده|میگو|تن ماهی)/.test(desc)) {
        categories["پروتئین، گوشت، مرغ، ماهی و تخم‌مرغ"].add(
          `${opt.title_fa}: ${desc.split("+")[0].trim()}`
        );
      }
      if (/(شیر|ماست|پنیر|دوغ|کشک)/.test(desc)) {
        categories["لبنیات کم‌چرب"].add(
          desc.match(/[^+]*?(?:شیر|ماست|پنیر|دوغ|کشک)[^+]*/)?.[0]?.trim() || "لبنیات کم‌چرب"
        );
      }
      if (/(نان|سنگک|بربری|لواش|تافتون|برنج|جو دوسر|عدس|لوبیا|لپه|نخود|ماکارونی|پاستا)/.test(desc)) {
        categories["نان، برنج، غلات و حبوبات"].add(
          desc.match(/[^+]*?(?:نان|سنگک|بربری|لواش|تافتون|برنج|جو دوسر|عدس|لوبیا|ماکارونی)[^+]*/)?.[0]?.trim() ||
            "نان سبوس‌دار و برنج"
        );
      }
      if (/(گردو|بادام|زیتون|کنجد|پسته)/.test(desc) || opt.oil_box) {
        categories["مغزها، دانه‌ها و روغن‌های سالم"].add(`${opt.title_fa}: طبق مواد همان گزینه`);
      }
    }
  }
  categories["میوه، سبزیجات تازه و صیفی‌جات"].add("میوه و سبزیجات را فقط مطابق گزینه‌های انتخاب‌شده و محدودیت‌های فردی تهیه کنید.");

  const shopping_list = Object.entries(categories).map(([cat, set]) => ({
    category_fa: cat,
    items: Array.from(set).slice(0, 8),
  }));

  return {
    weekly_days,
    shopping_list,
  };
}

/**
 * Full 24-Step Regimen Generation Pipeline
 */
export function generateRegimenPipeline(profile, optionsPerSlot = 3) {
  const seed = getSeedData();
  const metrics = calculateClinicalMetrics(profile);

  const usedGlobalCodes = new Set();
  const usedGlobalSignatures = new Set();

  // Build Day 1 Slots (Standard Daily Multi-Option Plan, or Training Day for Athletes)
  const day1_slots = metrics.activeSlots.map((slot) => {
    const options = selectCandidatesForSlot({
      allMeals: seed.meals,
      slotId: slot.slot_id,
      slotType: slot.slot_type,
      slotCal: slot.target_calories,
      profile,
      metrics,
      count: optionsPerSlot,
      strictExcludeCodes: usedGlobalCodes,
      strictExcludeSignatures: usedGlobalSignatures,
    });

    for (const opt of options) {
      usedGlobalCodes.add(opt.meal_code);
      usedGlobalSignatures.add(getDishBaseSignature(opt.title_fa));
    }

    return {
      slot_id: slot.slot_id,
      slot_type: slot.slot_type,
      title_fa: slot.title_fa,
      time_window_fa: slot.time_window_fa,
      pct_of_day: slot.pct_of_day,
      target_calories: slot.target_calories,
      forced_quick_mode: slot.forced_quick_mode,
      options,
    };
  });

  // Build Day 2 Shock Slots ONLY when effectiveGoal === 'shock_plateau'
  let day2_shock_plan = null;
  if (metrics.effectiveGoal === "shock_plateau" && metrics.day2_shock?.enabled) {
    const day2Cal = metrics.day2_shock.day2Cal;
    const ratio = day2Cal / Math.max(1000, metrics.targetCal);

    // Filter out breakfast or late snack if 16:8 fasting is active
    const shockActiveSlots =
      metrics.day2_shock.fastHours >= 14
        ? metrics.activeSlots.filter((s) => s.slot_id !== "s3")
        : metrics.activeSlots;

    const rawSum = shockActiveSlots.reduce((a, b) => a + b.raw_pct, 0) || 100;
    let runCal = 0;
    const d2Slots = shockActiveSlots.map((slot, idx) => {
      const sCal =
        idx === shockActiveSlots.length - 1
          ? Math.max(80, day2Cal - runCal)
          : round10((day2Cal * slot.raw_pct) / rawSum);
      runCal += sCal;

      const opts = selectCandidatesForSlot({
        allMeals: seed.meals,
        slotId: slot.slot_id,
        slotType: slot.slot_type,
        slotCal: sCal,
        profile: { ...profile, diet_pref: "high_protein" },
        metrics,
        count: Math.min(2, optionsPerSlot),
        strictExcludeCodes: usedGlobalCodes,
        strictExcludeSignatures: new Set(),
      });

      return {
        slot_id: slot.slot_id,
        slot_type: slot.slot_type,
        title_fa:
          idx === 0 && metrics.day2_shock.fastHours > 0
            ? `${slot.title_fa} (شکستن فستینگ)`
            : slot.title_fa,
        time_window_fa: slot.time_window_fa,
        pct_of_day: Math.round((slot.raw_pct / rawSum) * 100),
        target_calories: sCal,
        forced_quick_mode: slot.forced_quick_mode,
        options: opts,
      };
    });

    day2_shock_plan = {
      ...metrics.day2_shock,
      ratio,
      slots: d2Slots,
    };
  } else if (metrics.day2_shock) {
    day2_shock_plan = {
      ...metrics.day2_shock,
      slots: [],
    };
  }

  // Build Athlete Rest / Recovery Day Slots when profile.is_athlete === true
  let athlete_rest_day_plan = null;
  if (profile.is_athlete && metrics.athlete_rest_day_cal) {
    const restCal = metrics.athlete_rest_day_cal;
    const rawSum = metrics.activeSlots.reduce((a, b) => a + b.raw_pct, 0) || 100;
    let runRest = 0;

    const restSlots = metrics.activeSlots.map((slot, idx) => {
      const sCal =
        idx === metrics.activeSlots.length - 1
          ? Math.max(80, restCal - runRest)
          : round10((restCal * slot.raw_pct) / rawSum);
      runRest += sCal;

      const opts = selectCandidatesForSlot({
        allMeals: seed.meals,
        slotId: slot.slot_id,
        slotType: slot.slot_type,
        slotCal: sCal,
        profile: { ...profile, diet_pref: "lowcarb" },
        metrics,
        count: Math.min(2, optionsPerSlot),
        strictExcludeCodes: usedGlobalCodes,
        strictExcludeSignatures: new Set(),
      });

      return {
        slot_id: slot.slot_id,
        slot_type: slot.slot_type,
        title_fa: `${slot.title_fa} (روز غیرتمرینی / ریکاوری)`,
        time_window_fa: slot.time_window_fa,
        pct_of_day: Math.round((slot.raw_pct / rawSum) * 100),
        target_calories: sCal,
        forced_quick_mode: false,
        options: opts,
      };
    });

    athlete_rest_day_plan = {
      enabled: true,
      rest_day_calories: restCal,
      note_fa:
        "در روزهای استراحت و غیرتمرینی، کالری از طریق کاهش کربوهیدرات‌های ساده تنظیم شده اما سهم پروتئین برای ترمیم و رشد تارهای عضلانی کاملاً حفظ گردیده است.",
      slots: restSlots,
    };
  }

  // Step 23: Treat Allowance
  const hasDiabetes = (profile.conditions || []).includes("diabetes");
  const isKeto = metrics.effectiveDietKey === "keto";
  let treat_allowance;
  if (hasDiabetes || isKeto) {
    treat_allowance = {
      enabled: false,
      times_per_week: 0,
      kcal_per_treat: 0,
      reason_fa: hasDiabetes
        ? "به دلیل دیابت و اهمیت ثبات قند خون، سهمیه تفریحی قندی غیرفعال است (می‌توانید از شکلات تلخ بالای ۸۵٪ بدون شکر یا میوه‌های کم‌قند استفاده نمایید)."
        : "در رژیم کتوژنیک به دلیل حفظ وضعیت کتوزیس، سهمیه قندی غیرفعال است.",
      suggestions_fa: [],
    };
  } else {
    const treatKcal = Math.min(150, round10(metrics.targetCal * 0.08));
    treat_allowance = {
      enabled: true,
      times_per_week: 2,
      kcal_per_treat: treatKcal,
      reason_fa: `حداکثر ۲ بار در هفته (هر نوبت تا سقف ${toFaDigits(treatKcal)} کالری) ترجیحاً بعد از وعده ناهار می‌توانید یکی از گزینه‌های زیر را بدون عذاب وجدان میل کنید:`,
      suggestions_fa: [
        `۲ مربع شکلات تلخ بالای ۷۵٪ (حدود ۲۰ گرم) همراه با چای یا قهوه`,
        `۱ اسکوپ کوچک بستنی ساده یا وانیلی (بعد از ناهار)`,
        `۱ عدد بیسکویت ساقه‌طلایی یا ۲ عدد پتی‌بور با چای دارچین`,
      ],
    };
  }

  const printFooter = buildClinicalPrintFooter(profile, metrics);
  const { weekly_days, shopping_list } = buildWeeklyScheduleAndShoppingList(day1_slots);

  const tracking_code = `DP-1405-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    tracking_code,
    status: metrics.red_flag_stop ? "PROFESSIONAL_REVIEW_REQUIRED" : "FINAL_ACTIVE",
    calculated_metrics: {
      ...metrics,
      fruit_unit_box_fa: printFooter.fruit_unit_box_fa,
      golden_tips_fa: printFooter.golden_tips_fa,
    },
    day1_slots,
    day2_shock: day2_shock_plan,
    athlete_rest_day: athlete_rest_day_plan,
    treat_allowance,
    weekly_schedule: {
      weekly_days,
      shopping_list,
    },
    rejected_meal_codes: Array.from(usedGlobalCodes),
    approved_meal_codes: [],
  };
}
