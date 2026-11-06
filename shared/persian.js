// shared/persian.js — Persian text normalization, digit conversion, Jalali dates & Toman formatting

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toEnDigits(str) {
  if (str === null || str === undefined) return "";
  let s = String(str);
  for (let i = 0; i < 10; i++) {
    s = s.replaceAll(FA_DIGITS[i], String(i)).replaceAll(AR_DIGITS[i], String(i));
  }
  return s;
}

export function toFaDigits(val) {
  if (val === null || val === undefined) return "";
  return String(val).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function normalizeFa(text) {
  if (!text) return "";
  let s = toEnDigits(String(text));
  // Normalize Arabic Yeh/Kah and variants to Persian
  s = s
    .replace(/[يئى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/إ|أ|آ/g, "ا")
    // Remove tatweel (kashida) and diacritics
    .replace(/[\u0640\u064B-\u065F\u0670]/g, "")
    // Replace zero-width non-joiner and multiple spaces with single space for uniform matching
    .replace(/[\u200C\u200B\u00A0]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

export function formatToman(amount) {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return "رایگان";
  return `${toFaDigits(num.toLocaleString("en-US"))} تومان`;
}

export function formatJalali(dateInput = new Date()) {
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return toFaDigits("1405/01/15");
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return toFaDigits("1405/01/15");
  }
}

export function formatHalfFa(num, style = "decimal") {
  const rounded = Math.round(Number(num) * 2) / 2;
  if (rounded <= 0) return toFaDigits(0);
  const whole = Math.floor(rounded);
  const isHalf = Math.abs(rounded - whole - 0.5) < 0.01;
  if (!isHalf) return toFaDigits(whole);
  if (style === "words") {
    if (whole === 0) return "نصف";
    return `${toFaDigits(whole)} و نیم`;
  }
  return toFaDigits(rounded.toFixed(1));
}
