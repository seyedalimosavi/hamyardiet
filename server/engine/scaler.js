// server/engine/scaler.js — Safe Persian Ingredient Scaler, Context-Aware GrainBox & Synchronized OilBox

import { normalizeFa, toEnDigits, toFaDigits, formatHalfFa } from "../../shared/persian.js";

export function round05(n) {
  return Math.round(Number(n) * 2) / 2;
}

export function round5(n) {
  return Math.round(Number(n) / 5) * 5;
}

/**
 * Safe Ingredient Scaler
 * - Protects numbers connected to "درصد", "%", "ساعت", "روز", "دقیقه", "ویتامین", "امگا", "نوع"
 * - Converts gram bread into tangible "X کف دست بدون انگشت نان ... (Y گرم)"
 * - Adds matchbox equivalent "(معادل X قوطی کبریت)" for cooked meats/fish/cheese
 */
export function scaleIngredientText(rawDesc, scaleFactor = 1, options = {}) {
  if (!rawDesc) return "";
  const { zeroOil = false, isDialysis = false } = options;

  // 1. Strip embedded ". وضعیت روغن: ..." from raw description so we manage oil cleanly & consistently
  let text = String(rawDesc).replace(/\.\s*وضعیت روغن\s*:.*$/i, "").trim();

  // Convert slash fractions like "۱/۵" or "1/5" (meaning 1.5 in Persian seed data) and "۳/۴"
  text = toEnDigits(text)
    .replace(/\b1\/5\b/g, "1.5")
    .replace(/\b2\/5\b/g, "2.5")
    .replace(/\b3\/4\b/g, "0.75")
    .replace(/٫/g, ".");

  // Protect non-scalable tokens (like "1 درصد", "2 درصد", "امگا 3")
  const protectedTokens = [];
  text = text.replace(
    /(\d+(?:\.\d+)?)\s*(درصد|%)|(?:ساعت|روز|دقیقه|ویتامین|امگا|نوع)\s*(\d+(?:\.\d+)?)/g,
    (match) => {
      const idx = protectedTokens.length;
      protectedTokens.push(match);
      return `__PROT_${idx}__`;
    }
  );

  // Scale numbers followed by units
  const countUnits = "عدد|تکه|برش|سیخ|ورق|حبه|سفیده|تخم مرغ|تخم‌مرغ|گردو|بادام|خرما|کفگیر|قوطی";
  const halfUnits = "لیوان|پیاله|کاسه|کف دست|کف‌دست|قاشق| ق غ| ق چ| ق م|ق\\.غ|ق\\.م|ق\\.چ|ق‌غ|ق‌م|ق‌چ|ملاقه|اسکوپ";
  const weightUnits = "گرم|میل|میلی لیتر|میلی‌لیتر";

  const unitRegex = new RegExp(
    `(\\d+(?:\\.\\d+)?)(\\s*)(${weightUnits}|${countUnits}|${halfUnits})`,
    "g"
  );

  text = text.replace(unitRegex, (full, numStr, space, unit) => {
    const val = parseFloat(numStr);
    if (isNaN(val)) return full;
    const scaled = val * scaleFactor;

    if (new RegExp(`^(${weightUnits})$`).test(unit)) {
      const r = scaled >= 20 ? Math.max(5, round5(scaled)) : Math.max(1, Math.round(scaled));
      return `${r}${space}${unit}`;
    }
    if (new RegExp(`^(${countUnits})$`).test(unit)) {
      const r = Math.max(1, Math.round(scaled));
      return `${r}${space}${unit}`;
    }
    // Half-step volume/spoon/palm units
    const r = Math.max(0.5, round05(scaled));
    const formatted = r % 1 === 0 ? String(r) : r.toFixed(1);
    return `${formatted}${space}${unit}`;
  });

  // Restore protected tokens
  protectedTokens.forEach((tok, idx) => {
    text = text.replace(`__PROT_${idx}__`, tok);
  });

  // If zero-oil clinical condition (Fatty Liver / High Cholesterol / Heart), remove inline cooking oil / butter / mayo mentions
  if (zeroOil) {
    text = text
      .replace(/\+\s*\d+(?:\.\d+)?\s*(?:ق‌چ|ق‌م|ق‌غ|ق\.چ|ق\.م|ق\.غ|قاشق[^\+]*?)\s*(?:روغن مایع|روغن حیوانی|کره|سس مایونز[^\+]*)/g, "")
      .replace(/با\s*\d+(?:\.\d+)?\s*(?:ق‌چ|ق‌م|ق‌غ|ق\.چ|ق\.م|ق\.غ|قاشق[^\+]*?)\s*(?:روغن|کره)/g, "بدون روغن");
  }

  // Dialysis adjustment: replace tomato/paste and peel cucumber
  if (isDialysis) {
    text = text
      .replace(/رب گوجه فرنگی|رب گوجه‌فرنگی|رب گوجه/g, "زعفران و زردچوبه (بدون رب گوجه)")
      .replace(/خیار/g, "خیار پوست‌کنده");
  }

  // 2. Transform "<X> گرم نان ..." into tangible palm units + grams inside the menu line!
  // Example: "45 گرم سنگک" -> "1.5 کف دست بدون انگشت نان سنگک (45 گرم)"
  // Avoid double transforming if "کف دست" is already right next to it
  if (!text.includes("کف دست") && !text.includes("کف‌دست")) {
    text = text.replace(
      /(\d+(?:\.\d+)?)\s*گرم\s*(نان سنگک|سنگک|نان بربری\/سنگک|نان بربری|بربری|نان لواش|لواش|نان تافتون|تافتون|نان باگت سبوس‌دار|نان باگت|نان سفید|نان جو|نان)/g,
      (match, gramStr, breadType) => {
        const g = parseFloat(gramStr) || 30;
        if (breadType.includes("لواش")) {
          const palms = Math.max(1, Math.round(g / 10));
          return `${palms} کف دست کوچک بدون انگشت نان لواش (${Math.round(g)} گرم)`;
        }
        if (breadType.includes("تافتون")) {
          const palms = Math.max(1, round05(g / 15));
          return `${palms} کف دست نان تافتون (${Math.round(g)} گرم)`;
        }
        const palms = Math.max(0.5, round05(g / 30));
        const exactGrams = Math.round(palms * 30);
        let cleanType = breadType;
        if (breadType === "سنگک") cleanType = "نان سنگک";
        else if (breadType === "بربری" || breadType === "نان بربری/سنگک") cleanType = "نان بربری";
        else if (breadType === "نان") cleanType = isDialysis ? "نان سفید کم‌نمک" : "نان بربری یا سنگک";
        return `${palms} کف دست بدون انگشت ${cleanType} (${exactGrams} گرم)`;
      }
    );
  }

  // 3. Add tangible matchbox equivalent for cooked meat/chicken/fish/cheese in grams if not present
  if (!text.includes("قوطی کبریت")) {
    text = text.replace(
      /(\d+)\s*گرم\s*(سینه مرغ|فیله یا سینه مرغ|مرغ|گوشت چرخ‌کرده|گوشت چرخ کرده|گوشت گوساله|گوشت خورشتی|گوشت|ماهی قزل‌آلا یا سفید|ماهی قزل\/شیر|ماهی|بوقلمون|سینه جوجه|کباب کوبیده\/برگ|برگر دست‌ساز خالص گوساله)/g,
      (match, gramStr, meatType) => {
        const g = parseInt(gramStr, 10) || 30;
        const boxes = Math.max(0.5, round05(g / 30));
        return `${g} گرم ${meatType} (${boxes} قوطی کبریت)`;
      }
    );
    text = text.replace(
      /(\d+)\s*گرم\s*(پنیر کم‌نمک|پنیر کم‌چرب|پنیر)/g,
      (match, gramStr, cheeseType) => {
        const g = parseInt(gramStr, 10) || 30;
        const boxes = Math.max(0.5, round05(g / 30));
        return `${g} گرم ${cheeseType} (${boxes} قوطی کبریت)`;
      }
    );
  }

  // 4. Add tablespoon equivalent for rolled oats ("جو دوسر" / "جو") in grams
  text = text.replace(
    /(\d+)\s*گرم\s*(جو دوسر پرک|جو دوسر|جو)/g,
    (match, gramStr, oatType) => {
      const g = parseInt(gramStr, 10) || 30;
      const tbsp = Math.max(1, Math.round(g / 10));
      return `${tbsp} قاشق غذاخوری پر ${oatType === "جو" ? "جو دوسر پرک" : oatType} (${g} گرم)`;
    }
  );

  return toFaDigits(text);
}

