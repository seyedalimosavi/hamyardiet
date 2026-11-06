"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  User,
  FileText,
  MessageSquare,
  Award,
  CheckCircle2,
  Gift,
  PlusCircle,
  TrendingUp,
  Database,
  ShieldCheck,
  RefreshCw,
  Dumbbell,
  HeartPulse,
  Edit3,
} from "lucide-react";
import { toFaDigits, formatToman, formatJalali } from "../../shared/persian.js";
import { CONDITIONS } from "../../shared/constants.js";

/* ============================================================================
   1. PATIENT SIMPLE MESSENGER CHAT VIEW (Telegram/WhatsApp Style)
   ============================================================================ */
export function PatientMessengerView({ user }: { user: any }) {
  const [threads, setThreads] = useState<any[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMessages = async () => {
    try {
      const res = await fetch(`/api/v1/consultations?userId=${user.id}&role=USER`);
      const json = await res.json();
      if (json.ok) {
        setThreads(json.data.threads || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const timer = setInterval(loadMessages, 8000);
    return () => clearInterval(timer);
  }, [user.id]);

  const activeThread = threads[0] || null;
  const messages = activeThread?.messages || [];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/v1/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_message",
          threadId: activeThread?.id || null,
          userId: user.id,
          senderId: user.id,
          senderRole: "USER",
          senderName: user.fullName,
          bodyText: msgText.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setMsgText("");
        await loadMessages();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs max-w-4xl mx-auto flex flex-col h-[72vh]">
      {/* Messenger Top Bar */}
      <div className="bg-teal-800 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-teal-600 border-2 border-teal-300 flex items-center justify-center font-extrabold text-sm">
            🩺
          </div>
          <div>
            <h2 className="font-extrabold text-base">
              گفتگوی مستقیم با کارشناس تغذیه (محمدرضا فرحانی — نظام پزشکی ت-۱۲۱۹۰)
            </h2>
            <p className="text-xs text-teal-200">
              پیام شما مستقیماً همراه با پرونده و برنامه غذایی‌تان در پنل کارشناس نمایش داده می‌شود
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadMessages}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          title="بروزرسانی پیام‌ها"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Bubbles Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#F1F5F9]">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm font-bold">
            در حال بارگذاری گفتگو...
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center max-w-md mx-auto my-8">
            <MessageSquare className="w-10 h-10 text-teal-600 mx-auto mb-2" />
            <div className="font-extrabold text-slate-900 text-base mb-1">
              هنوز پیامی ارسال نکرده‌اید
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              هر سوالی درباره جایگزینی غذاها، نحوه پخت، مکمل‌های ورزشی یا داروهای خود دارید، در کادر پایین بنویسید و ارسال کنید.
            </p>
          </div>
        ) : (
          messages.map((m: any) => {
            const isMe = m.senderRole === "USER";
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? "items-start" : "items-end"}`}
              >
                <div
                  className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-2xs ${
                    isMe
                      ? "bg-teal-700 text-white rounded-tr-xs"
                      : "bg-white text-slate-900 border border-slate-200 rounded-tl-xs"
                  }`}
                >
                  <div
                    className={`text-[11px] font-extrabold mb-1 ${
                      isMe ? "text-teal-200" : "text-teal-700"
                    }`}
                  >
                    {isMe ? `👤 ${m.senderName}` : `🩺 ${m.senderName}`}
                  </div>
                  <div>{m.bodyText}</div>
                  <div
                    className={`text-[10px] mt-1.5 text-left ${
                      isMe ? "text-teal-200" : "text-slate-400"
                    }`}
                  >
                    {formatJalali(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Question Suggestions */}
      <div className="bg-slate-100 px-4 py-2 border-t border-slate-200 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-bold text-slate-500 shrink-0">سوالات آماده:</span>
        {[
          "سلام وقت بخیر، برنامه‌ام رو دریافت کردم، لطفاً بررسی و تایید بفرمایید.",
          "آیا می‌تونم وعده شام رو زودتر حدود ساعت ۷ عصر میل کنم؟",
          "در روزهای غیرتمرینی هم مکمل کراتین رو مصرف کنم؟",
        ].map((q, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setMsgText(q)}
            className="text-xs bg-white hover:bg-teal-50 text-slate-700 border border-slate-200 px-3 py-1 rounded-full shrink-0 transition"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Simple Messenger Input Bar */}
      <form
        onSubmit={handleSend}
        className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2"
      >
        <input
          type="text"
          value={msgText}
          onChange={(e) => setMsgText(e.target.value)}
          placeholder="پیام خود را برای کارشناس تغذیه بنویسید..."
          className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium focus:bg-white focus:border-teal-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !msgText.trim()}
          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-extrabold px-5 py-3 rounded-xl flex items-center gap-1.5 transition shrink-0"
        >
          <Send className="w-4 h-4" />
          ارسال
        </button>
      </form>
    </div>
  );
}

/* ============================================================================
   2. UNIFIED CONSULTANT & ADMIN PANEL (Role-Scoped Access)
   ============================================================================ */
export function StaffManagementPanel({ role }: { role: "CONSULTANT" | "ADMIN" }) {
  const [cases, setCases] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [filterWaiting, setFilterWaiting] = useState<boolean>(false);
  const [staffSection, setStaffSection] = useState<"cases" | "food_bank" | "analytics">("cases");
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);

  // Consultant Reply & Regimen Override State
  const [replyText, setReplyText] = useState("");
  const [consultantNote, setConsultantNote] = useState("");
  const [consultantName, setConsultantName] = useState("");
  const [councilCode, setCouncilCode] = useState("");
  const [editingSlotOption, setEditingSlotOption] = useState<{
    slotId: string;
    optionId: string;
    text: string;
  } | null>(null);

  // Admin New Meal Form State (with live scanX preview)
  const [newMealName, setNewMealName] = useState("");
  const [newMealDesc, setNewMealDesc] = useState("");
  const [newMealSlot, setNewMealSlot] = useState("l");
  const [newMealCal, setNewMealCal] = useState(420);
  const [newMealCook, setNewMealCook] = useState("pot");
  const [liveScannedTags, setLiveScannedTags] = useState<string[]>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`/api/v1/admin?role=${role}`);
      const json = await res.json();
      if (json.ok) {
        const fetchedCases = json.data.cases || [];
        setCases(fetchedCases);
        setAdminStats(json.data.adminStats);
        if (fetchedCases.length > 0) setSelectedUserId(prev => prev ?? fetchedCases[0].user.id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(fetchDashboardData, 8000);
    return () => clearInterval(timer);
  }, [role]);

  const selectedCase = cases.find((c) => c.user.id === selectedUserId) || cases[0] || null;

  useEffect(() => {
    if (selectedCase) {
      setConsultantNote(selectedCase.latestRegimen?.consultantOverrideNote || "");
    }
  }, [selectedCase?.user?.id]);

  // Live scanX preview when Admin types a new meal
  useEffect(() => {
    if (!newMealName && !newMealDesc) {
      setLiveScannedTags([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch("/api/v1/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "scan_preview",
          name: newMealName,
          ingredients_desc: newMealDesc,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setLiveScannedTags(json.data.scannedNegTags || []);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [newMealName, newMealDesc]);

  const handleSendConsultantReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !replyText.trim()) return;
    const thread = selectedCase.threads?.[0];
    const res = await fetch("/api/v1/consultations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send_message",
        threadId: thread?.id || null,
        userId: selectedCase.user.id,
        senderId: role === "ADMIN" ? 1 : 2,
        senderRole: role,
        senderName:
          role === "ADMIN"
            ? "مدیریت کلینیک"
            : "محمدرضا فرحانی (کارشناس تغذیه — ت-۱۲۱۹۰)",
        bodyText: replyText.trim(),
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setReplyText("");
      showToast("✅ پاسخ شما در پیام‌رسان بیمار ثبت شد.");
      await fetchDashboardData();
    }
  };

  const handleGiftQuota = async () => {
    if (!selectedCase) return;
    const res = await fetch("/api/v1/consultations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refund_quota",
        userId: selectedCase.user.id,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      showToast("🎁 ۱ سهمیه سوال هدیه به پرونده بیمار اضافه شد.");
      await fetchDashboardData();
    }
  };

  const handleSignAndSaveRegimen = async (updatedDay1Slots?: any[], sign = false) => {
    if (sign && (!consultantName.trim() || !councilCode.trim())) { showToast("نام و شماره نظام پزشکی کارشناس را وارد کنید."); return; }
    if (!selectedCase?.latestRegimen) return;
    const res = await fetch("/api/v1/regimens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "consultant_update",
        regimenId: selectedCase.latestRegimen.id,
        day1Slots: updatedDay1Slots || selectedCase.latestRegimen.day1SlotsJson,
        consultantOverrideNote: consultantNote,
        signRegimen: sign,
        consultantName: consultantName.trim(),
        councilCode: councilCode.trim(),
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setEditingSlotOption(null);
      showToast(sign ? "تأیید کارشناس ثبت شد." : "تغییرات ذخیره شد؛ برای تأیید، مشخصات کارشناس را وارد کنید.");
      await fetchDashboardData();
    }
  };

  const handleSaveInlineOptionEdit = async () => {
    if (!editingSlotOption || !selectedCase?.latestRegimen) return;
    const slots = JSON.parse(JSON.stringify(selectedCase.latestRegimen.day1SlotsJson || []));
    for (const s of slots) {
      if (s.slot_id === editingSlotOption.slotId) {
        for (const opt of s.options || []) {
          if (opt.option_id === editingSlotOption.optionId) {
            opt.scaled_ingredients_fa = editingSlotOption.text;
            opt.print_compact_line_fa = `${opt.title_fa}: ${editingSlotOption.text}`;
          }
        }
      }
    }
    await handleSignAndSaveRegimen(slots);
  };

  const handleCreateCustomMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMealName.trim() || !newMealDesc.trim()) return;
    const res = await fetch("/api/v1/foods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newMealName,
        ingredients_desc: newMealDesc,
        slot_type: newMealSlot,
        base_calories: Number(newMealCal),
        cook_kind: newMealCook,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setNewMealName("");
      setNewMealDesc("");
      showToast(json.message_fa);
      await fetchDashboardData();
    }
  };

  const filteredCases = filterWaiting
    ? cases.filter((c) => c.waitingReply)
    : cases;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-bold border border-teal-400">
          {toast}
        </div>
      )}

      {/* Top Role Header & Sub-Navigation */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-extrabold px-3 py-1 rounded-full mb-1.5">
            <ShieldCheck className="w-4 h-4" />
            {role === "ADMIN"
              ? "پنل فرماندهی و مدیریت کل سایت (دسترسی کامل)"
              : "پنل تخصصی کارشناس تغذیه — محمدرضا فرحانی (نظام پزشکی ت-۱۲۱۹۰)"}
          </div>
          <h1 className="text-xl font-extrabold">
            {role === "ADMIN"
              ? "مدیریت پرونده‌های مراجعین، بانک غذا، تعرفه‌ها و پیام‌رسان مشاوره"
              : "میز کار بالینی کارشناس: بررسی پرونده‌ها، ویرایش و امضای رژیم و پاسخگویی چت"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStaffSection("cases")}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
              staffSection === "cases"
                ? "bg-teal-500 text-slate-950"
                : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            <User className="w-4 h-4" />
            پرونده‌های مراجعین و چت ({toFaDigits(cases.length)})
          </button>

          {role === "ADMIN" && (
            <>
              <button
                type="button"
                onClick={() => setStaffSection("food_bank")}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
                  staffSection === "food_bank"
                    ? "bg-teal-500 text-slate-950"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
              >
                <Database className="w-4 h-4" />
                مدیریت بانک غذا و اسکنر scanX
              </button>

              <button
                type="button"
                onClick={() => setStaffSection("analytics")}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
                  staffSection === "analytics"
                    ? "bg-teal-500 text-slate-950"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                آمار فروش، MRR و پلن‌ها
              </button>
            </>
          )}

          <button
            type="button"
            onClick={fetchDashboardData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300"
            title="بروزرسانی لیست پرونده‌ها"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1: SPLIT-SCREEN PATIENT CASES, REGIMEN EDITOR & MESSENGER CHAT
         ===================================================================== */}
      {staffSection === "cases" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Right Column: List of Patient Files */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs h-fit space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-extrabold text-sm text-slate-900">
                📂 لیست پرونده‌های مراجعین ({toFaDigits(filteredCases.length)})
              </h2>
              <button
                type="button"
                onClick={() => setFilterWaiting(!filterWaiting)}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold transition ${
                  filterWaiting
                    ? "bg-amber-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {filterWaiting ? "نمایش همه" : "فقط منتظر پاسخ"}
              </button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-xs text-slate-500">در حال بارگذاری پرونده‌ها...</div>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pl-1">
                {filteredCases.map((c: any) => {
                  const isSelected = selectedCase?.user.id === c.user.id;
                  const conds = Array.isArray(c.profile?.conditionsJson)
                    ? c.profile.conditionsJson
                    : [];
                  return (
                    <button
                      key={c.user.id}
                      type="button"
                      onClick={() => setSelectedUserId(c.user.id)}
                      className={`w-full p-3.5 rounded-xl border text-right transition flex flex-col gap-1.5 ${
                        isSelected
                          ? "bg-teal-50 border-teal-600 shadow-2xs"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-sm text-slate-900">
                          {c.user.fullName}
                        </span>
                        {c.waitingReply ? (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            💬 پیام جدید
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            پاسخ داده شده
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>موبایل: {toFaDigits(c.user.phone)}</span>
                        {c.latestRegimen && (
                          <span className="font-bold text-teal-700">
                            {toFaDigits(
                              c.latestRegimen.calculatedMetricsJson?.targetCal || 1500
                            )}{" "}
                            کالری
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {c.profile?.isAthlete && (
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            🏆 ورزشکار ({c.profile.sportPhase || "حرفه‌ای"})
                          </span>
                        )}
                        {c.profile?.isDialysis && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            🩸 همودیالیز
                          </span>
                        )}
                        {conds.map((ck: string) => (
                          <span
                            key={ck}
                            className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-md"
                          >
                            {CONDITIONS[ck]?.label_fa || ck}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Left Column: Selected Patient 360-Degree File + Live Regimen Editor + Simple Messenger Chat */}
          <div className="lg:col-span-8 space-y-6">
            {selectedCase ? (
              <>
                {/* 1. Patient Clinical Summary Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-extrabold text-lg text-slate-900">
                        پرونده بالینی: {selectedCase.user.fullName} (موبایل:{" "}
                        {toFaDigits(selectedCase.user.phone)})
                      </h3>
                      <p className="text-xs text-slate-500">
                        کد پیگیری آخرین رژیم:{" "}
                        <strong>
                          {toFaDigits(selectedCase.latestRegimen?.trackingCode || "ندارد")}
                        </strong>{" "}
                        | سهمیه سوالات مشاوره: {toFaDigits(selectedCase.user.questionsQuota)} سوال
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGiftQuota}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shrink-0"
                    >
                      <Gift className="w-4 h-4 text-amber-600" />
                      ➕ هدیه / برگشت ۱ سهمیه سوال
                    </button>
                  </div>

                  {selectedCase.profile ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-500 block">سن / قد / وزن:</span>
                        <strong className="text-slate-900 text-sm">
                          {toFaDigits(selectedCase.profile.age)} ساله |{" "}
                          {toFaDigits(selectedCase.profile.heightCm)} سم |{" "}
                          {toFaDigits(selectedCase.profile.weightKg)} ک‌گ
                        </strong>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-500 block">وضعیت ورزشی / درصد چربی:</span>
                        <strong className="text-slate-900 text-sm">
                          {selectedCase.profile.isAthlete
                            ? `ورزشکار (${selectedCase.profile.sportPhase})`
                            : "کاربر عادی"}
                          {selectedCase.profile.bodyFatPct
                            ? ` — چربی ${toFaDigits(selectedCase.profile.bodyFatPct)}٪`
                            : ""}
                        </strong>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-500 block">بیماری‌ها و شرایط:</span>
                        <strong className="text-rose-800">
                          {Array.isArray(selectedCase.profile.conditionsJson) &&
                          selectedCase.profile.conditionsJson.length > 0
                            ? selectedCase.profile.conditionsJson
                                .map((k: string) => CONDITIONS[k]?.label_fa || k)
                                .join("، ") +
                              (selectedCase.profile.isDialysis ? " (تحت همودیالیز)" : "")
                            : "سالم (بدون بیماری زمینه‌ای)"}
                        </strong>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-slate-500 block">داروها و مکمل‌ها:</span>
                        <strong className="text-slate-800">
                          {selectedCase.profile.medicationsText || "ثبت نشده"}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      این کاربر هنوز فرم پرونده سلامت را تکمیل نکرده است.
                    </div>
                  )}
                </div>

                {/* 2. Simple Messenger Chat Box with Patient */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-teal-700 text-white px-5 py-3 flex items-center justify-between">
                    <div className="font-extrabold text-sm flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      💬 چت پیام‌رسان با «{selectedCase.user.fullName}»
                    </div>
                    <span className="text-xs text-teal-100">
                      پاسخ‌های آماده کلینیکی با ۱ کلیک قابل درج هستند
                    </span>
                  </div>

                  <div className="p-4 bg-slate-100 max-h-72 overflow-y-auto space-y-2.5">
                    {(selectedCase.threads?.[0]?.messages || []).length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-500">
                        هنوز پیامی در این پرونده ثبت نشده است. می‌توانید پیام خوش‌آمدگویی یا نکته بالینی برای بیمار ارسال کنید.
                      </div>
                    ) : (
                      (selectedCase.threads?.[0]?.messages || []).map((m: any) => {
                        const isStaff = m.senderRole !== "USER";
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${isStaff ? "items-start" : "items-end"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                                isStaff
                                  ? "bg-teal-700 text-white"
                                  : "bg-white text-slate-900 border border-slate-200"
                              }`}
                            >
                              <div className="font-extrabold mb-0.5 opacity-80">
                                {m.senderName}
                              </div>
                              <div>{m.bodyText}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Canned Responses for Consultant */}
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto">
                    <span className="text-[11px] font-bold text-slate-500 shrink-0">پاسخ آماده:</span>
                    {[
                      "سلام، برنامه غذایی شما بررسی و امضا شد. لطفاً ترتیب مصرف سالاد، پروتئین و غلات را رعایت فرمایید.",
                      "در کبد چرب مصرف خرما به صورت ناشتا ممنوع است؛ حداکثر ۲ عدد بلافاصله بعد از ناهار مجاز است.",
                      "در روزهای غیرتمرینی ۵ گرم کراتین را با ۱ لیوان آب همراه وعده ناهار ادامه دهید.",
                    ].map((canned, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setReplyText(canned)}
                        className="text-[11px] bg-white hover:bg-teal-50 border border-slate-200 rounded-full px-2.5 py-1 text-slate-700 shrink-0"
                      >
                        {canned.slice(0, 42)}...
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={handleSendConsultantReply}
                    className="p-3 bg-white border-t border-slate-200 flex gap-2"
                  >
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="پاسخ کارشناس تغذیه به بیمار..."
                      className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs sm:text-sm"
                    />
                    <button
                      type="submit"
                      className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      ارسال پاسخ
                    </button>
                  </form>
                </div>

                {/* 3. Consultant Direct Regimen Editor & Official Signature */}
                {selectedCase.latestRegimen && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-teal-600" />
                          بررسی، ویرایش مستقیم و امضای برنامه غذایی بیمار
                        </h3>
                        <p className="text-xs text-slate-500">
                          می‌توانید یادداشت اختصاصی بالای برگه بنویسید یا مقادیر هر وعده را ویرایش و با مهر نظام پزشکی تایید کنید.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSignAndSaveRegimen(undefined, true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs shrink-0"
                      >
                        <Award className="w-4 h-4" />
                        ✍️ ثبت یادداشت و مهر و امضای کارشناس روی برگه
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input className="rounded-lg border border-slate-300 p-2 text-sm" placeholder="نام کارشناس تنظیم‌کننده" value={consultantName} onChange={e => setConsultantName(e.target.value)} />
                      <input className="rounded-lg border border-slate-300 p-2 text-sm" placeholder="شماره نظام پزشکی کارشناس" value={councilCode} onChange={e => setCouncilCode(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        یادداشت اختصاصی کارشناس تغذیه (در بالای برگه چاپی بیمار درج می‌شود):
                      </label>
                      <textarea
                        rows={2}
                        value={consultantNote}
                        onChange={(e) => setConsultantNote(e.target.value)}
                        placeholder="مثلاً: برنامه شما بررسی شد. لطفاً شام را قبل از ساعت ۲۰:۳۰ میل کنید..."
                        className="w-full rounded-xl border border-slate-300 p-3 text-xs sm:text-sm"
                      />
                    </div>

                    <div className="space-y-2.5 max-h-96 overflow-y-auto">
                      {(selectedCase.latestRegimen.day1SlotsJson || []).map((slot: any) => (
                        <div
                          key={slot.slot_id}
                          className="border border-slate-200 rounded-xl p-3 bg-slate-50/60 text-xs space-y-1.5"
                        >
                          <div className="font-extrabold text-teal-800">
                            {slot.title_fa} ({toFaDigits(slot.target_calories)} کالری)
                          </div>
                          <button type="button" className="border rounded-lg px-2 py-1 text-teal-700" onClick={() => {
                            const title = window.prompt("نام گزینه غذایی را وارد کنید:"); if (!title?.trim()) return;
                            const desc = window.prompt("مواد و مقدار دقیق این گزینه:"); if (!desc?.trim()) return;
                            const calText = window.prompt("کالری این گزینه طبق محاسبه کارشناس:");
                            if (calText === null || !Number.isFinite(Number(calText)) || Number(calText) <= 0) { showToast("کالری معتبر وارد کنید."); return; }
                            const slots = structuredClone(selectedCase.latestRegimen.day1SlotsJson || []);
                            const target = slots.find((x: any) => x.slot_id === slot.slot_id);
                            target.options = [...(target.options || []), {option_id: `manual_${Date.now()}`, meal_code: `manual_${Date.now()}`, source: "manual", title_fa: title.trim(), scaled_ingredients_fa: desc.trim(), print_compact_line_fa: `${title.trim()}: ${desc.trim()}`, final_calories: Number(calText), is_approved: false}];
                            handleSignAndSaveRegimen(slots);
                          }}>＋ افزودن گزینه دستی</button>
                          {(slot.options || []).map((opt: any) => {
                            const isEditing =
                              editingSlotOption?.optionId === opt.option_id;
                            return (
                              <div
                                key={opt.option_id}
                                className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                {isEditing && editingSlotOption ? (
                                  <div className="flex-1 flex gap-2">
                                    <input
                                      type="text"
                                      value={editingSlotOption.text}
                                      onChange={(e) =>
                                        setEditingSlotOption({
                                          slotId: editingSlotOption.slotId,
                                          optionId: editingSlotOption.optionId,
                                          text: e.target.value,
                                        })
                                      }
                                      className="flex-1 border border-teal-500 rounded-lg px-2.5 py-1 text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={handleSaveInlineOptionEdit}
                                      className="bg-teal-600 text-white px-3 py-1 rounded-lg font-bold"
                                    >
                                      ذخیره
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div>
                                      <strong className="text-slate-900">{opt.title_fa}: </strong>
                                      <span className="text-slate-700">
                                        {opt.scaled_ingredients_fa}
                                      </span>
                                    </div>
                                    <div className="flex gap-1">
                                      {[-1, 1].map(delta => <button key={delta} type="button" className="border rounded px-2" onClick={() => {
                                        const slots = structuredClone(selectedCase.latestRegimen.day1SlotsJson || []); const target = slots.find((x: any) => x.slot_id === slot.slot_id); const i = target.options.findIndex((x: any) => x.option_id === opt.option_id); const j = i + delta; if (j < 0 || j >= target.options.length) return; [target.options[i], target.options[j]] = [target.options[j], target.options[i]]; handleSignAndSaveRegimen(slots);
                                      }}>{delta === -1 ? "↑" : "↓"}</button>)}
                                      <button type="button" className="border rounded px-2 text-red-700" onClick={() => { if (!window.confirm("این گزینه حذف شود؟")) return; const slots = structuredClone(selectedCase.latestRegimen.day1SlotsJson || []); const target = slots.find((x: any) => x.slot_id === slot.slot_id); target.options = target.options.filter((x: any) => x.option_id !== opt.option_id); handleSignAndSaveRegimen(slots); }}>حذف</button>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingSlotOption({
                                          slotId: slot.slot_id,
                                          optionId: opt.option_id,
                                          text: opt.scaled_ingredients_fa,
                                        })
                                      }
                                      className="text-teal-700 hover:bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 font-bold flex items-center gap-1 shrink-0"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      ویرایش
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
                یک پرونده را از ستون سمت راست انتخاب کنید.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 2 (ADMIN ONLY): FOOD BANK MANAGER WITH LIVE scanX PREVIEW
         ===================================================================== */}
      {staffSection === "food_bank" && role === "ADMIN" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h2 className="font-extrabold text-lg text-slate-900 mb-1 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-teal-600" />
              افزودن غذای جدید به بانک تغذیه (همراه با اسکنر زنده منع پزشکی scanX)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              به محض تایپ مواد اولیه، موتور هوشمند `scanX` تگ‌های منع بیماری و آلرژی را تشخیص می‌دهد.
            </p>

            <form onSubmit={handleCreateCustomMeal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوان غذا</label>
                <input
                  type="text"
                  value={newMealName}
                  onChange={(e) => setNewMealName(e.target.value)}
                  placeholder="مثلاً: خوراک بوقلمون زعفرانی با برنج"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  مواد اولیه و مقادیر پایه (پیمانه‌های ایرانی)
                </label>
                <textarea
                  rows={3}
                  value={newMealDesc}
                  onChange={(e) => setNewMealDesc(e.target.value)}
                  placeholder="مثلاً: ۸ ق‌غ برنج + ۹۰ گرم گوشت بوقلمون + ۱ ق‌چ روغن زیتون + سالاد فصل"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">وعده</label>
                  <select
                    value={newMealSlot}
                    onChange={(e) => setNewMealSlot(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                  >
                    <option value="b">صبحانه</option>
                    <option value="l">ناهار</option>
                    <option value="d">شام</option>
                    <option value="s">میان‌وعده</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">کالری پایه</label>
                  <input
                    type="number"
                    value={newMealCal}
                    onChange={(e) => setNewMealCal(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع پخت</label>
                  <select
                    value={newMealCook}
                    onChange={(e) => setNewMealCook(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                  >
                    <option value="pot">قابلمه‌ای / خورشتی</option>
                    <option value="grill">گریل / کبابی / تابه‌ای</option>
                    <option value="raw">سرد / سالادی</option>
                  </select>
                </div>
              </div>

              {/* Live scanX Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <div className="text-xs font-extrabold text-slate-700 mb-2">
                  🔍 پیش‌نمایش زنده اسکنر منع پزشکی (`scanX`):
                </div>
                {liveScannedTags.length === 0 ? (
                  <span className="text-xs text-emerald-700 font-bold">
                    ✅ هیچ ماده ممنوعه بحرانی تشخیص داده نشد (مناسب اکثر پرونده‌ها)
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {liveScannedTags.map((t) => (
                      <span
                        key={t}
                        className="bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-1 rounded-lg text-xs font-extrabold"
                      >
                        🚫 {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-extrabold py-3 rounded-xl shadow transition text-sm"
              >
                ذخیره در بانک غذای کلینیک
              </button>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-base text-slate-900">
              📊 وضعیت بانک تغذیه کلینیک
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                <div className="text-xs text-teal-800">وعده‌های استاندارد ایرانی</div>
                <div className="text-2xl font-extrabold text-teal-950">
                  {toFaDigits(626 + (adminStats?.customMeals?.length || 0))} وعده
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="text-xs text-emerald-800">مواد غذایی پایه سئو شده</div>
                <div className="text-2xl font-extrabold text-emerald-950">
                  {toFaDigits(432)} قلم
                </div>
              </div>
            </div>

            {Array.isArray(adminStats?.customMeals) && adminStats.customMeals.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-slate-700">
                  غذاهای اضافه‌شده توسط مدیر:
                </div>
                {adminStats.customMeals.map((cm: any) => (
                  <div
                    key={cm.id}
                    className="border border-slate-200 rounded-xl p-3 text-xs bg-slate-50"
                  >
                    <strong>
                      {cm.name} ({toFaDigits(cm.baseCalories)} کالری):
                    </strong>{" "}
                    {cm.ingredientsDesc}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 3 (ADMIN ONLY): FINANCIAL KPI, MRR & PLANS OVERVIEW
         ===================================================================== */}
      {staffSection === "analytics" && role === "ADMIN" && adminStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-xs text-slate-500">تعداد کل پرونده‌های مراجعین</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {toFaDigits(adminStats.totalPatients)} پرونده
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-xs text-slate-500">برنامه‌های غذایی صادرشده</div>
              <div className="text-2xl font-extrabold text-teal-700 mt-1">
                {toFaDigits(adminStats.totalRegimensIssued)} برنامه
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-xs text-slate-500">درآمد تکرارشونده ماهانه (MRR)</div>
              <div className="text-xl font-extrabold text-emerald-700 mt-1">
                {formatToman(adminStats.mrrToman)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-xs text-slate-500">نرخ تبدیل لندینگ به ثبت‌نام</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                🟢 {toFaDigits(adminStats.conversionRatePct)}٪
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <h3 className="font-extrabold text-base text-slate-900 mb-3">
              💳 جدول ۷ سطح پلن‌ها و تعرفه‌های کلینیک
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(adminStats.plans || []).map((pl: any) => (
                <div
                  key={pl.slug}
                  className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between"
                >
                  <div>
                    <div className="font-extrabold text-slate-900 text-sm mb-1">{pl.title_fa}</div>
                    <div className="text-teal-700 font-extrabold text-base mb-2">
                      {formatToman(pl.price_toman)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    {(pl.features || []).map((f: string, idx: number) => (
                      <div key={idx}>• {f}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
