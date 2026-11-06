// tests/clinical-golden.test.mjs — Golden Test Vectors (GV-1..GV-8) & Clinical Engine Verification

import test from "node:test";
import assert from "node:assert/strict";
import { calculateClinicalMetrics, scanX } from "../server/engine/clinicalRules.js";
import {
  scaleIngredientText,
  buildGrainBox,
  buildOilBox,
  validateManualFoodSelection,
} from "../server/engine/scaler.js";
import {
  getSeedData,
  generateRegimenPipeline,
  selectCandidatesForSlot,
  getDishBaseSignature,
} from "../server/engine/pipeline.js";
import { generateCookingGuide } from "../server/engine/cookingGuide.js";
import {
  calcBodyFatNavy,
  calcBodyFatJacksonPollock3,
  calcBodyFatDurnin4,
  analyzeBodyComposition,
} from "../server/engine/bodyFat.js";
import { PLANS_SEED } from "../shared/constants.js";

test("Seed Data Integrity: 626 meals, 432 general_foods with unique slugs, 7 plans", () => {
  const seed = getSeedData();
  assert.ok(seed.meals.length >= 626, "Base meal bank must remain intact");
  assert.equal(seed.general_foods.length, 432, "General foods count must be exactly 432");
  const slugs = new Set(seed.general_foods.map((g) => g.slug.toLowerCase()));
  assert.equal(slugs.size, 432, "All 432 general_foods slugs must be unique");
  assert.equal(PLANS_SEED.length, 7, "Plans count must be 7");
});

test("GV-1: Female, 30yo, 165cm, 70kg, activity 1.375, goal loss, healthy", () => {
  const reg = generateRegimenPipeline({
    gender: "female",
    age: 30,
    height_cm: 165,
    weight_kg: 70,
    activity_factor: 1.375,
    goal: "loss",
    conditions: [],
  });
  const m = reg.calculated_metrics;
  assert.equal(m.bmi, 25.7);
  assert.equal(m.ideal_weight_min, 50);
  assert.equal(m.ideal_weight_max, 68);
  assert.equal(m.ideal_weight_mid, 60);
  assert.equal(m.bmr, 1420);
  assert.equal(m.tdee, 1953);
  assert.equal(m.targetCal, 1450);
  assert.equal(m.protein_g, 126);
  assert.equal(m.fiber_g, 20);
  assert.equal(m.water_l, 2.5);

  const sumSlots = reg.day1_slots.reduce((acc, s) => acc + s.target_calories, 0);
  assert.equal(sumSlots, 1450, "Sum of slot calories must equal targetCal (1450)");
  assert.equal(reg.day2_shock, null, "Regular weight loss must NOT have a 2-day shock regimen");
});

test("GV-2: Male, 35yo, 180cm, 95kg, activity 1.55, goal loss_fast + diabetes", () => {
  const reg = generateRegimenPipeline({
    gender: "male",
    age: 35,
    height_cm: 180,
    weight_kg: 95,
    activity_factor: 1.55,
    goal: "loss_fast",
    conditions: ["diabetes"],
  });
  const m = reg.calculated_metrics;
  assert.equal(m.bmr, 1905);
  assert.equal(m.tdee, 2953);
  assert.equal(m.targetCal, 2200);
  assert.equal(m.is_slot_locked, true);
  assert.equal(reg.day1_slots.length, 6);
  assert.ok(m.carbs_g <= 248, `Carbs (${m.carbs_g}g) must be <= 248g (45% cap)`);
  assert.equal(reg.treat_allowance.enabled, false, "Treat allowance must be disabled for diabetes");

  // Verify 0 items with NEG_SUGAR
  const seed = getSeedData();
  const mealMap = new Map(seed.meals.map((x) => [x.code, x]));
  for (const slot of reg.day1_slots) {
    for (const opt of slot.options) {
      const mealObj = mealMap.get(opt.meal_code);
      assert.ok(
        !mealObj.neg_tags_final.includes("NEG_SUGAR"),
        `Meal ${opt.meal_code} in diabetes plan must not have NEG_SUGAR`
      );
    }
  }
});