/**
 * Compute Grain Equivalence Box (GrainBox)
 * - Strictly honors Golden Vector GV-7: 1.5 cups cooked pasta = 3 units = 240 kcal
 * - Context-aware per meal slot:
 *   * Breakfast ('b') & Snacks ('s*'): NEVER suggest rice or pasta!
 *   * Oatmeal / Fereni / Halim / Porridge / Rice Cake / Boiled Potato without bread: do NOT suggest replacing oats/porridge with bread!
 *   * Recipe flour + side bread (e.g. F25 Khagineh): separates recipe flour from side bread & explains how to omit flour and increase bread to N units!
 */
export function buildGrainBox(meal, scaleFactor = 1, slotId = "l", isDialysis = false) {
  const nameAndDesc = normalizeFa(`${meal.name || ""} ${meal.ingredients_desc || ""}`);
  const slotType = slotId === "b" ? "b" : ["l", "d"].includes(slotId) ? slotId : "s";

  // Check explicit pasta cups for GV-7 accuracy
  const enDesc = toEnDigits(String(meal.ingredients_desc || "")).replace(/٫/g, ".");
  const pastaCupMatch = enDesc.match(/(\d+(?:\.\d+)?)\s*لیوان\s*(?:ماکارونی|پاستا)/);

  let rawUnits = 0;
  if (pastaCupMatch) {
    const cups = parseFloat(pastaCupMatch[1]) * scaleFactor;
    // 0.5 cup cooked pasta = 1 unit grain (80 kcal) -> 1.5 cups = 3 units (240 kcal)
    rawUnits = round05(cups * 2);
  } else if (meal.grain_exchange && meal.grain_exchange.units > 0) {
    rawUnits = round05(meal.grain_exchange.units * scaleFactor);
  } else {
    return null;
  }

  if (rawUnits <= 0) return null;

  const units = Math.max(0.5, rawUnits);
  const kcal = Math.round(units * 80);

  // Detect if this dish is oatmeal / porridge / fereni / halim / pancake / rice-cake / potato without side bread
  const hasBreadWord = /(نان|سنگک|بربری|لواش|تافتون|باگت|تست)/.test(nameAndDesc);
  const hasRiceWord = /(برنج|پلو|چلو|کته|دمی)/.test(nameAndDesc) && !nameAndDesc.includes("ارد برنج") && !nameAndDesc.includes("کیک برنجی");
  const hasPastaWord = /(ماکارونی|پاستا)/.test(nameAndDesc);
  const hasFlourInRecipe = /(ارد|فرنی|پنکیک|خاگینه)/.test(nameAndDesc);
  const isPorridgeOrOatOrSnackBase =
    /(جو دوسر|اوتمیل|فرنی|حلیم|پنکیک|رایس کیک|کیک برنجی|سیب زمینی|عدسی)/.test(nameAndDesc) &&
    !hasBreadWord &&
    !hasRiceWord &&
    !hasPastaWord;

  // Detect primary grain in menu to customize "به جای ... داخل منو"
  let primaryGrainFa = "نان یا غلات";
  if (nameAndDesc.includes("بربری")) primaryGrainFa = "نان بربری";
  else if (nameAndDesc.includes("سنگک")) primaryGrainFa = "نان سنگک";
  else if (nameAndDesc.includes("تافتون")) primaryGrainFa = "نان تافتون";
  else if (nameAndDesc.includes("لواش")) primaryGrainFa = "نان لواش";
  else if (nameAndDesc.includes("باگت")) primaryGrainFa = "نان باگت";
  else if (hasRiceWord) primaryGrainFa = "برنج پخته";
  else if (hasPastaWord) primaryGrainFa = "ماکارونی پخته";
  else if (hasBreadWord) primaryGrainFa = "نان";

  // Check if meal has BOTH recipe flour ("آرد") AND side bread ("نان"), like F25 (خاگینه عسلی با نان)
  let breadOnlyUnits = units;
  let flour_recipe_note_fa = null;

  if (hasFlourInRecipe && hasBreadWord) {
    // Extract side bread grams from scaled description if possible
    const breadGramMatch = enDesc.match(/(\d+(?:\.\d+)?)\s*گرم\s*(?:نان|سنگک|بربری|تافتون|لواش)/);
    if (breadGramMatch) {
      const scaledBreadG = parseFloat(breadGramMatch[1]) * scaleFactor;
      breadOnlyUnits = Math.max(0.5, round05(scaledBreadG / 30));
    } else {
      breadOnlyUnits = Math.max(0.5, round05(units / 2));
    }
    const totalBreadGrams = Math.round(units * 30);
    flour_recipe_note_fa = `💡 نکته آرد داخل دستور: آرد ذکرشده در مواد اولیه داخل مایه پخت غذا استفاده می‌شود و جداگانه با نان جایگزین نمی‌گردد. اما در صورت عدم تمایل به مصرف آرد در پخت دستور (حذف آرد)، می‌توانید کل سهم غلات وعده را به صورت نان میل کنید و سهم نان همراه غذا را به ${formatHalfFa(units)} کف دست بدون انگشت نان سنگک یا بربری (${toFaDigits(totalBreadGrams)} گرم — معادل ${formatHalfFa(units)} واحد کامل غلات) برسانید.`;
  } else if (hasFlourInRecipe && !hasBreadWord) {
    flour_recipe_note_fa =
      "💡 آرد موجود در این منو جزء اصلی بافت خودِ غذا (فرنی/پنکیک) است و به صورت نان جداگانه جایگزین نمی‌شود.";
  }

  // Build slot-appropriate substitution items using breadOnlyUnits
  const subUnits = breadOnlyUnits;
  const subGrams = Math.round(subUnits * 30);
  const substitutions_list_fa = [];

  if (!isPorridgeOrOatOrSnackBase) {
    if (isDialysis) {
      substitutions_list_fa.push(
        `${toFaDigits(Math.max(1, Math.round(subUnits * 4)))} کف دست کوچک بدون انگشت نان لواش کم‌نمک (${toFaDigits(subGrams)} گرم — ارجح برای کنترل فسفر و پتاسیم)`
      );
      substitutions_list_fa.push(
        `${formatHalfFa(subUnits * 2)} کف دست نان تافتون کم‌نمک`
      );
      if (slotType === "l" || slotType === "d") {
        substitutions_list_fa.push(
          `${toFaDigits(Math.round(subUnits * 4))} قاشق غذاخوری برنج سفید کته کم‌چرب (بدون نمک)`
        );
      }
    } else {
      if (primaryGrainFa !== "نان سنگک") {
        substitutions_list_fa.push(
          `${formatHalfFa(subUnits)} کف دست بدون انگشت نان سنگک (${toFaDigits(subGrams)} گرم)`
        );
      }
      if (primaryGrainFa !== "نان بربری") {
        substitutions_list_fa.push(
          `${formatHalfFa(subUnits)} کف دست بدون انگشت نان بربری (${toFaDigits(subGrams)} گرم)`
        );
      }
      if (primaryGrainFa !== "نان تافتون") {
        substitutions_list_fa.push(
          `${formatHalfFa(subUnits * 2)} کف دست نان تافتون (${toFaDigits(subGrams)} گرم)`
        );
      }
      if (primaryGrainFa !== "نان لواش") {
        substitutions_list_fa.push(
          `${toFaDigits(Math.max(1, Math.round(subUnits * 4)))} کف دست کوچک بدون انگشت نان لواش`
        );
      }
      // ONLY in Lunch ('l') and Dinner ('d') allow rice/pasta substitutions! Never in Breakfast ('b') or Snacks ('s')!
      if (slotType === "l" || slotType === "d") {
        if (primaryGrainFa !== "برنج پخته") {
          substitutions_list_fa.push(
            `${toFaDigits(Math.round(subUnits * 4))} قاشق غذاخوری برنج پخته کم‌روغن`
          );
        }
        if (primaryGrainFa !== "ماکارونی پخته" && hasRiceWord) {
          substitutions_list_fa.push(
            `${formatHalfFa(subUnits * 0.5)} لیوان ماکارونی پخته کم‌چرب`
          );
        }
      } else {
        substitutions_list_fa.push(
          `${formatHalfFa(subUnits)} برش نان تست سبوس‌دار`
        );
      }
    }
  }

  const show_substitution_box = !isPorridgeOrOatOrSnackBase && substitutions_list_fa.length > 0;
  const header_fa = show_substitution_box
    ? `جایگزین‌های غلات (به‌جای ${primaryGrainFa} داخل منو، می‌توانید یکی از موارد زیر را به دلخواه انتخاب کنید):`
    : null;

  // Compact inline bread parenthetical for the 2-page print sheet
  let inline_bread_parenthetical_fa = null;
  if (show_substitution_box) {
    if (slotType === "b" || slotType === "s") {
      inline_bread_parenthetical_fa =
        primaryGrainFa === "نان سنگک"
          ? `معادل ${formatHalfFa(subUnits)} کف دست بربری یا ${formatHalfFa(subUnits * 2)} کف دست تافتون`
          : `معادل ${formatHalfFa(subUnits)} کف دست سنگک یا ${formatHalfFa(subUnits * 2)} کف دست تافتون`;
    } else if (hasRiceWord) {
      inline_bread_parenthetical_fa = `یا به جای برنج: ${formatHalfFa(subUnits)} کف دست نان سنگک/بربری (${toFaDigits(subGrams)} گرم)`;
    } else {
      inline_bread_parenthetical_fa = `معادل ${formatHalfFa(subUnits)} کف دست سنگک یا ${toFaDigits(Math.round(subUnits * 4))} ق‌غ برنج پخته`;
    }
  }

  return {
    units,
    kcal,
    sangak_palms: round05(1 * units),
    barbari_palms: round05(1 * units),
    taftoon_palms: round05(2 * units),
    lavash_palms: Math.round(4 * units),
    rice_tbsp: Math.round(4 * units),
    pasta_half_cups: round05(1 * units),
    primary_grain_fa: primaryGrainFa,
    show_substitution_box,
    header_fa,
    substitutions_list_fa,
    flour_recipe_note_fa,
    inline_bread_parenthetical_fa,
  };
}

