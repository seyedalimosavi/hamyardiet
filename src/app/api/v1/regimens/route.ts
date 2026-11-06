import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  ensureDbInitialized,
  users,
  clinicalProfiles,
  userRegimens,
  customMeals,
  eq,
  desc,
} from "@/db/store";
import {
  getSeedData,
  generateRegimenPipeline,
  selectCandidatesForSlot,
  formatMealAsOption,
  getDishBaseSignature,
  buildWeeklyScheduleAndShoppingList,
} from "../../../../../server/engine/pipeline.js";
import { validateManualFoodSelection } from "../../../../../server/engine/scaler.js";
import { generateCookingGuide } from "../../../../../server/engine/cookingGuide.js";
import { scanX } from "../../../../../server/engine/clinicalRules.js";
import { mayShowSearchRecipe } from "../../../../../server/engine/searchPolicy.js";
import { normalizeFa } from "../../../../../shared/persian.js";

async function getCombinedMeals() {
  const seed = getSeedData();
  const dbCustom = await db.select().from(customMeals);
  const formattedCustom = dbCustom.map((cm) => {
    const pos = Array.isArray(cm.posTagsJson) ? cm.posTagsJson : [];
    const neg = Array.isArray(cm.negTagsJson) ? cm.negTagsJson : [];
    const scanned = scanX(`${cm.name} ${cm.ingredientsDesc}`);
    return {
      code: cm.code,
      slot_type: cm.slotType,
      name: cm.name,
      base_calories: cm.baseCalories,
      ingredients_desc: cm.ingredientsDesc,
      oil_note_embedded: null,
      structured_components: [],
      cook_kind: cm.cookKind || "pot",
      grain_exchange: null,
      pos_tags: pos,
      neg_tags: neg,
      neg_tags_final: Array.from(new Set([...neg, ...scanned])),
      is_popular: true,
      is_quick: false,
    };
  });
  return [...formattedCustom, ...seed.meals];
}