test("GV-3: Female, 28yo, 160cm, 62kg, activity 1.2, goal loss + pregnancy", () => {
  const m = calculateClinicalMetrics({
    gender: "female",
    age: 28,
    height_cm: 160,
    weight_kg: 62,
    activity_factor: 1.2,
    goal: "loss",
    diet_pref: "keto",
    conditions: ["pregnancy"],
  });
  assert.equal(m.bmr, 1319);
  assert.equal(m.tdee, 1583);
  assert.equal(m.targetCal, 1880);
  assert.equal(m.protein_g, 93);
  assert.equal(m.is_slot_locked, true);
  assert.notEqual(m.effectiveDietKey, "keto");
});

test("GV-4: Male, 50yo, 175cm, 80kg, activity 1.375, goal loss + kidney (non-dialysis vs dialysis)", () => {
  const reg = generateRegimenPipeline({
    gender: "male",
    age: 50,
    height_cm: 175,
    weight_kg: 80,
    activity_factor: 1.375,
    goal: "loss",
    conditions: ["kidney"],
    is_dialysis: false,
  });
  const m = reg.calculated_metrics;
  assert.equal(m.bmr, 1649);
  assert.equal(m.tdee, 2267);
  assert.equal(m.targetCal, 1770);
  assert.equal(m.protein_g, 64, "Non-dialysis kidney protein cap must be 0.8 * 80 = 64g");

  const seed = getSeedData();
  const mealMap = new Map(seed.meals.map((x) => [x.code, x]));
  for (const slot of reg.day1_slots) {
    for (const opt of slot.options) {
      const mealObj = mealMap.get(opt.meal_code);
      assert.ok(
        !mealObj.neg_tags_final.includes("NEG_KIDNEY"),
        `Meal ${opt.meal_code} in kidney plan must not have NEG_KIDNEY`
      );
    }
  }

  // Also verify Hemodialysis sub-mode sets protein to 1.2 g/kg = 96g
  const mDialysis = calculateClinicalMetrics({
    gender: "male",
    age: 50,
    height_cm: 175,
    weight_kg: 80,
    activity_factor: 1.375,
    goal: "loss",
    conditions: ["kidney"],
    is_dialysis: true,
  });
  assert.equal(mDialysis.protein_g, 96, "Dialysis protein must be 1.2 * 80 = 96g");
});

test("GV-5: Female, 29yo, 168cm, 74kg, activity 1.55, goal shock_plateau, healthy", () => {
  const m = calculateClinicalMetrics({
    gender: "female",
    age: 29,
    height_cm: 168,
    weight_kg: 74,
    activity_factor: 1.55,
    goal: "shock_plateau",
    conditions: [],
  });
  assert.equal(m.targetCal, 1800);
  assert.equal(m.protein_g, 148);
  assert.equal(m.day2_shock.day2Cal, 1200, "Floor 1200 must win over 60%*1800=1080");
  assert.equal(m.day2_shock.fastHours, 16);
});

test("GV-6: Male with diabetes who selects shock_plateau or fast16", () => {
  const m = calculateClinicalMetrics({
    gender: "male",
    age: 42,
    height_cm: 176,
    weight_kg: 88,
    activity_factor: 1.375,
    goal: "shock_plateau",
    diet_pref: "fast16",
    conditions: ["diabetes"],
  });
  assert.equal(m.day2_shock.fastHours, 0, "Fasting must be cancelled for diabetic user");
  assert.ok(m.warnings_fa.some((w) => w.includes("دیابت") || w.includes("فستینگ")));
});