/**
 * Build Synchronized OilBox & Inline Print Phrase
 * Guarantees 100% consistency between the meal's ingredients, its cooking method (cook_kind),
 * and the patient's clinical conditions (Fatty Liver / Cholesterol / Heart / Reflux / Dialysis).
 */
export function buildOilBox(meal, profileMetrics, slotId = "l") {
  const cook_kind = meal.cook_kind || "gen";
  const slotType = slotId === "b" ? "b" : ["l", "d"].includes(slotId) ? slotId : "s";
  const nameAndDesc = normalizeFa(`${meal.name || ""} ${meal.ingredients_desc || ""}`);
  const embedded = meal.oil_note_embedded ? String(meal.oil_note_embedded).trim() : null;

  const zeroOil = Boolean(profileMetrics?.zero_oil_cooking);
  const conditions = profileMetrics?.conditions || [];
  const allergies = profileMetrics?.hard_bans || [];
  const hasKidney = conditions.includes("kidney");
  const hasLactoseBan = allergies.includes("NEG_LACTOSE");

  // Snacks and Cold/No-Cook Breakfasts (like bread+cheese, oatmeal, milk, fruit) do not have cooking oil
  const isNoCookItem =
    slotType === "s" ||
    cook_kind === "gen" ||
    (slotType === "b" &&
      !/(املت|نیمرو|خاگینه|عدسی|حلیم|فرنی|تفت|روغن|کره)/.test(nameAndDesc));

  if (isNoCookItem && !embedded) {
    return null;
  }

  // When the recipe already specifies fat, do not append another allowance.
  if (meal.fixed_portion && /روغن|کره/.test(nameAndDesc)) {
    const method = /املت|نیمرو|خاگینه/.test(nameAndDesc) ? "در تابه نچسب" : cook_kind === "grill" ? "در فر یا گریل" : "با پخت ملایم";
    return { cook_kind, oil_kcal_included: null, inline_print_phrase_fa: `${method}، فقط با مقدار روغن ذکرشده در مواد اولیه`, replacement_added_fa: null, instruction_fa: `${method} با همان مقدار روغن ذکرشده در مواد اولیه تهیه شود؛ روغن دیگری اضافه نشود.` };
  }

  // A heart/liver diagnosis does not itself require a blanket zero-fat meal.
  // Keep the ingredient quantities intact; avoid claiming an uncalculated substitute.
  if (zeroOil) {
    const method = /املت|نیمرو|خاگینه/.test(nameAndDesc)
      ? "در تابه نچسب با مقدار کم روغن مایع مناسب پخت تهیه شود"
      : cook_kind === "pot"
      ? "آب‌پز یا خورشتی با مقدار کم روغن مایع مناسب پخت؛ چربی اضافی گرفته شود"
      : "در فر، گریل یا تابه نچسب با مقدار کم روغن مایع مناسب پخت تهیه شود";
    return { cook_kind, oil_kcal_included: null, inline_print_phrase_fa: method,
      replacement_added_fa: null, instruction_fa: method + "؛ مقدار روغن را بر اساس نسخه اختصاصی کارشناس تنظیم کنید." };
  }

  // Case B: Meal has an explicit embedded oil/fat note from the clinical database
  if (embedded) {
    return {
      cook_kind,
      oil_kcal_included: 45,
      inline_print_phrase_fa: toFaDigits(embedded),
      replacement_added_fa: null,
      instruction_fa: `راهنمای چربی و پخت این منو: ${toFaDigits(embedded)}`,
    };
  }

  // Case C: Standard Cooking Oil Allowance based on cook_kind and inline ingredients
  if (cook_kind === "pot") {
    return {
      cook_kind: "pot",
      oil_kcal_included: 45,
      inline_print_phrase_fa: "در کل فرایند پخت حداکثر ۱ ق‌م روغن مایع/زیتون مجاز است (پخت خورشتی/آب‌پز)",
      replacement_added_fa: null,
      instruction_fa:
        "روش پخت خورشتی/قابلمه‌ای: در کل فرایند پخت سهم ۱ نفره حداکثر ۱ قاشق مرباخوری (۵ گرم) روغن کنجد، کلزا یا زیتون پخت‌وپز مجاز است (آب‌پز/خورشتی و گرفتن روغن روی غذا).",
    };
  }

  if (cook_kind === "grill") {
    return {
      cook_kind: "grill",
      oil_kcal_included: 45,
      inline_print_phrase_fa: "پخت گریل/فر/ایرفرایر یا تابه نچسب با حداکثر ۱ ق‌چ روغن (یا ۱ ق‌م روغن زیتون روی سالاد)",
      replacement_added_fa: null,
      instruction_fa:
        "روش پخت گریل/تابه‌ای: در ایرفرایر، فر، سیخ کبابی یا تابه نچسب با حداکثر ۱ قاشق چای‌خوری روغن (یا پخت بدون روغن و افزودن ۱ قاشق مرباخوری روغن زیتون خام روی سالاد).",
    };
  }

  if (cook_kind === "raw") {
    return {
      cook_kind: "raw",
      oil_kcal_included: 45,
      inline_print_phrase_fa: "۱ ق‌م روغن زیتون بکر خام روی سالاد (بدون سس مایونز)",
      replacement_added_fa: null,
      instruction_fa:
        "آماده‌سازی سرد/سالادی: ۱ قاشق مرباخوری روغن زیتون فرابکر خام به همراه آبلیمو تازه و سماق روی سالاد (بدون سس‌های چرب).",
    };
  }

  return null;
}

