// server/engine/bodyFat.js — Validated Scientific Body Fat % & Lean Body Mass Calculators

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function round1(val) {
  return Math.round(val * 10) / 10;
}

/**
 * 1. U.S. Navy / Military Circumference Method (Hodgdon & Beckett)
 * Measurements in cm
 */
export function calcBodyFatNavy({ gender, height_cm, waist_cm, neck_cm, hip_cm = 0 }) {
  const h = Number(height_cm) || 170;
  const w = Number(waist_cm) || 85;
  const n = Number(neck_cm) || 38;
  const hip = Number(hip_cm) || 95;

  if (gender === "male") {
    const diff = Math.max(10, w - n);
    const bf =
      495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(h)) - 450;
    return round1(clamp(bf, 4, 55));
  } else {
    const sum = Math.max(20, w + hip - n);
    const bf =
      495 / (1.29579 - 0.35004 * Math.log10(sum) + 0.221 * Math.log10(h)) - 450;
    return round1(clamp(bf, 8, 60));
  }
}

/**
 * 2. Jackson-Pollock 3-Site Skinfold Method (in mm) + Siri Equation
 * Male sites: chest_mm, abdomen_mm, thigh_mm
 * Female sites: triceps_mm, suprailiac_mm, thigh_mm
 */
export function calcBodyFatJacksonPollock3({
  gender,
  age,
  chest_mm = 12,
  abdomen_mm = 20,
  thigh_mm = 15,
  triceps_mm = 16,
  suprailiac_mm = 18,
}) {
  const a = Number(age) || 30;
  let bodyDensity;
  if (gender === "male") {
    const sum3 = Math.max(9, Number(chest_mm) + Number(abdomen_mm) + Number(thigh_mm));
    bodyDensity =
      1.10938 - 0.0008267 * sum3 + 0.0000016 * sum3 * sum3 - 0.0002574 * a;
  } else {
    const sum3 = Math.max(9, Number(triceps_mm) + Number(suprailiac_mm) + Number(thigh_mm));
    bodyDensity =
      1.0994921 - 0.0009929 * sum3 + 0.0000023 * sum3 * sum3 - 0.0001392 * a;
  }
  const bf = 495 / bodyDensity - 450;
  return round1(clamp(bf, 4, 55));
}

/**
 * 3. Durnin-Womersley 4-Site Skinfold Method (in mm)
 * Sites: biceps_mm, triceps_mm, subscapular_mm, suprailiac_mm
 */
export function calcBodyFatDurnin4({
  gender,
  age,
  biceps_mm = 8,
  triceps_mm = 14,
  subscapular_mm = 15,
  suprailiac_mm = 16,
}) {
  const a = Number(age) || 30;
  const sum4 = Math.max(
    12,
    Number(biceps_mm) + Number(triceps_mm) + Number(subscapular_mm) + Number(suprailiac_mm)
  );
  const logSum = Math.log10(sum4);
  let c, m;
  if (gender === "male") {
    if (a < 20) { c = 1.1620; m = 0.0630; }
    else if (a < 30) { c = 1.1631; m = 0.0632; }
    else if (a < 40) { c = 1.1422; m = 0.0544; }
    else if (a < 50) { c = 1.1620; m = 0.0700; }
    else { c = 1.1715; m = 0.0779; }
  } else {
    if (a < 20) { c = 1.1549; m = 0.0678; }
    else if (a < 30) { c = 1.1599; m = 0.0717; }
    else if (a < 40) { c = 1.1423; m = 0.0632; }
    else if (a < 50) { c = 1.1333; m = 0.0612; }
    else { c = 1.1339; m = 0.0645; }
  }
  const density = c - m * logSum;
  const bf = 495 / density - 450;
  return round1(clamp(bf, 4, 55));
}

/**
 * 4. Deurenberg BMI-based Estimation (for general users without caliper/tape)
 */
export function calcBodyFatBMI({ gender, age, height_cm, weight_kg }) {
  const h = (Number(height_cm) || 170) / 100;
  const w = Number(weight_kg) || 70;
  const a = Number(age) || 30;
  const bmi = w / (h * h);
  const sexFlag = gender === "male" ? 1 : 0;
  const bf = 1.2 * bmi + 0.23 * a - 10.8 * sexFlag - 5.4;
  return round1(clamp(bf, 5, 55));
}

/**
 * Full Body Composition Summary (LBM, Fat Mass, FFMI, Category, Katch-McArdle & Cunningham BMR)
 */
export function analyzeBodyComposition({ gender, weight_kg, height_cm, body_fat_pct, is_athlete = false }) {
  const w = Number(weight_kg) || 70;
  const h = (Number(height_cm) || 170) / 100;
  const bf = clamp(Number(body_fat_pct) || 20, 4, 60);

  const fat_mass_kg = round1(w * (bf / 100));
  const lbm_kg = round1(w - fat_mass_kg);
  const ffmi = round1(lbm_kg / (h * h));

  // Katch-McArdle BMR = 370 + 21.6 * LBM
  const bmr_katch_mcardle = Math.round(370 + 21.6 * lbm_kg);
  // Cunningham BMR (specialized for athletes with higher muscle metabolism) = 500 + 22 * LBM
  const bmr_cunningham = Math.round(500 + 22 * lbm_kg);

  let category_fa = "نرمال و متناسب";
  if (gender === "male") {
    if (bf < 8) category_fa = "چربی بسیار پایین (آمادگی استیج / مسابقه)";
    else if (bf <= 14) category_fa = "سطح ورزشکاری و تفکیک عضلانی (Athletic)";
    else if (bf <= 18) category_fa = "تناسب اندام عالی (Fitness)";
    else if (bf <= 24) category_fa = "محدوده نرمال و سالم";
    else category_fa = "دارای چربی اضافه (نیازمند کاهش درصد چربی)";
  } else {
    if (bf < 14) category_fa = "چربی بسیار پایین (سطح قهرمانی)";
    else if (bf <= 20) category_fa = "سطح ورزشکاری (Athletic)";
    else if (bf <= 24) category_fa = "تناسب اندام عالی (Fitness)";
    else if (bf <= 31) category_fa = "محدوده نرمال و سالم";
    else category_fa = "دارای چربی اضافه (نیازمند کاهش درصد چربی)";
  }

  return {
    body_fat_pct: bf,
    fat_mass_kg,
    lbm_kg,
    ffmi,
    bmr_katch_mcardle,
    bmr_cunningham,
    recommended_bmr: is_athlete ? bmr_cunningham : bmr_katch_mcardle,
    category_fa,
  };
}