test("GV-7: Safe Scaling, GrainBox (1.5 cups pasta = 3 units = 240 kcal), and Cook Kind", () => {
  // 1) 1.5 cups cooked pasta = 3 units = 240 kcal
  const gb = buildGrainBox(
    {
      name: "ماکارونی رژیمی",
      ingredients_desc: "۱٫۵ لیوان ماکارونی رشته‌ای پخته + ۶۰ گرم گوشت",
      grain_exchange: { units: 2, kcal: 160 },
    },
    1.0,
    "l"
  );
  assert.equal(gb.units, 3);
  assert.equal(gb.kcal, 240);

  // 2) 1.5x scaling of "۱ لیوان شیر ۱ درصد" must keep "۱ درصد" untouched
  const scaledMilk = scaleIngredientText("۱ لیوان شیر ۱ درصد", 1.5);
  assert.ok(scaledMilk.includes("۱.۵ لیوان"), `Expected ۱.۵ لیوان in ${scaledMilk}`);
  assert.ok(scaledMilk.includes("۱ درصد"), `Expected ۱ درصد untouched in ${scaledMilk}`);

  // 3) Adasi in fatty liver = cook_kind 'pot' without airfryer word
  const seed = getSeedData();
  const adasi = seed.meals.find((m) => m.code === "F6");
  assert.equal(adasi.cook_kind, "pot");
  const oilBox = buildOilBox(adasi, { zero_oil_cooking: true, conditions: ["fatty_liver"] }, "b");
  assert.equal(oilBox.cook_kind, "pot");
  assert.ok(!oilBox.instruction_fa.includes("ایرفرایر"));
});

test("GV-8: Persian scanX traps & Manual Selection Guard", () => {
  // 1) Lactose exceptions: ماهی شیر and کره بادام‌زمینی must NOT trigger NEG_LACTOSE
  const tagsFish = scanX("۱۵۰ گرم ماهی شیر کبابی + ۱ قاشق کره بادام‌زمینی");
  assert.ok(!tagsFish.includes("NEG_LACTOSE"), "ماهی شیر and کره بادام‌زمینی must not trigger NEG_LACTOSE");

  // 2) Arabic Yeh/Kah normalization: رايس كيك must NOT trigger NEG_SUGAR, but شيريني MUST
  const tagsRiceCake = scanX("۲ عدد رايس كيك بدون قند");
  assert.ok(!tagsRiceCake.includes("NEG_SUGAR"), "رايس كيك must not trigger NEG_SUGAR");
  const tagsSweet = scanX("۱ تکه شيريني خامه ای");
  assert.ok(tagsSweet.includes("NEG_SUGAR"), "شيريني must trigger NEG_SUGAR");

  // 3) Manual search guard: raw rice -> RAW_NOT_PICKABLE, 40 cucumbers -> UNREASONABLE_PORTION
  const rawCheck = validateManualFoodSelection(
    { name: "برنج خام ایرانی", is_raw_unpickable: true, calories_per_unit: 360, grams_per_unit: 100 },
    "l",
    500
  );
  assert.equal(rawCheck.ok, false);
  assert.equal(rawCheck.code, "RAW_NOT_PICKABLE");

  const cucumberCheck = validateManualFoodSelection(
    { name: "خیار تازه", is_raw_unpickable: false, is_side_only: false, calories_per_unit: 12, grams_per_unit: 100 },
    "s1",
    500
  );
  assert.equal(cucumberCheck.ok, false);
  assert.equal(cucumberCheck.code, "UNREASONABLE_PORTION");
});