/**
 * Compose the clean, 1-to-2 line string for the 2-page A4 print table (`print_compact_line_fa`)
 * Rule: NO separate "وضعیت روغن" box in print! Bread substitution & oil note appear naturally inline.
 */
export function buildPrintCompactLine({
  title_fa,
  scaled_ingredients_fa,
  grain_box,
  oil_box,
}) {
  let line = `${title_fa}: ${scaled_ingredients_fa}`;

  // Append natural inline bread equivalent if not already redundant
  if (grain_box && grain_box.inline_bread_parenthetical_fa) {
    line += ` [${grain_box.inline_bread_parenthetical_fa}]`;
  }

  // Append natural inline cooking/oil phrase
  if (oil_box && oil_box.inline_print_phrase_fa) {
    // Avoid duplicating if the exact phrase is already in scaled_ingredients_fa
    const shortPhrase = oil_box.inline_print_phrase_fa;
    if (!scaled_ingredients_fa.includes(shortPhrase.slice(0, 12))) {
      line += ` — (${shortPhrase})`;
    }
  }

  return line;
}

/**
 * Manual Search Guard (GV-8)
 * Blocks raw unpickable items ('RAW_NOT_PICKABLE'), side-only items in main meals ('SIDE_ONLY_MAIN_MEAL'),
 * and unreasonable scaled portions ('UNREASONABLE_PORTION')
 */
