"use client";

import React, { useState } from "react";
import { Calculator, CheckCircle2, Info, Award, Flame, Scale } from "lucide-react";
import { toFaDigits } from "../../shared/persian.js";

interface BodyFatCalculatorProps {
  initialGender?: string;
  initialAge?: number;
  initialHeight?: number;
  initialWeight?: number;
  initialWaist?: number;
  isAthlete?: boolean;
  onApplyBodyFat?: (bfPct: number, method: string, lbmKg: number, recommendedBmr: number) => void;
}

export default function BodyFatCalculatorSection({
  initialGender = "male",
  initialAge = 28,
  initialHeight = 178,
  initialWeight = 80,
  initialWaist = 84,
  isAthlete = true,
  onApplyBodyFat,
}: BodyFatCalculatorProps) {
  const [method, setMethod] = useState<"navy" | "jp3" | "durnin4" | "bmi">("navy");
  const [gender, setGender] = useState(initialGender);
  const [age, setAge] = useState(initialAge);
  const [heightCm, setHeightCm] = useState(initialHeight);
  const [weightKg, setWeightKg] = useState(initialWeight);

  // Navy inputs (cm)
  const [waistCm, setWaistCm] = useState(initialWaist || 84);
  const [neckCm, setNeckCm] = useState(gender === "male" ? 39 : 33);
  const [hipCm, setHipCm] = useState(98);

  // Caliper skinfold inputs (mm)
  const [chestMm, setChestMm] = useState(10);
  const [abdomenMm, setAbdomenMm] = useState(18);
  const [thighMm, setThighMm] = useState(14);
  const [tricepsMm, setTricepsMm] = useState(14);
  const [suprailiacMm, setSuprailiacMm] = useState(15);
  const [bicepsMm, setBicepsMm] = useState(8);
  const [subscapularMm, setSubscapularMm] = useState(14);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [appliedToast, setAppliedToast] = useState(false);

  const handleCalculate = async () => {
    setLoading(true);
    setAppliedToast(false);
    try {
      const res = await fetch("/api/v1/body-fat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          gender,
          age,
          height_cm: heightCm,
          weight_kg: weightKg,
          is_athlete: isAthlete,
          waist_cm: waistCm,
          neck_cm: neckCm,
          hip_cm: hipCm,
          chest_mm: chestMm,
          abdomen_mm: abdomenMm,
          thigh_mm: thighMm,
          triceps_mm: tricepsMm,
          suprailiac_mm: suprailiacMm,
          biceps_mm: bicepsMm,
          subscapular_mm: subscapularMm,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult(json.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToProfile = () => {
    if (!result || !onApplyBodyFat) return;
    onApplyBodyFat(result.body_fat_pct, method, result.lbm_kg, result.recommended_bmr);
    setAppliedToast(true);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-7 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-100">
        <div>
          <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-800 text-xs font-bold px-3 py-1 rounded-full mb-2">
            <Calculator className="w-4 h-4" />
            آزمایشگاه ترکیب بدنی و درصد چربی (Body Composition Lab)
          </div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">
            محاسبه علمی درصد چربی بدن، توده عضلانی (LBM) و کالری ورزشکاری
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            با انتخاب یکی از ۴ روش معتبر جهانی، درصد چربی بدن و وزن خالص عضلانی خود را محاسبه کنید تا کالری رژیم شما با فرمول دقیق{" "}
            <strong>Katch-McArdle / Cunningham</strong> تنظیم شود.
          </p>
        </div>
      </div>

      {/* Method Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setMethod("navy")}
          className={`p-3.5 rounded-xl border text-right transition ${
            method === "navy"
              ? "bg-teal-700 text-white border-teal-700 shadow-sm"
              : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100"
          }`}
        >
          <div className="font-bold text-sm mb-1">۱. فرمول ارتش آمریکا (متر خیاطی)</div>
          <div className={`text-xs ${method === "navy" ? "text-teal-100" : "text-slate-500"}`}>
            دور گردن، دور کمر (و باسن) — بسیار دقیق در منزل
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMethod("jp3")}
          className={`p-3.5 rounded-xl border text-right transition ${
            method === "jp3"
              ? "bg-teal-700 text-white border-teal-700 shadow-sm"
              : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100"
          }`}
        >
          <div className="font-bold text-sm mb-1">۲. چین پوستی ۳ نقطه‌ای (کالیپر)</div>
          <div className={`text-xs ${method === "jp3" ? "text-teal-100" : "text-slate-500"}`}>
            فرمول استاندارد Jackson-Pollock ویژه ورزشکاران
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMethod("durnin4")}
          className={`p-3.5 rounded-xl border text-right transition ${
            method === "durnin4"
              ? "bg-teal-700 text-white border-teal-700 shadow-sm"
              : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100"
          }`}
        >
          <div className="font-bold text-sm mb-1">۳. چین پوستی ۴ نقطه‌ای کلینیکی</div>
          <div className={`text-xs ${method === "durnin4" ? "text-teal-100" : "text-slate-500"}`}>
            فرمول Durnin-Womersley (چهار نقطه با کالیپر)
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMethod("bmi")}
          className={`p-3.5 rounded-xl border text-right transition ${
            method === "bmi"
              ? "bg-teal-700 text-white border-teal-700 shadow-sm"
              : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100"
          }`}
        >
          <div className="font-bold text-sm mb-1">۴. تخمین از روی BMI و سن</div>
          <div className={`text-xs ${method === "bmi" ? "text-teal-100" : "text-slate-500"}`}>
            فرمول Deurenberg (تخمینی برای افراد غیرورزشکار)
          </div>
        </button>
      </div>

      {/* Base Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">جنسیت</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-medium"
          >
            <option value="male">آقا</option>
            <option value="female">خانم</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">سن (سال)</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-bold"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">قد (سانتی‌متر)</label>
          <input
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-bold"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">وزن (کیلوگرم)</label>
          <input
            type="number"
            value={weightKg}
            onChange={(e) => setWeightKg(Number(e.target.value))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 font-bold"
          />
        </div>
      </div>

      {/* Method-Specific Inputs */}
      {method === "navy" && (
        <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-4 mb-6">
          <h3 className="font-bold text-sm text-teal-900 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-teal-700" />
            اندازه‌گیری با متر خیاطی (فرمول نیروی دریایی و ارتش آمریکا):
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                دور گردن (سانتی‌متر — زیر سیب گلو)
              </label>
              <input
                type="number"
                value={neckCm}
                onChange={(e) => setNeckCm(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                دور کمر (سانتی‌متر — هم‌سطح ناف در حالت راحت)
              </label>
              <input
                type="number"
                value={waistCm}
                onChange={(e) => setWaistCm(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
              />
            </div>
            {gender === "female" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  دور باسن (سانتی‌متر — برجسته‌ترین قسمت)
                </label>
                <input
                  type="number"
                  value={hipCm}
                  onChange={(e) => setHipCm(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {method === "jp3" && (
        <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-4 mb-6">
          <h3 className="font-bold text-sm text-teal-900 mb-3">
            ضخامت چین پوستی با کالیپر در ۳ نقطه استاندارد جکسون-پولاک (بر حسب میلی‌متر):
          </h3>
          {gender === "male" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ۱. سینه (Chest — میلی‌متر)
                </label>
                <input
                  type="number"
                  value={chestMm}
                  onChange={(e) => setChestMm(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ۲. شکم (Abdomen — ۲ سانت کنار ناف، میلی‌متر)
                </label>
                <input
                  type="number"
                  value={abdomenMm}
                  onChange={(e) => setAbdomenMm(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ۳. جلوی ران (Thigh — میلی‌متر)
                </label>
                <input
                  type="number"
                  value={thighMm}
                  onChange={(e) => setThighMm(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ۱. پشت بازو (Triceps — میلی‌متر)
                </label>
                <input
                  type="number"
                  value={tricepsMm}
                  onChange={(e) => setTricepsMm(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ۲. فوق خاصره / پهلو (Suprailiac — میلی‌متر)
                </label>
                <input
                  type="number"
                  value={suprailiacMm}
                  onChange={(e) => setSuprailiacMm(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ۳. جلوی ران (Thigh — میلی‌متر)
                </label>
                <input
                  type="number"
                  value={thighMm}
                  onChange={(e) => setThighMm(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {method === "durnin4" && (
        <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-4 mb-6">
          <h3 className="font-bold text-sm text-teal-900 mb-3">
            ضخامت چین پوستی ۴ نقطه‌ای Durnin-Womersley با کالیپر (بر حسب میلی‌متر):
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                جلو بازو (Biceps — mm)
              </label>
              <input
                type="number"
                value={bicepsMm}
                onChange={(e) => setBicepsMm(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                پشت بازو (Triceps — mm)
              </label>
              <input
                type="number"
                value={tricepsMm}
                onChange={(e) => setTricepsMm(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تحت کتف (Subscapular — mm)
              </label>
              <input
                type="number"
                value={subscapularMm}
                onChange={(e) => setSubscapularMm(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                فوق خاصره / پهلو (Suprailiac — mm)
              </label>
              <input
                type="number"
                value={suprailiacMm}
                onChange={(e) => setSuprailiacMm(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {method === "bmi" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-xs text-amber-900 leading-relaxed">
          ⚠️ <strong>توجه علمی:</strong> فرمول BMI صرفاً نسبت وزن به قد و سن را می‌سنجد و در ورزشکاران دارای عضله بالا ممکن است درصد چربی را بیشتر از واقعیت نشان دهد. اگر ورزشکار هستید، استفاده از <strong>فرمول ارتش آمریکا (با متر)</strong> یا <strong>چین پوستی کالیپر</strong> بسیار دقیق‌تر است.
        </div>
      )}

      <button
        type="button"
        onClick={handleCalculate}
        disabled={loading}
        className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-extrabold px-6 py-3.5 rounded-xl shadow transition flex items-center justify-center gap-2"
      >
        <Calculator className="w-5 h-5" />
        {loading ? "در حال محاسبه علمی..." : "محاسبه دقیق درصد چربی و توده عضلانی"}
      </button>

      {/* Results Display */}
      {result && (
        <div className="mt-6 pt-6 border-t border-slate-200 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
              <div className="text-xs text-teal-700 font-bold mb-1">درصد چربی بدن (Body Fat)</div>
              <div className="text-3xl font-extrabold text-teal-900">
                {toFaDigits(result.body_fat_pct)}٪
              </div>
              <div className="text-xs text-teal-800 mt-1 font-medium">{result.category_fa}</div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <div className="text-xs text-emerald-700 font-bold mb-1 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5" />
                وزن خالص بدون چربی (LBM)
              </div>
              <div className="text-2xl font-extrabold text-emerald-900">
                {toFaDigits(result.lbm_kg)} کیلوگرم
              </div>
              <div className="text-xs text-emerald-700 mt-1">
                وزن کل چربی: {toFaDigits(result.fat_mass_kg)} کیلوگرم
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
              <div className="text-xs text-indigo-700 font-bold mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                شاخص عضلانی (FFMI)
              </div>
              <div className="text-2xl font-extrabold text-indigo-900">
                {toFaDigits(result.ffmi)}
              </div>
              <div className="text-xs text-indigo-700 mt-1">
                {result.ffmi >= 21 ? "توده عضلانی عالی / ورزشکاری" : "توده عضلانی استاندارد"}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="text-xs text-amber-800 font-bold mb-1 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                متابولیسم پایه از روی عضله
              </div>
              <div className="text-2xl font-extrabold text-amber-900">
                {toFaDigits(result.recommended_bmr)} کالری
              </div>
              <div className="text-xs text-amber-800 mt-1">
                Katch: {toFaDigits(result.bmr_katch_mcardle)} | Cunningham:{" "}
                {toFaDigits(result.bmr_cunningham)}
              </div>
            </div>
          </div>

          {onApplyBodyFat && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm">
                <span className="font-bold text-teal-300">آیا از صحت این اندازه‌گیری مطمئن هستید؟</span>{" "}
                با کلیک روی دکمه روبرو، این عدد ({toFaDigits(result.body_fat_pct)}٪) در پرونده رژیم شما ثبت و کالری شما بر اساس توده عضلانی خالص محاسبه می‌شود.
              </div>
              <button
                type="button"
                onClick={handleApplyToProfile}
                className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl shrink-0 transition flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                استفاده از این درصد چربی در محاسبه رژیم
              </button>
            </div>
          )}

          {appliedToast && (
            <div className="mt-3 bg-emerald-100 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl text-sm font-bold">
              ✅ درصد چربی ({toFaDigits(result.body_fat_pct)}٪) با موفقیت در فرم پرونده شما ثبت و تیک «محاسبه دقیق بر اساس درصد چربی» فعال شد!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