test("User Requirement Verifications: Bread Palm + Grams, No Rice in Breakfast, Flour-in-Recipe Note, Non-Repeating Refresh, Athlete & Cooking Guide", () => {
  // 1) 45g barbari bread in menu -> ۱.۵ کف دست بدون انگشت نان بربری (۴۵ گرم)
  const scaledBread = scaleIngredientText("۴۵ گرم نان بربری + ۳۰ گرم پنیر", 1.0);
  assert.ok(
    scaledBread.includes("کف دست بدون انگشت نان بربری (۴۵ گرم)"),
    `Expected palm+gram bread format, got: ${scaledBread}`
  );

  // 2) Breakfast grain substitutions must NOT contain rice ("برنج")
  const bGrain = buildGrainBox(
    {
      name: "صبحانه نان و پنیر",
      ingredients_desc: "۴۵ گرم نان بربری + ۳۰ گرم پنیر",
      grain_exchange: { units: 1.5, kcal: 120 },
    },
    1.0,
    "b"
  );
  assert.equal(bGrain.show_substitution_box, true);
  assert.ok(
    bGrain.substitutions_list_fa.every((item) => !item.includes("برنج")),
    "Breakfast grain substitutions must never include rice"
  );

  // 3) Oatmeal in breakfast must NOT show bread substitution box
  const oatGrain = buildGrainBox(
    {
      name: "اوتمیل رژیمی با میوه",
      ingredients_desc: "۳۰ گرم جو دوسر + ۱۵۰ میل شیر کم‌چرب",
      grain_exchange: { units: 0.5, kcal: 40 },
    },
    1.0,
    "b"
  );
  assert.equal(oatGrain.show_substitution_box, false, "Oatmeal must not show bread replacement box");

  // 4) Khagineh with flour + bread (F25) must show flour_recipe_note_fa
  const seed = getSeedData();
  const f25 = seed.meals.find((m) => m.code === "F25");
  const khaginehGrain = buildGrainBox(f25, 1.0, "b");
  assert.ok(
    khaginehGrain.flour_recipe_note_fa && khaginehGrain.flour_recipe_note_fa.includes("عدم تمایل به مصرف آرد"),
    "Khagineh with flour and bread must include flour replacement explanation"
  );

  // 5) Non-repeating refresh: refreshing 6 times in a row never returns any code in rejected/current set
  const profile = { gender: "female", age: 32, height_cm: 165, weight_kg: 68, activity_factor: 1.375, goal: "loss", conditions: [] };
  const metrics = calculateClinicalMetrics(profile);
  const seenCodes = new Set();
  const seenSigs = new Set();

  for (let i = 0; i < 8; i++) {
    const nextOpts = selectCandidatesForSlot({
      allMeals: seed.meals,
      slotId: "l",
      slotType: "l",
      slotCal: 450,
      profile,
      metrics,
      count: 1,
      strictExcludeCodes: seenCodes,
      strictExcludeSignatures: seenSigs,
      softRejectedCodes: seenCodes,
    });
    assert.equal(nextOpts.length, 1);
    const code = nextOpts[0].meal_code;
    assert.ok(!seenCodes.has(code), `Refresh ${i} returned duplicate code ${code}`);
    seenCodes.add(code);
    seenSigs.add(getDishBaseSignature(nextOpts[0].title_fa));
  }

  // 6) Athlete with verified Body Fat % and Carb Loading / Cutting phases
  const bfNavy = calcBodyFatNavy({ gender: "male", height_cm: 180, waist_cm: 82, neck_cm: 40 });
  assert.ok(bfNavy >= 8 && bfNavy <= 22);
  const bfJP3 = calcBodyFatJacksonPollock3({ gender: "male", age: 26, chest_mm: 8, abdomen_mm: 14, thigh_mm: 10 });
  assert.ok(bfJP3 >= 5 && bfJP3 <= 18);
  const bfDurnin = calcBodyFatDurnin4({ gender: "female", age: 28, biceps_mm: 8, triceps_mm: 12, subscapular_mm: 12, suprailiac_mm: 14 });
  assert.ok(bfDurnin >= 14 && bfDurnin <= 30);

  const athleteReg = generateRegimenPipeline({
    gender: "male",
    age: 26,
    height_cm: 180,
    weight_kg: 82,
    activity_factor: 1.725,
    is_athlete: true,
    sport_category: "bodybuilding",
    sport_phase: "cut_definition",
    use_verified_body_fat: true,
    body_fat_pct: 12,
    conditions: [],
  });
  assert.ok(athleteReg.calculated_metrics.athlete_protocol, "Athlete protocol must be generated");
  assert.ok(athleteReg.athlete_rest_day?.enabled, "Athlete rest day plan must be generated");

  // 7) Cooking Guide for N=1 and N=4 across Fatty Liver, Diabetes, Kidney
  const guide4 = generateCookingGuide({
    slots: athleteReg.day1_slots,
    profile: { conditions: ["fatty_liver", "diabetes", "kidney"], is_dialysis: true },
    metrics: { zero_oil_cooking: true },
    persons: 4,
  });
  assert.equal(guide4.persons, 4);
  assert.ok(guide4.items.length > 0);
  assert.ok(guide4.condition_protocols_fa.length >= 3);
});
