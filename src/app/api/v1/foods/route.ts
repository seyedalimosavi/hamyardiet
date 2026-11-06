import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureDbInitialized, customMeals, userRegimens, eq } from "@/db/store";
import { getSeedData, getDishBaseSignature } from "../../../../../server/engine/pipeline.js";
import { scanX } from "../../../../../server/engine/clinicalRules.js";
import { validateManualFoodSelection } from "../../../../../server/engine/scaler.js";
import { mayShowSearchRecipe, isRestrictedAutomaticMeal } from "../../../../../server/engine/searchPolicy.js";
import { normalizeFa } from "../../../../../shared/persian.js";

export async function GET(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(req.url);
    const q = normalizeFa(searchParams.get("q") || "");
    const slotId = searchParams.get("slotId") || "l";
    const slotCal = Number(searchParams.get("slotCal")) || 400;
    const hardBansParam = searchParams.get("hardBans") || "";
    let hardBans = new Set(hardBansParam.split(",").filter(Boolean));
    let profile: any = null;
    const regimenId = Number(searchParams.get("regimenId"));
    if (Number.isFinite(regimenId) && regimenId > 0) {
      const [reg] = await db.select().from(userRegimens).where(eq(userRegimens.id, regimenId));
      if (reg) {
        profile = reg.profileSnapshotJson || {};
        const metrics = (reg.calculatedMetricsJson || {}) as any;
        hardBans = new Set(Array.isArray(metrics.hard_bans) ? metrics.hard_bans : []);
      }
    }
    const slotType = slotId === "b" ? "b" : ["l", "d"].includes(slotId) ? slotId : "s";

    const seed = getSeedData();
    const dbCustom = await db.select().from(customMeals);

    const allMeals = [
      ...dbCustom.map((cm) => ({
        code: cm.code,
        slot_type: cm.slotType,
        name: cm.name,
        base_calories: cm.baseCalories,
        ingredients_desc: cm.ingredientsDesc,
        cook_kind: cm.cookKind,
        pos_tags: (cm.posTagsJson as string[]) || [],
        neg_tags_final: Array.from(
          new Set([
            ...((cm.negTagsJson as string[]) || []),
            ...scanX(`${cm.name} ${cm.ingredientsDesc}`),
          ])
        ),
      })),
      ...seed.meals,
    ];

    const seenFamilies = new Set<string>();
    const matchedMeals = allMeals
      .filter((m) => {
        if (slotId !== "all" && m.slot_type !== slotType) return false;
        if (m.search_only && (!q || !mayShowSearchRecipe(m, profile))) return false;
        if (!q) return true;
        const norm = normalizeFa(`${m.name} ${m.ingredients_desc}`);
        return norm.includes(q);
      })
      .sort((a, b) => {
        const blocked = (m: any) => (m.neg_tags_final || m.neg_tags || []).some((t: string) => hardBans.has(t)) || (profile?.disliked_foods || []).some((d: string) => normalizeFa(d) && normalizeFa(`${m.name} ${m.ingredients_desc}`).includes(normalizeFa(d)));
        return Number(Boolean(b.search_only)) - Number(Boolean(a.search_only)) || Number(blocked(a)) - Number(blocked(b));
      })
      .filter((m) => {
        const key = `${m.search_only ? "adapted" : "regular"}:${getDishBaseSignature(m.name)}`;
        if (seenFamilies.has(key)) return false;
        seenFamilies.add(key);
        return true;
      })
      .slice(0, 40)
      .map((m) => {
        const negs = m.neg_tags_final || m.neg_tags || [];
        const disliked = (profile?.disliked_foods || []).some((d: string) => normalizeFa(d) && normalizeFa(`${m.name} ${m.ingredients_desc}`).includes(normalizeFa(d)));
        const hasHardBan = negs.some((t: string) => hardBans.has(t)) || disliked;
        const caution = !m.search_only && profile && isRestrictedAutomaticMeal(m, profile);
        return {
          code: m.code,
          slot_type: m.slot_type,
          name: m.name,
          base_calories: m.base_calories,
          ingredients_desc: m.ingredients_desc,
          cook_kind: m.cook_kind,
          pos_tags: m.pos_tags,
          neg_tags: negs,
          search_only: Boolean(m.search_only), requires_review: Boolean(caution), preparation_fa: m.preparation_fa || null,
          safety_status: hasHardBan ? "HARD_BAN" : "SAFE",
          safety_label_fa: hasHardBan ? "ناسازگار با محدودیت یا ترجیح ثبت‌شده" : m.search_only ? "دستور جایگزین؛ نیازمند بررسی کارشناس" : caution ? "گزینه معمولی؛ نیازمند بررسی" : "مورد منع شناسایی نشد؛ نیازمند بررسی",
        };
      });

    const matchedGeneral = seed.general_foods
      .filter((gf: { name: string }) => {
        if (!q) return true;
        return normalizeFa(gf.name).includes(q);
      })
      .slice(0, 40)
      .map((gf: any) => {
        const guard = validateManualFoodSelection(gf, slotId === "all" ? "l" : slotId, slotCal);
        const negs = Array.from(new Set([...(gf.neg_tags || []), ...scanX(gf.name)]));
        const hasHardBan = negs.some((t: string) => hardBans.has(t));
        let status = "SAFE";
        let label = "مورد منع شناسایی نشد؛ نیازمند بررسی";
        if (hasHardBan) {
          status = "HARD_BAN";
          label = "منع پزشکی پرونده";
        } else if (!guard.ok) {
          status = "GUARD_BLOCKED";
          label = guard.message_fa;
        }
        return {
          code: gf.code,
          slug: gf.slug,
          name: gf.name,
          calories_per_unit: gf.calories_per_unit,
          unit_label: gf.unit_label,
          grams_per_unit: gf.grams_per_unit,
          is_raw_unpickable: gf.is_raw_unpickable,
          is_side_only: gf.is_side_only,
          neg_tags: negs,
          safety_status: status,
          safety_label_fa: label,
        };
      });

    return NextResponse.json({
      ok: true,
      data: {
        meals: matchedMeals,
        generalFoods: matchedGeneral,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطا در جستجو";
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

    if (body.action === "scan_preview") {
      const scanned = scanX(`${body.name || ""} ${body.ingredients_desc || ""}`);
      return NextResponse.json({ ok: true, data: { scannedNegTags: scanned } });
    }

    // Create custom meal by Admin
    const code = `CM_${Date.now().toString().slice(-5)}`;
    const name = String(body.name || "").trim();
    const ingredientsDesc = String(body.ingredients_desc || "").trim();
    const slotType = body.slot_type || "l";
    const baseCalories = Number(body.base_calories) || 350;
    const cookKind = body.cook_kind || "pot";
    const scanned = scanX(`${name} ${ingredientsDesc}`);
    const negTags = Array.from(new Set([...(body.neg_tags || []), ...scanned]));

    const [created] = await db
      .insert(customMeals)
      .values({
        code,
        slotType,
        name,
        baseCalories,
        ingredientsDesc,
        cookKind,
        posTagsJson: body.pos_tags || ["POS_BALANCED"],
        negTagsJson: negTags,
      })
      .returning();

    return NextResponse.json({
      ok: true,
      data: { meal: created },
      message_fa: `غذای جدید «${name}» با کد ${code} به بانک غذا اضافه شد.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطا در ثبت غذا";
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_ERROR", message_fa: message } },
      { status: 500 }
    );
  }
}