export async function GET(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const regimenId = searchParams.get("regimenId");

    if (regimenId) {
      const [reg] = await db
        .select()
        .from(userRegimens)
        .where(eq(userRegimens.id, Number(regimenId)));
      return NextResponse.json({ ok: true, data: { regimen: reg || null } });
    }

    if (userId) {
      const regs = await db
        .select()
        .from(userRegimens)
        .where(eq(userRegimens.userId, Number(userId)))
        .orderBy(desc(userRegimens.createdAt));
      return NextResponse.json({ ok: true, data: { regimens: regs } });
    }

    const allRegs = await db
      .select()
      .from(userRegimens)
      .orderBy(desc(userRegimens.updatedAt));
    return NextResponse.json({ ok: true, data: { regimens: allRegs } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطا در دریافت برنامه";
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_ERROR", message_fa: message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const body = await req.json();
    const action = body.action || "generate";

    // 1. GENERATE NEW REGIMEN & SAVE CLINICAL FILE
    if (action === "generate") {
      const userId = Number(body.userId) || 3;
      const profile = body.profile || {};

      const [userRow] = await db.select().from(users).where(eq(users.id, userId));
      const userName = body.fullName || userRow?.fullName || "مراجع کلینیک";
      const userPhone = userRow?.phone || "09120000003";

      if (body.fullName && userRow && body.fullName !== userRow.fullName) {
        await db
          .update(users)
          .set({ fullName: body.fullName })
          .where(eq(users.id, userId));
      }

      // Upsert clinical_profiles in PostgreSQL
      const existingProf = await db
        .select()
        .from(clinicalProfiles)
        .where(eq(clinicalProfiles.userId, userId));

      const profValues = {
        userId,
        gender: profile.gender || "female",
        age: Number(profile.age) || 35,
        heightCm: Number(profile.height_cm) || 165,
        weightKg: Number(profile.weight_kg) || 72,
        targetWeightKg: Number(profile.target_weight_kg) || 62,
        waistCm: profile.waist_cm ? Number(profile.waist_cm) : null,
        neckCm: profile.neck_cm ? Number(profile.neck_cm) : null,
        hipCm: profile.hip_cm ? Number(profile.hip_cm) : null,
        activityFactor: Number(profile.activity_factor) || 1.375,
        goal: profile.goal || "loss",
        dietPref: profile.diet_pref || "balanced",
        isAthlete: Boolean(profile.is_athlete),
        sportCategory: profile.sport_category || null,
        sportPhase: profile.sport_phase || null,
        trainingDaysPerWeek: Number(profile.training_days_per_week) || 4,
        sessionDurationMin: Number(profile.session_duration_min) || 60,
        trainingTimeSlot: profile.training_time_slot || "عصر",
        supplementsListJson: profile.supplements_list || [],
        bodyFatPct: profile.body_fat_pct ? Number(profile.body_fat_pct) : null,
        useVerifiedBodyFat: Boolean(profile.use_verified_body_fat),
        bodyFatMethod: profile.body_fat_method || null,
        isDialysis: Boolean(profile.is_dialysis),
        hasEatingDisorderHistory: Boolean(profile.has_eating_disorder_history),
        usesInsulinOrSulfonylurea: Boolean(profile.uses_insulin_or_sulfonylurea),
        pregnancyTrimester: profile.pregnancy_trimester ? Number(profile.pregnancy_trimester) : null,
        conditionsJson: profile.conditions || [],
        restrictionsJson: profile.restrictions || [],
        allergiesJson: profile.allergies || [],
        dislikedFoodsJson: profile.disliked_foods || [],
        medicationsText: profile.medications_text || "",
        mealSlotsOkJson: profile.meal_slots_ok || null,
        mealSlotsPctJson: profile.meal_slots_pct || null,
        updatedAt: new Date(),
      };

      if (existingProf.length > 0) {
        await db
          .update(clinicalProfiles)
          .set(profValues)
          .where(eq(clinicalProfiles.userId, userId));
      } else {
        await db.insert(clinicalProfiles).values(profValues);
      }

      const generated = generateRegimenPipeline(profile, 3);

      const [savedRegimen] = await db
        .insert(userRegimens)
        .values({
          trackingCode: generated.tracking_code,
          userId,
          userName,
          userPhone,
          status: generated.status,
          profileSnapshotJson: profile,
          calculatedMetricsJson: generated.calculated_metrics,
          day1SlotsJson: generated.day1_slots,
          day2ShockJson: generated.day2_shock,
          athleteRestDayJson: generated.athlete_rest_day,
          treatAllowanceJson: generated.treat_allowance,
          weeklyScheduleJson: generated.weekly_schedule,
          rejectedMealCodesJson: generated.rejected_meal_codes,
          approvedMealCodesJson: [],
        })
        .returning();

      const cookingGuide1 = generateCookingGuide({
        slots: generated.day1_slots,
        profile,
        metrics: generated.calculated_metrics,
        persons: 1,
      });

      return NextResponse.json({
        ok: true,
        data: {
          regimen: savedRegimen,
          cookingGuide: cookingGuide1,
        },
        message_fa: "برنامه غذایی هوشمند شما ساخته شد و پرونده در پنل کارشناس و مدیر ثبت گردید.",
      });
    }

    // 2. SMART NON-REPEATING OPTION REFRESH ("رد و پیشنهاد بعدی")
    if (action === "refresh_option") {
      const regimenId = Number(body.regimenId);
      const slotId = String(body.slotId);
      const optionId = body.optionId ? String(body.optionId) : null;
      const dayMode = body.dayMode || "day1"; // 'day1' | 'day2' | 'rest'

      const [reg] = await db
        .select()
        .from(userRegimens)
        .where(eq(userRegimens.id, regimenId));

      if (!reg) {
        return NextResponse.json(
          { ok: false, error: { code: "NOT_FOUND", message_fa: "برنامه یافت نشد." } },
          { status: 404 }
        );
      }

      const allMeals = await getCombinedMeals();
      const profile = (reg.profileSnapshotJson || {}) as Record<string, unknown>;
      const metrics = (reg.calculatedMetricsJson || {}) as Record<string, unknown>;

      // Gather ALL meal codes across all slots + previously rejected codes + approved codes
      const dbRejected = Array.isArray(reg.rejectedMealCodesJson)
        ? (reg.rejectedMealCodesJson as string[])
        : [];
      const clientRejected = Array.isArray(body.clientRejectedCodes)
        ? (body.clientRejectedCodes as string[])
        : [];
      const dbApproved = Array.isArray(reg.approvedMealCodesJson)
        ? (reg.approvedMealCodesJson as string[])
        : [];

      const strictExcludeCodes = new Set<string>([...dbApproved]);
      const strictExcludeSignatures = new Set<string>();
      const softRejectedCodes = new Set<string>([...dbRejected, ...clientRejected]);

      const day1Slots = Array.isArray(reg.day1SlotsJson) ? [...reg.day1SlotsJson] : [];
      const day2Shock = reg.day2ShockJson ? { ...(reg.day2ShockJson as Record<string, unknown>) } : null;
      const athleteRest = reg.athleteRestDayJson
        ? { ...(reg.athleteRestDayJson as Record<string, unknown>) }
        : null;

      const targetSlotsList =
        dayMode === "day2" && day2Shock && Array.isArray(day2Shock.slots)
          ? [...day2Shock.slots]
          : dayMode === "rest" && athleteRest && Array.isArray(athleteRest.slots)
          ? [...athleteRest.slots]
          : day1Slots;

      // Exclude every meal currently visible in ANY slot of the regimen!
      for (const s of day1Slots) {
        for (const opt of s.options || []) {
          strictExcludeCodes.add(opt.meal_code);
          strictExcludeSignatures.add(getDishBaseSignature(opt.title_fa));
        }
      }
      for (const s of targetSlotsList) {
        for (const opt of s.options || []) {
          strictExcludeCodes.add(opt.meal_code);
          strictExcludeSignatures.add(getDishBaseSignature(opt.title_fa));
        }
      }

      const slotIndex = targetSlotsList.findIndex((s) => s.slot_id === slotId);
      if (slotIndex === -1) {
        return NextResponse.json(
          { ok: false, error: { code: "NOT_FOUND", message_fa: "وعده مورد نظر یافت نشد." } },
          { status: 404 }
        );
      }

      const targetSlot = { ...targetSlotsList[slotIndex] };
      const currentOptions = Array.isArray(targetSlot.options) ? [...targetSlot.options] : [];

      if (optionId) {
        // Single option reject & replace
        const optIdx = currentOptions.findIndex((o) => o.option_id === optionId);
        if (optIdx !== -1) {
          const rejectedCode = currentOptions[optIdx].meal_code;
          strictExcludeCodes.add(rejectedCode);
          softRejectedCodes.add(rejectedCode);
          strictExcludeSignatures.add(getDishBaseSignature(currentOptions[optIdx].title_fa));

          const [replacement] = selectCandidatesForSlot({
            allMeals,
            slotId: targetSlot.slot_id,
            slotType: targetSlot.slot_type,
            slotCal: targetSlot.target_calories,
            profile,
            metrics,
            count: 1,
            strictExcludeCodes,
            strictExcludeSignatures,
            softRejectedCodes,
          });

          if (replacement) {
            currentOptions[optIdx] = replacement;
          } else {
            return NextResponse.json({ ok: false, error: { code: "NO_NEW_OPTION", message_fa: "گزینه جایگزین دیگری پیدا نشد؛ گزینه فعلی حفظ شد. می‌توانید جست‌وجو کنید یا با کارشناس مشورت کنید." } }, { status: 422 });
          }
        }
      } else {
        // Refresh entire slot (preserving options marked is_approved === true)
        const approvedOpts = currentOptions.filter((o) => o.is_approved);
        const toReplaceCount = currentOptions.length - approvedOpts.length;
        if (toReplaceCount === 0) return NextResponse.json({ ok: false, error: { code: "ALL_APPROVED", message_fa: "همه گزینه‌های این وعده تأیید شده‌اند و حفظ می‌شوند. برای تعویض، تأیید گزینه موردنظر را بردارید یا همان گزینه را رد کنید." } }, { status: 422 });
        for (const o of currentOptions) {
          strictExcludeCodes.add(o.meal_code);
          if (!o.is_approved) softRejectedCodes.add(o.meal_code);
          strictExcludeSignatures.add(getDishBaseSignature(o.title_fa));
        }
        const newOpts = selectCandidatesForSlot({
          allMeals,
          slotId: targetSlot.slot_id,
          slotType: targetSlot.slot_type,
          slotCal: targetSlot.target_calories,
          profile,
          metrics,
          count: toReplaceCount,
          strictExcludeCodes,
          strictExcludeSignatures,
          softRejectedCodes,
        });
        if (newOpts.length === 0) return NextResponse.json({ ok: false, error: { code: "NO_NEW_OPTION", message_fa: "پیشنهاد جدیدی پیدا نشد؛ گزینه‌های فعلی حفظ شدند." } }, { status: 422 });
        // Keep unmatched existing options rather than silently deleting them.
        const unapproved = currentOptions.filter((o) => !o.is_approved);
        currentOptions.splice(0, currentOptions.length, ...approvedOpts, ...newOpts, ...unapproved.slice(newOpts.length));
      }

      targetSlot.options = currentOptions;
      targetSlotsList[slotIndex] = targetSlot;

      let updatedDay1 = day1Slots;
      let updatedDay2 = day2Shock;
      let updatedRest = athleteRest;

      if (dayMode === "day2" && updatedDay2) {
        updatedDay2 = { ...updatedDay2, slots: targetSlotsList };
      } else if (dayMode === "rest" && updatedRest) {
        updatedRest = { ...updatedRest, slots: targetSlotsList };
      } else {
        updatedDay1 = targetSlotsList;
      }

      const newWeekly = buildWeeklyScheduleAndShoppingList(updatedDay1);
      const updatedRejectedArray = Array.from(softRejectedCodes).slice(-120);

      const [updatedReg] = await db
        .update(userRegimens)
        .set({
          day1SlotsJson: updatedDay1,
          day2ShockJson: updatedDay2,
          athleteRestDayJson: updatedRest,
          weeklyScheduleJson: newWeekly,
          rejectedMealCodesJson: updatedRejectedArray,
          updatedAt: new Date(),
        })
        .where(eq(userRegimens.id, regimenId))
        .returning();

      return NextResponse.json({
        ok: true,
        data: { regimen: updatedReg },
        message_fa: "گزینه‌های قابل جایگزینی به‌روزرسانی شدند.",
      });
    }

    // 3. APPROVE / LOCK AN OPTION ("تایید گزینه")
    if (action === "approve_option") {
      const regimenId = Number(body.regimenId);
      const slotId = String(body.slotId);
      const optionId = String(body.optionId);

      const [reg] = await db
        .select()
        .from(userRegimens)
        .where(eq(userRegimens.id, regimenId));
      if (!reg) {
        return NextResponse.json(
          { ok: false, error: { code: "NOT_FOUND", message_fa: "برنامه یافت نشد." } },
          { status: 404 }
        );
      }

      const day1Slots = Array.isArray(reg.day1SlotsJson) ? [...reg.day1SlotsJson] : [];
      const approvedSet = new Set<string>(
        Array.isArray(reg.approvedMealCodesJson) ? (reg.approvedMealCodesJson as string[]) : []
      );

      for (const s of day1Slots) {
        if (s.slot_id === slotId) {
          for (const opt of s.options || []) {
            if (opt.option_id === optionId) {
              opt.is_approved = !opt.is_approved;
              if (opt.is_approved) approvedSet.add(opt.meal_code);
              else approvedSet.delete(opt.meal_code);
            }
          }
        }
      }

      const [updatedReg] = await db
        .update(userRegimens)
        .set({
          day1SlotsJson: day1Slots,
          approvedMealCodesJson: Array.from(approvedSet),
          updatedAt: new Date(),
        })
        .where(eq(userRegimens.id, regimenId))
        .returning();

      return NextResponse.json({
        ok: true,
        data: { regimen: updatedReg },
        message_fa: "وضعیت تثبیت گزینه به‌روز شد.",
      });
    }

    // 4. DELETE AN OPTION FROM SLOT
    if (action === "delete_option") {
      const regimenId = Number(body.regimenId);
      const slotId = String(body.slotId);
      const optionId = String(body.optionId);

      const [reg] = await db
        .select()
        .from(userRegimens)
        .where(eq(userRegimens.id, regimenId));
      if (!reg) {
        return NextResponse.json(
          { ok: false, error: { code: "NOT_FOUND", message_fa: "برنامه یافت نشد." } },
          { status: 404 }
        );
      }

      const day1Slots = Array.isArray(reg.day1SlotsJson) ? [...reg.day1SlotsJson] : [];
      const rejectedSet = new Set<string>(
        Array.isArray(reg.rejectedMealCodesJson) ? (reg.rejectedMealCodesJson as string[]) : []
      );

      for (const s of day1Slots) {
        if (s.slot_id === slotId) {
          if ((s.options || []).length <= 1) {
            return NextResponse.json(
              {
                ok: false,
                error: {
                  code: "MIN_ONE_OPTION",
                  message_fa:
                    "هر وعده باید حداقل ۱ گزینه داشته باشد. برای تغییر این غذا دکمه «رد و پیشنهاد بعدی» را بزنید.",
                },
              },
              { status: 422 }
            );
          }
          const removed = (s.options || []).find(
            (o: { option_id: string }) => o.option_id === optionId
          );
          if (removed) rejectedSet.add(removed.meal_code);
          s.options = (s.options || []).filter(
            (o: { option_id: string }) => o.option_id !== optionId
          );
        }
      }

      const newWeekly = buildWeeklyScheduleAndShoppingList(day1Slots);
      const [updatedReg] = await db
        .update(userRegimens)
        .set({
          day1SlotsJson: day1Slots,
          weeklyScheduleJson: newWeekly,
          rejectedMealCodesJson: Array.from(rejectedSet),
          updatedAt: new Date(),
        })
        .where(eq(userRegimens.id, regimenId))
        .returning();

      return NextResponse.json({
        ok: true,
        data: { regimen: updatedReg },
        message_fa: "گزینه حذف شد و دیگر نمایش داده نخواهد شد.",
      });
    }

    // 5. ADD AN OPTION (AUTO OR FROM SEARCH)
    if (action === "add_option") {
      const regimenId = Number(body.regimenId);
      const slotId = String(body.slotId);
      const mealCode = body.mealCode ? String(body.mealCode) : null;
      const generalFoodCode = body.generalFoodCode ? String(body.generalFoodCode) : null;

      const [reg] = await db
        .select()
        .from(userRegimens)
        .where(eq(userRegimens.id, regimenId));
      if (!reg) {
        return NextResponse.json(
          { ok: false, error: { code: "NOT_FOUND", message_fa: "برنامه یافت نشد." } },
          { status: 404 }
        );
      }

      const allMeals = await getCombinedMeals();
      const seed = getSeedData();
      const profile = (reg.profileSnapshotJson || {}) as Record<string, unknown>;
      const metrics = (reg.calculatedMetricsJson || {}) as Record<string, unknown>;
      const day1Slots = Array.isArray(reg.day1SlotsJson) ? [...reg.day1SlotsJson] : [];

      const slotIdx = day1Slots.findIndex((s) => s.slot_id === slotId);
      if (slotIdx === -1) {
        return NextResponse.json(
          { ok: false, error: { code: "NOT_FOUND", message_fa: "وعده یافت نشد." } },
          { status: 404 }
        );
      }

      const slot = { ...day1Slots[slotIdx] };
      const currentOptions = Array.isArray(slot.options) ? [...slot.options] : [];

      let newOpt = null;

      if (generalFoodCode) {
        const gf = seed.general_foods.find((g: { code: string }) => g.code === generalFoodCode);
        if (!gf) {
          return NextResponse.json(
            { ok: false, error: { code: "NOT_FOUND", message_fa: "ماده غذایی یافت نشد." } },
            { status: 404 }
          );
        }
        const guard = validateManualFoodSelection(gf, slotId, slot.target_calories);
        if (!guard.ok) {
          return NextResponse.json(
            { ok: false, error: { code: guard.code, message_fa: guard.message_fa } },
            { status: 422 }
          );
        }
        const hardBans = new Set<string>((metrics.hard_bans as string[]) || []);
        const gfNegs = [...(gf.neg_tags || []), ...scanX(gf.name)];
        if (gfNegs.some((t: string) => hardBans.has(t))) {
          return NextResponse.json(
            {
              ok: false,
              error: {
                code: "HARD_MEDICAL_BAN",
                message_fa: `«${gf.name}» با شرایط پزشکی یا آلرژی پرونده شما تداخل دارد و قابل افزودن نیست.`,
              },
            },
            { status: 422 }
          );
        }
        const pseudoMeal = {
          code: gf.code,
          slot_type: slot.slot_type,
          name: gf.name,
          base_calories: gf.calories_per_unit || 100,
          ingredients_desc: `${gf.unit_label} ${gf.name}`,
          oil_note_embedded: null,
          cook_kind: "gen",
          grain_exchange: null,
          pos_tags: gf.pos_tags || [],
          neg_tags: gfNegs,
        };
        newOpt = formatMealAsOption(
          pseudoMeal,
          slotId,
          slot.target_calories,
          profile,
          metrics,
          "manual_search"
        );
      } else if (mealCode) {
        const m = allMeals.find((x) => x.code === mealCode);
        if (!m) {
          return NextResponse.json(
            { ok: false, error: { code: "NOT_FOUND", message_fa: "منوی انتخابی یافت نشد." } },
            { status: 404 }
          );
        }
        const disliked = Array.isArray(profile.disliked_foods) && profile.disliked_foods.some((d: unknown) => normalizeFa(d) && normalizeFa(`${m.name} ${m.ingredients_desc}`).includes(normalizeFa(d)));
        if (m.slot_type !== slot.slot_type || !mayShowSearchRecipe(m, profile) || disliked) {
          return NextResponse.json({ ok: false, error: { code: "INCOMPATIBLE_RECIPE", message_fa: "این گزینه برای وعده یا اطلاعات ثبت‌شده شما قابل انتخاب نیست." } }, { status: 422 });
        }
        const hardBans = new Set<string>((metrics.hard_bans as string[]) || []);
        if ((m.neg_tags_final || []).some((t: string) => hardBans.has(t))) {
          return NextResponse.json(
            {
              ok: false,
              error: {
                code: "HARD_MEDICAL_BAN",
                message_fa: `«${m.name}» با محدودیت پزشکی پرونده شما تداخل دارد.`,
              },
            },
            { status: 422 }
          );
        }
        newOpt = formatMealAsOption(
          m,
          slotId,
          slot.target_calories,
          profile,
          metrics,
          "manual_search"
        );
      } else {
        // Auto-suggest next non-repeating option
        const strictExcludeCodes = new Set<string>();
        const strictExcludeSignatures = new Set<string>();
        for (const s of day1Slots) {
          for (const o of s.options || []) {
            strictExcludeCodes.add(o.meal_code);
            strictExcludeSignatures.add(getDishBaseSignature(o.title_fa));
          }
        }
        const softRejected = new Set<string>(
          Array.isArray(reg.rejectedMealCodesJson) ? (reg.rejectedMealCodesJson as string[]) : []
        );
        const [picked] = selectCandidatesForSlot({
          allMeals,
          slotId: slot.slot_id,
          slotType: slot.slot_type,
          slotCal: slot.target_calories,
          profile,
          metrics,
          count: 1,
          strictExcludeCodes,
          strictExcludeSignatures,
          softRejectedCodes: softRejected,
        });
        newOpt = picked;
      }

      if (newOpt) {
        currentOptions.push(newOpt);
      }
      slot.options = currentOptions;
      day1Slots[slotIdx] = slot;

      const newWeekly = buildWeeklyScheduleAndShoppingList(day1Slots);
      const [updatedReg] = await db
        .update(userRegimens)
        .set({
          day1SlotsJson: day1Slots,
          weeklyScheduleJson: newWeekly,
          updatedAt: new Date(),
        })
        .where(eq(userRegimens.id, regimenId))
        .returning();

      return NextResponse.json({
        ok: true,
        data: { regimen: updatedReg },
        message_fa: "گزینه جدید با موفقیت به این وعده اضافه شد.",
      });
    }

    // 6. GENERATE COOKING GUIDE FOR 1..N PERSONS
    if (action === "cooking_guide") {
      const regimenId = Number(body.regimenId);
      const persons = Math.max(1, Math.min(20, Number(body.persons) || 1));

      const [reg] = await db
        .select()
        .from(userRegimens)
        .where(eq(userRegimens.id, regimenId));
      if (!reg) {
        return NextResponse.json(
          { ok: false, error: { code: "NOT_FOUND", message_fa: "برنامه یافت نشد." } },
          { status: 404 }
        );
      }

      const guide = generateCookingGuide({
        slots: Array.isArray(reg.day1SlotsJson) ? reg.day1SlotsJson : [],
        profile: reg.profileSnapshotJson || {},
        metrics: reg.calculatedMetricsJson || {},
        persons,
      });

      return NextResponse.json({
        ok: true,
        data: { cookingGuide: guide },
      });
    }

    // 7. CONSULTANT / ADMIN DIRECT EDIT & SIGNATURE ON PATIENT REGIMEN
    if (action === "consultant_update") {
      const regimenId = Number(body.regimenId);
      const [reg] = await db
        .select()
        .from(userRegimens)
        .where(eq(userRegimens.id, regimenId));
      if (!reg) {
        return NextResponse.json(
          { ok: false, error: { code: "NOT_FOUND", message_fa: "برنامه یافت نشد." } },
          { status: 404 }
        );
      }

      const updatedDay1 = body.day1Slots || reg.day1SlotsJson;
      const consultantNote =
        body.consultantOverrideNote !== undefined
          ? body.consultantOverrideNote
          : reg.consultantOverrideNote;
      const signNow = Boolean(body.signRegimen);
      if (signNow && (!String(body.consultantName || "").trim() || !String(body.councilCode || "").trim())) return NextResponse.json({ ok: false, error: { code: "VALIDATION", message_fa: "نام و شماره نظام پزشکی الزامی است." } }, { status: 400 });

      const [updatedReg] = await db
        .update(userRegimens)
        .set({
          day1SlotsJson: updatedDay1,
          consultantOverrideNote: consultantNote,
          status: "FINAL_ACTIVE",
          signedByConsultantName: signNow
            ? String(body.consultantName).trim()
            : null,
          signedByCouncilCode: signNow
            ? String(body.councilCode).trim()
            : null,
          versionNum: (reg.versionNum || 1) + 1,
          updatedAt: new Date(),
        })
        .where(eq(userRegimens.id, regimenId))
        .returning();

      return NextResponse.json({
        ok: true,
        data: { regimen: updatedReg },
        message_fa: "ویرایش و امضای کارشناس تغذیه روی پرونده بیمار ذخیره شد.",
      });
    }

    return NextResponse.json(
      { ok: false, error: { code: "BAD_ACTION", message_fa: "عملیات نامعتبر" } },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطای سرور";
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_ERROR", message_fa: message } },
      { status: 500 }
    );
  }
}