export function validateManualFoodSelection(item, slotId, targetSlotCalories) {
  const normName = normalizeFa(item.name || "");
  if (
    item.is_raw_unpickable ||
    /(برنج خام|ارد گندم خام|ارد خام|رشته اش خام|ماکارونی خشک خام)/.test(normName)
  ) {
    return {
      ok: false,
      code: "RAW_NOT_PICKABLE",
      message_fa: `«${item.name}» ماده اولیه خام است و به تنهایی به عنوان وعده قابل انتخاب نیست. لطفاً شکل پخته آن را انتخاب کنید.`,
    };
  }

  const isMainMeal = ["b", "l", "d"].includes(slotId);
  if (isMainMeal && item.is_side_only) {
    return {
      ok: false,
      code: "SIDE_ONLY_MAIN_MEAL",
      message_fa: `«${item.name}» یک قلم جانبی/دورچین است و به تنهایی یک وعده اصلی کامل محسوب نمی‌شود.`,
    };
  }

  const unitCal = Number(item.calories_per_unit || item.base_calories || 100);
  const scaleFactor = targetSlotCalories / Math.max(1, unitCal);
  const grams = Number(item.grams_per_unit || 100) * scaleFactor;

  if (scaleFactor > 8 || grams > 1000) {
    return {
      ok: false,
      code: "UNREASONABLE_PORTION",
      message_fa: `برای تامین کالری این وعده از «${item.name}»، مقدار غیرمنطقی (${toFaDigits(Math.round(scaleFactor))} واحد / ${toFaDigits(Math.round(grams))} گرم) نیاز است که از نظر بالینی مجاز نیست.`,
    };
  }

  return { ok: true };
}
