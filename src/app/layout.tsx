import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "نوتری‌کلینیک | رژیم‌ساز بالینی، ورزشی و مشاوره آنلاین تغذیه",
  description:
    "ساخت برنامه غذایی هوشمند بر پایه سفره ایرانی ویژه کاهش وزن، کبد چرب، دیابت، کلیه/همودیالیز و ورزشکاران حرفه‌ای (حجم، کات، بارگیری کربوهیدرات) زیر نظر کارشناس تغذیه.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
      </head>
      <body className="bg-[#F8FAFC] text-slate-900 antialiased selection:bg-teal-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
