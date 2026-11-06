"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  Sparkles,
  Calculator,
  MessageSquare,
  Scale,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  LogIn,
  KeyRound,
  CheckCircle2,
  Plus,
} from "lucide-react";
import SmartClinicalWizard from "@/components/SmartClinicalWizard";
import MealBuilderAndPrintView from "@/components/MealBuilderAndPrintView";
import BodyFatCalculatorSection from "@/components/BodyFatCalculatorSection";
import {
  PatientMessengerView,
  StaffManagementPanel,
} from "@/components/ConsultantAndAdminPanels";
import { toFaDigits } from "../../shared/persian.js";

export default function NutriClinicHomePage() {
  // Active Role Mode: 'USER' | 'CONSULTANT' | 'ADMIN'
  const [roleView, setRoleView] = useState<"USER" | "CONSULTANT" | "ADMIN">("USER");

  // Active User Tab when in 'USER' mode
  const [activeTab, setActiveTab] = useState<
    "wizard" | "regimen" | "body_fat" | "chat" | "weight" | "login"
  >("login");

  // Logged-in User State
  const [currentUser, setCurrentUser] = useState<any>({id: 0, phone: "", fullName: "مهمان", role: "USER"});
  const [sessionReady, setSessionReady] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [activeRegimen, setActiveRegimen] = useState<any>(null);
  const [weightLogs, setWeightLogs] = useState<any[]>([]);
  const [submittingProfile, setSubmittingProfile] = useState(false);

  // Login Form State (Test-Friendly: Any phone/code for user + explicit credentials shown for Staff)
  const [loginMode, setLoginMode] = useState<"user" | "staff">("user");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginOtp, setLoginOtp] = useState("");
  const [staffUsername, setStaffUsername] = useState("consultant");
  const [staffPassword, setStaffPassword] = useState("Diet@1405");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Weight Tracker Input
  const [newWeightInput, setNewWeightInput] = useState<number>(73.5);
  const [newWaistInput, setNewWaistInput] = useState<number>(87);

  // Local test session survives a tab reload; patient data itself stays in PostgreSQL.
  useEffect(() => {
    const restore = async () => {
      try {
        const saved = JSON.parse(sessionStorage.getItem("nutriclinic_test_session") || "null");
        if (saved?.kind === "user" && typeof saved.phone === "string") {
          const res = await fetch("/api/v1/auth", {method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:"user_login", phone:saved.phone})});
          const json = await res.json();
          if (json.ok && json.data.user) {
            setCurrentUser(json.data.user); setCurrentProfile(json.data.profile); setActiveRegimen(json.data.activeRegimen); setWeightLogs(json.data.weightLogs || []);
            setRoleView("USER"); setActiveTab(json.data.activeRegimen ? "regimen" : "wizard");
          } else sessionStorage.removeItem("nutriclinic_test_session");
        } else if (saved?.kind === "staff" && ["ADMIN", "CONSULTANT"].includes(saved.role)) {
          setRoleView(saved.role); setActiveTab("login");
        }
      } catch { sessionStorage.removeItem("nutriclinic_test_session"); }
      finally { setSessionReady(true); }
    };
    restore();
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("nutriclinic_test_session");
    setCurrentUser({id: 0, phone: "", fullName: "مهمان", role: "USER"});
    setCurrentProfile(null); setActiveRegimen(null); setWeightLogs([]);
    setRoleView("USER"); setActiveTab("login"); setLoginPhone(""); setLoginName(""); setLoginOtp(""); setLoginError(null);
  };

  // Handle User Login (Accepts ANY phone and ANY code without security friction!)
  const handleUserTestLogin = async (e?: React.FormEvent, customPhone?: string, customName?: string) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    const selectedPhone = (customPhone ?? loginPhone).trim();
    if (!selectedPhone) { setLoginError("برای ساخت یا بازیابی حساب، شماره موبایل را وارد کنید."); setLoginLoading(false); return; }
    try {
      const res = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "user_login",
          phone: selectedPhone,
          fullName: customName ?? (loginName || undefined),
          code: loginOtp || "12345",
        }),
      });
      const json = await res.json();
      if (json.ok) {
        sessionStorage.setItem("nutriclinic_test_session", JSON.stringify({kind:"user", phone: json.data.user.phone}));
        setCurrentUser(json.data.user);
        setCurrentProfile(json.data.profile);
        setActiveRegimen(json.data.activeRegimen);
        setWeightLogs(json.data.weightLogs || []);
        setRoleView("USER");
        setActiveTab(json.data.activeRegimen ? "regimen" : "wizard");
      } else {
        setLoginError(json.error?.message_fa || "خطا در ورود");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Staff Login (Consultant / Admin)
  const handleStaffLogin = async (
    e?: React.FormEvent,
    overrideUser?: string,
    overridePass?: string
  ) => {
    if (e) e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "staff_login",
          username: overrideUser ?? staffUsername,
          password: overridePass ?? staffPassword,
        }),
      });
      const json = await res.json();
      if (json.ok && json.data.user) {
        const role = json.data.user.role as "CONSULTANT" | "ADMIN";
        setRoleView(role);
        sessionStorage.setItem("nutriclinic_test_session", JSON.stringify({kind:"staff", role}));
      } else {
        setLoginError(json.error?.message_fa || "نام کاربری یا رمز عبور نادرست است.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Submitting Clinical & Athlete Profile -> Generate Regimen & Save to DB
  const handleGenerateRegimen = async (profileData: any) => {
    setSubmittingProfile(true);
    try {
      const res = await fetch("/api/v1/regimens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          userId: currentUser.id,
          fullName: currentUser.fullName,
          profile: profileData,
        }),
      });
      const json = await res.json();
      if (json.ok && json.data.regimen) {
        setActiveRegimen(json.data.regimen);
        setActiveTab("regimen");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handleAddWeightLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/v1/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_weight",
        userId: currentUser.id,
        weightKg: newWeightInput,
        waistCm: newWaistInput,
        note: "ثبت وزن در پروفایل",
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setWeightLogs(json.data.weightLogs || []);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 pb-20 md:pb-8">
      {/* =====================================================================
          TOP TEST-MODE BAR: 1-CLICK SWITCH BETWEEN USER, CONSULTANT & ADMIN
         ===================================================================== */}
      <div className="no-print bg-slate-900 text-white border-b border-slate-800 px-3 sm:px-6 py-2.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-slate-950 font-extrabold px-2.5 py-0.5 rounded-full text-[11px]">
              🧪 نسخه تست کامل (بدون محدودیت امنیتی/OTP)
            </span>
            <span className="text-slate-300 hidden sm:inline">
              هر پرونده یا رژیمی بسازید بلافاصله در پنل کارشناس و مدیر ذخیره و قابل مشاهده است:
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span>حساب فعلی: {roleView === "ADMIN" ? "مدیر (تست)" : roleView === "CONSULTANT" ? "کارشناس (تست)" : currentUser.id ? `${currentUser.fullName} — ${currentUser.phone}` : "وارد نشده‌اید"}</span>
            {(currentUser.id > 0 || roleView !== "USER") && <button type="button" onClick={handleLogout} className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg font-bold">خروج از حساب</button>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => { if (currentUser.id) { setRoleView("USER"); sessionStorage.setItem("nutriclinic_test_session", JSON.stringify({kind:"user", phone:currentUser.phone})); } else { setRoleView("USER"); setActiveTab("login"); } }}
              className={`px-3 py-1.5 rounded-lg font-extrabold flex items-center gap-1 transition ${
                roleView === "USER"
                  ? "bg-teal-500 text-slate-950 shadow-2xs"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              نمای کاربر ({currentUser.id ? currentUser.fullName : "ورود"})
            </button>

            <button
              type="button"
              onClick={() => {setRoleView("CONSULTANT"); sessionStorage.setItem("nutriclinic_test_session", JSON.stringify({kind:"staff",role:"CONSULTANT"}));}}
              className={`px-3 py-1.5 rounded-lg font-extrabold flex items-center gap-1 transition ${
                roleView === "CONSULTANT"
                  ? "bg-teal-500 text-slate-950 shadow-2xs"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              پنل کارشناس تغذیه (محمدرضا فرحانی)
            </button>

            <button
              type="button"
              onClick={() => {setRoleView("ADMIN"); sessionStorage.setItem("nutriclinic_test_session", JSON.stringify({kind:"staff",role:"ADMIN"}));}}
              className={`px-3 py-1.5 rounded-lg font-extrabold flex items-center gap-1 transition ${
                roleView === "ADMIN"
                  ? "bg-teal-500 text-slate-950 shadow-2xs"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              پنل مدیر کل
            </button>

            <button
              type="button"
              onClick={() => {
                setRoleView("USER");
                setActiveTab("login");
              }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition ${
                roleView === "USER" && activeTab === "login"
                  ? "bg-white text-slate-950"
                  : "bg-slate-800 text-teal-300 hover:bg-slate-700"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              ورود با شماره جدید / ورود کارشناس و مدیر
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MAIN BRAND HEADER (Hidden in Print)
         ===================================================================== */}
      <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col items-stretch gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center font-extrabold text-lg shadow-xs">
              NC
            </div>
            <div>
              <div className="font-extrabold text-base sm:text-lg text-slate-900">
                نوتری‌کلینیک — رژیم‌ساز بالینی و ورزشی هوشمند
              </div>
              <div className="text-xs text-slate-500">
                بر پایه سفره ایرانی | زیر نظر محمدرضا فرحانی (کارشناس تغذیه — ت-۱۲۱۹۰)
              </div>
            </div>
          </div>

          {roleView === "USER" && currentUser.id > 0 && (
            <nav className="hidden md:flex flex-wrap items-center gap-2" aria-label="منوی اصلی">
              <button
                type="button"
                onClick={() => setActiveTab("wizard")}
                className={`px-4 py-2 rounded-xl text-xs lg:text-sm font-extrabold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
                  activeTab === "wizard"
                    ? "bg-teal-700 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                ساخت رژیم هوشمند
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("regimen")}
                className={`px-4 py-2 rounded-xl text-xs lg:text-sm font-extrabold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
                  activeTab === "regimen"
                    ? "bg-teal-700 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <FileText className="w-4 h-4" />
                برنامه من و چاپ A4
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("body_fat")}
                className={`px-4 py-2 rounded-xl text-xs lg:text-sm font-extrabold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
                  activeTab === "body_fat"
                    ? "bg-teal-700 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Calculator className="w-4 h-4" />
                محاسبه درصد چربی بدن
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={`px-4 py-2 rounded-xl text-xs lg:text-sm font-extrabold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
                  activeTab === "chat"
                    ? "bg-teal-700 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                چت با کارشناس
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("weight")}
                className={`px-4 py-2 rounded-xl text-xs lg:text-sm font-extrabold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
                  activeTab === "weight"
                    ? "bg-teal-700 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Scale className="w-4 h-4" />
                ثبت وزن
              </button>

              <Link
                href="/calories"
                className="px-3 py-2 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 transition shrink-0 whitespace-nowrap"
              >
                🍎 بانک کالری (۴۳۲ غذا)
              </Link>
            </nav>
          )}
        </div>
      </header>

      {/* =====================================================================
          MAIN CONTENT AREA
         ===================================================================== */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1">
        {!sessionReady ? <div className="text-center p-8 text-slate-500">در حال آماده‌سازی حساب...</div> : roleView === "CONSULTANT" || roleView === "ADMIN" ? (
          <StaffManagementPanel role={roleView} />
        ) : (
          <>
            {/* TAB: LOGIN / ACCOUNT SWITCHER (Zero Friction for Users + Explicit Credentials for Staff) */}
            {activeTab === "login" && (
              <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      ورود به سامانه نوتری‌کلینیک (نسخه تست بدون محدودیت امنیتی)
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1">
                      به عنوان کاربر عادی با هر شماره و هر کدی وارد شوید؛ یا با نام کاربری و رمز عبور اختصاصی زیر وارد پنل کارشناس و مدیر شوید.
                    </p>
                  </div>
                </div>

                {/* Mode Switcher */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLoginMode("user")}
                    className={`py-3 rounded-xl font-extrabold text-sm border-2 transition ${
                      loginMode === "user"
                        ? "bg-teal-700 text-white border-teal-700"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    👤 ورود مراجع / کاربر (با هر شماره و کدی)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMode("staff")}
                    className={`py-3 rounded-xl font-extrabold text-sm border-2 transition ${
                      loginMode === "staff"
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    🩺 ورود کارشناس تغذیه و مدیر کل
                  </button>
                </div>

                {loginError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs font-bold">
                    {loginError}
                  </div>
                )}

                {loginMode === "user" ? (
                  <form onSubmit={handleUserTestLogin} className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 leading-relaxed">
                      <strong>✅ تست آزاد و بدون گیر امنیتی:</strong> شماره موبایل و هر کد دلخواهی وارد کنید، بلافاصله وارد حساب جدید می‌شوید و رژیمی که می‌سازید در پنل کارشناس و مدیر ذخیره می‌گردد!
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          نام و نام خانوادگی مراجع
                        </label>
                        <input
                          type="text"
                          value={loginName}
                          onChange={(e) => setLoginName(e.target.value)}
                          placeholder="مثلاً: رضا رضایی"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          شماره موبایل (هر شماره‌ای مجاز است)
                        </label>
                        <input
                          type="text"
                          value={loginPhone}
                          onChange={(e) => setLoginPhone(e.target.value)}
                          placeholder="مثلاً: 09121234567"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          کد تایید فرضی (هر عددی مجاز است)
                        </label>
                        <input
                          type="text"
                          value={loginOtp}
                          onChange={(e) => setLoginOtp(e.target.value)}
                          placeholder="مثلاً: 12345"
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white font-extrabold py-3.5 rounded-xl shadow transition text-sm"
                    >
                      {loginLoading
                        ? "در حال ورود..."
                        : "ورود فوری و شروع ساخت رژیم (ثبت پرونده در پنل کارشناس و مدیر)"}
                    </button>

                    {/* Quick Demo Patient Switchers */}
                    <div className="pt-4 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-500 mb-2">
                        یا ورود ۱ کلیکی با یکی از پرونده‌های آماده جهت تست سریع:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUserTestLogin(undefined, "09120000003", "سارا محمدی")
                          }
                          className="p-2.5 rounded-xl border border-slate-200 hover:bg-teal-50 text-xs font-bold text-slate-800 text-right"
                        >
                          👩 سارا محمدی (کبد چرب و کاهش وزن)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUserTestLogin(undefined, "09120000004", "امیرعلی احمدی")
                          }
                          className="p-2.5 rounded-xl border border-slate-200 hover:bg-teal-50 text-xs font-bold text-slate-800 text-right"
                        >
                          🏋️ امیرعلی احمدی (ورزشکار بدنسازی — دوره کات)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUserTestLogin(undefined, "09120000005", "عبدالمجید ذاکری")
                          }
                          className="p-2.5 rounded-xl border border-slate-200 hover:bg-teal-50 text-xs font-bold text-slate-800 text-right"
                        >
                          🩸 عبدالمجید ذاکری (پرونده همودیالیز)
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-5">
                    {/* Explicit Credentials Displayed Right on Login Screen as Requested */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-teal-50 border-2 border-teal-300 rounded-2xl p-4 space-y-2">
                        <div className="font-extrabold text-teal-950 text-sm flex items-center gap-1.5">
                          <Stethoscope className="w-4 h-4 text-teal-700" />
                          اطلاعات ورود کارشناس تغذیه:
                        </div>
                        <div className="text-xs text-slate-800 space-y-1 bg-white p-3 rounded-xl border border-teal-200">
                          <div>
                            نام کاربری: <code className="font-extrabold text-teal-800">consultant</code>{" "}
                            (یا <code className="font-bold">09120000002</code>)
                          </div>
                          <div>
                            رمز عبور: <code className="font-extrabold text-teal-800">Diet@1405</code>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setStaffUsername("consultant");
                            setStaffPassword("Diet@1405");
                            handleStaffLogin(undefined, "consultant", "Diet@1405");
                          }}
                          className="w-full bg-teal-700 hover:bg-teal-800 text-white font-extrabold py-2.5 rounded-xl text-xs transition"
                        >
                          ورود ۱ کلیکی به پنل کارشناس تغذیه ←
                        </button>
                      </div>

                      <div className="bg-slate-100 border-2 border-slate-300 rounded-2xl p-4 space-y-2">
                        <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-slate-700" />
                          اطلاعات ورود مدیر کل سایت:
                        </div>
                        <div className="text-xs text-slate-800 space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                          <div>
                            نام کاربری: <code className="font-extrabold text-slate-900">admin</code>{" "}
                            (یا <code className="font-bold">09120000001</code>)
                          </div>
                          <div>
                            رمز عبور: <code className="font-extrabold text-slate-900">Admin@1405</code>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setStaffUsername("admin");
                            setStaffPassword("Admin@1405");
                            handleStaffLogin(undefined, "admin", "Admin@1405");
                          }}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-2.5 rounded-xl text-xs transition"
                        >
                          ورود ۱ کلیکی به پنل مدیریت کل ←
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleStaffLogin} className="space-y-4 pt-2 border-t border-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            نام کاربری کارشناس یا مدیر
                          </label>
                          <input
                            type="text"
                            value={staffUsername}
                            onChange={(e) => setStaffUsername(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            رمز عبور
                          </label>
                          <input
                            type="text"
                            value={staffPassword}
                            onChange={(e) => setStaffPassword(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loginLoading}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        <KeyRound className="w-4 h-4" />
                        ورود با نام کاربری و رمز عبور
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* TAB: SMART CLINICAL & ATHLETE WIZARD */}
            {activeTab === "wizard" && (
              <SmartClinicalWizard
                key={currentUser.id}
                initialProfile={currentProfile}
                userFullName={currentUser.fullName}
                onFullNameChange={(newName) =>
                  setCurrentUser((prev: any) => ({ ...prev, fullName: newName }))
                }
                onSubmitProfile={handleGenerateRegimen}
                submitting={submittingProfile}
              />
            )}

            {/* TAB: MULTI-OPTION MEAL BUILDER & 2-SHEET SEPARATE A4 PRINTING */}
            {activeTab === "regimen" && (
              <>
                {activeRegimen ? (
                  <MealBuilderAndPrintView
                    regimen={activeRegimen}
                    onRegimenUpdated={(updated) => setActiveRegimen(updated)}
                    onEditProfileClick={() => setActiveTab("wizard")}
                  />
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
                    <div className="text-lg font-extrabold text-slate-800">
                      هنوز برنامه‌ای برای این حساب صادر نشده است
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("wizard")}
                      className="bg-teal-600 text-white font-extrabold px-6 py-3 rounded-xl"
                    >
                      شروع ساخت برنامه غذایی هوشمند
                    </button>
                  </div>
                )}
              </>
            )}

            {/* TAB: DEDICATED 4-METHOD BODY FAT % & BODY COMPOSITION LAB */}
            {activeTab === "body_fat" && (
              <BodyFatCalculatorSection
                initialGender={currentProfile?.gender || "male"}
                initialAge={currentProfile?.age || 30}
                initialHeight={currentProfile?.heightCm || 175}
                initialWeight={currentProfile?.weightKg || 78}
                initialWaist={currentProfile?.waistCm || 85}
                isAthlete={Boolean(currentProfile?.isAthlete)}
                onApplyBodyFat={(bfPct, method) => {
                  setCurrentProfile((prev: any) => ({
                    ...(prev || {}),
                    bodyFatPct: bfPct,
                    bodyFatMethod: method,
                    useVerifiedBodyFat: true,
                  }));
                }}
              />
            )}

            {/* TAB: SIMPLE MESSENGER CONSULTATION CHAT */}
            {activeTab === "chat" && <PatientMessengerView user={currentUser} />}

            {/* TAB: WEIGHT TRACKER & SVG PROGRESS CHART */}
            {activeTab === "weight" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs h-fit">
                  <h2 className="font-extrabold text-lg text-slate-900 mb-1">
                    ⚖️ ثبت وزن جدید و دور کمر
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    در صورت تغییر وزن بیش از ۳ کیلوگرم، سیستم بازکالیبراسیون کالری را به شما پیشنهاد می‌دهد.
                  </p>
                  <form onSubmit={handleAddWeightLog} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        وزن امروز (کیلوگرم — ناشتا)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={newWeightInput}
                        onChange={(e) => setNewWeightInput(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        دور کمر (سانتی‌متر — اختیاری)
                      </label>
                      <input
                        type="number"
                        value={newWaistInput}
                        onChange={(e) => setNewWaistInput(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-bold"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white font-extrabold py-3 rounded-xl shadow flex items-center justify-center gap-1.5 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      ثبت در نمودار وزن
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                  <h3 className="font-extrabold text-base text-slate-900">
                    📈 تاریخچه تغییرات وزن ({currentUser.fullName})
                  </h3>
                  {weightLogs.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      هنوز رکورد وزنی ثبت نشده است.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {weightLogs.map((w: any) => (
                        <div
                          key={w.id}
                          className="border border-slate-200 rounded-xl p-3.5 flex items-center justify-between bg-slate-50"
                        >
                          <div>
                            <div className="font-extrabold text-sm text-slate-900">
                              {toFaDigits(w.weightKg)} کیلوگرم
                            </div>
                            <div className="text-xs text-slate-500">
                              تاریخ: {toFaDigits(w.logDate)} | {w.note || "ثبت دوره‌ای"}
                            </div>
                          </div>
                          {w.waistCm && (
                            <span className="bg-teal-50 text-teal-800 px-3 py-1 rounded-lg text-xs font-bold">
                              دور کمر: {toFaDigits(w.waistCm)} سانتی‌متر
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* =====================================================================
          MOBILE BOTTOM TAB BAR (Native App Feel on < 768px, Hidden in Print)
         ===================================================================== */}
      {roleView === "USER" && currentUser.id > 0 && (
        <div className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-2 py-1.5 grid grid-cols-5 gap-1 shadow-lg">
          <button
            type="button"
            onClick={() => setActiveTab("wizard")}
            className={`flex flex-col items-center py-1 rounded-xl text-[11px] font-bold ${
              activeTab === "wizard" ? "text-teal-700 bg-teal-50" : "text-slate-500"
            }`}
          >
            <Sparkles className="w-4 h-4 mb-0.5" />
            ساخت رژیم
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("regimen")}
            className={`flex flex-col items-center py-1 rounded-xl text-[11px] font-bold ${
              activeTab === "regimen" ? "text-teal-700 bg-teal-50" : "text-slate-500"
            }`}
          >
            <FileText className="w-4 h-4 mb-0.5" />
            برنامه من
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("body_fat")}
            className={`flex flex-col items-center py-1 rounded-xl text-[11px] font-bold ${
              activeTab === "body_fat" ? "text-teal-700 bg-teal-50" : "text-slate-500"
            }`}
          >
            <Calculator className="w-4 h-4 mb-0.5" />
            درصد چربی
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex flex-col items-center py-1 rounded-xl text-[11px] font-bold ${
              activeTab === "chat" ? "text-teal-700 bg-teal-50" : "text-slate-500"
            }`}
          >
            <MessageSquare className="w-4 h-4 mb-0.5" />
            مشاوره
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            className={`flex flex-col items-center py-1 rounded-xl text-[11px] font-bold ${
              activeTab === "login" ? "text-teal-700 bg-teal-50" : "text-slate-500"
            }`}
          >
            <LogIn className="w-4 h-4 mb-0.5" />
            حساب/پنل‌ها
          </button>
        </div>
      )}
    </div>
  );
}
