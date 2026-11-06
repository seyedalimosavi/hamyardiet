import Link from "next/link";
import { getSeedData } from "../../../server/engine/pipeline.js";
import { toFaDigits } from "../../../shared/persian.js";

export const metadata = {
  title: "جدول کامل کالری و ارزش غذایی ۴۳۲ ماده غذایی سفره ایرانی | نوتری‌کلینیک",
  description:
    "بانک جامع کالری، پیمانه خانگی، شاخص گلیسمی و وضعیت تناسب با دیابت، کبد چرب و رژیم کتوژنیک برای ۴۳۲ ماده غذایی ایرانی.",
};

export default function CaloriesIndexPage() {
  const seed = getSeedData();
  const foods = seed.general_foods || [];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="bg-teal-700 text-white rounded-2xl p-6 md:p-8 shadow-md mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold mb-2">
              🍎 بانک مرجع کالری و پیمانه‌های سفره ایرانی ({toFaDigits(foods.length)} ماده غذایی)
            </h1>
            <p className="text-teal-100 text-sm md:text-base">
              بررسی دقیق کالری، معادل پیمانه خانگی و سازگاری بالینی با دیابت، کبد چرب و کلیه
            </p>
          </div>
          <Link
            href="/"
            className="bg-white text-teal-800 hover:bg-teal-50 font-bold px-5 py-3 rounded-xl shadow transition shrink-0"
          >
            ✨ ساخت برنامه غذایی شخصی‌سازی‌شده
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {foods.map((f: any) => (
            <Link
              key={f.code}
              href={`/calories/${f.slug}`}
              className="bg-white border border-slate-200 hover:border-teal-500 rounded-2xl p-4 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <h2 className="font-bold text-slate-800 text-base mb-1">{f.name}</h2>
                <p className="text-xs text-slate-500">واحد پایه: {toFaDigits(f.unit_label)}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-teal-700 font-extrabold text-sm">
                  {toFaDigits(f.calories_per_unit)} کالری
                </span>
                <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-lg font-medium">
                  مشاهده جزئیات ←
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
