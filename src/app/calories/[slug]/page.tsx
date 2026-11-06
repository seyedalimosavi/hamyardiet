import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeedData } from "../../../../server/engine/pipeline.js";
import { toFaDigits } from "../../../../shared/persian.js";

export default async function CalorieDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const seed = getSeedData();
  const food = (seed.general_foods || []).find(
    (g: any) => g.slug.toLowerCase() === decodeURIComponent(slug).toLowerCase()
  );

  if (!food) {
    notFound();
  }

  const negs: string[] = food.neg_tags || [];
  const isDiabeticSafe = !negs.includes("NEG_SUGAR") && !negs.includes("NEG_HIGH_GI");
  const isLiverSafe = !negs.includes("NEG_LIVER") && !negs.includes("NEG_SUGAR");
  const isKidneySafe = !negs.includes("NEG_KIDNEY");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NutritionInformation",
    name: food.name,
    calories: `${food.calories_per_unit} calories`,
    servingSize: `${food.unit_label} (${food.grams_per_unit}g)`,
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <Link href="/calories" className="text-teal-700 font-bold text-sm hover:underline">
            → بازگشت به جدول کامل کالری‌ها
          </Link>
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
            کد مرجع: {food.code}
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-3">
          کالری و ارزش غذایی «{food.name}»
        </h1>
        <p className="text-slate-600 text-sm md:text-base mb-6 leading-relaxed">
          هر <strong>{toFaDigits(food.unit_label)}</strong> از «{food.name}» (معادل{" "}
          {toFaDigits(food.grams_per_unit)} گرم) دارای{" "}
          <strong className="text-teal-700">{toFaDigits(food.calories_per_unit)} کیلوکالری</strong>{" "}
          انرژی است.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
            <div className="text-xs text-teal-700 mb-1">انرژی در هر واحد</div>
            <div className="text-2xl font-extrabold text-teal-800">
              {toFaDigits(food.calories_per_unit)} کالری
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">پیمانه استاندارد</div>
            <div className="text-lg font-bold text-slate-800">{toFaDigits(food.unit_label)}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <div className="text-xs text-slate-500 mb-1">وزن معادل</div>
            <div className="text-lg font-bold text-slate-800">
              {toFaDigits(food.grams_per_unit)} گرم
            </div>
          </div>
        </div>

        <h2 className="font-bold text-lg text-slate-800 mb-3">
          🩺 بررسی سازگاری بالینی «{food.name}»
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <div
            className={`p-3.5 rounded-xl border text-sm font-medium ${
              isDiabeticSafe
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {isDiabeticSafe ? "✅ مناسب برای قند خون و دیابت" : "⚠️ احتیاط در دیابت (قند/گلیسمی بالا)"}
          </div>
          <div
            className={`p-3.5 rounded-xl border text-sm font-medium ${
              isLiverSafe
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {isLiverSafe ? "✅ مناسب کبد چرب" : "⚠️ محدودیت مصرف در کبد چرب"}
          </div>
          <div
            className={`p-3.5 rounded-xl border text-sm font-medium ${
              isKidneySafe
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {isKidneySafe ? "✅ مجاز در رژیم کلیوی" : "🚫 محدودیت پتاسیم/فسفر در کلیوی"}
          </div>
        </div>

        <div className="bg-teal-700 text-white rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-lg mb-1">
              می‌خواهید بدانید چه مقدار «{food.name}» برای وزن و شرایط شما مجاز است؟
            </h3>
            <p className="text-teal-100 text-sm">
              همین حالا پرونده سلامت خود را ثبت کنید و برنامه غذایی ۲ صفحه‌ای و راهنمای پخت خانواده بگیرید.
            </p>
          </div>
          <Link
            href="/"
            className="bg-white text-teal-800 font-bold px-5 py-3 rounded-xl shadow hover:bg-teal-50 transition shrink-0"
          >
            دریافت رژیم هوشمند ←
          </Link>
        </div>
      </div>
    </div>
  );
}
