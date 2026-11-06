import { NextRequest, NextResponse } from "next/server";
import {
  calcBodyFatNavy,
  calcBodyFatJacksonPollock3,
  calcBodyFatDurnin4,
  calcBodyFatBMI,
  analyzeBodyComposition,
} from "../../../../../server/engine/bodyFat.js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const method = body.method || "navy";
    const gender = body.gender === "male" ? "male" : "female";
    const age = Number(body.age) || 30;
    const height_cm = Number(body.height_cm) || 170;
    const weight_kg = Number(body.weight_kg) || 72;
    const is_athlete = Boolean(body.is_athlete);

    let calculatedBf = 20;

    if (method === "navy") {
      calculatedBf = calcBodyFatNavy({
        gender,
        height_cm,
        waist_cm: body.waist_cm,
        neck_cm: body.neck_cm,
        hip_cm: body.hip_cm,
      });
    } else if (method === "jp3") {
      calculatedBf = calcBodyFatJacksonPollock3({
        gender,
        age,
        chest_mm: body.chest_mm,
        abdomen_mm: body.abdomen_mm,
        thigh_mm: body.thigh_mm,
        triceps_mm: body.triceps_mm,
        suprailiac_mm: body.suprailiac_mm,
      });
    } else if (method === "durnin4") {
      calculatedBf = calcBodyFatDurnin4({
        gender,
        age,
        biceps_mm: body.biceps_mm,
        triceps_mm: body.triceps_mm,
        subscapular_mm: body.subscapular_mm,
        suprailiac_mm: body.suprailiac_mm,
      });
    } else if (method === "direct" && body.body_fat_pct) {
      calculatedBf = Number(body.body_fat_pct);
    } else {
      calculatedBf = calcBodyFatBMI({
        gender,
        age,
        height_cm,
        weight_kg,
      });
    }

    const analysis = analyzeBodyComposition({
      gender,
      weight_kg,
      height_cm,
      body_fat_pct: calculatedBf,
      is_athlete,
    });

    return NextResponse.json({
      ok: true,
      data: {
        method,
        ...analysis,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطا در محاسبه درصد چربی";
    return NextResponse.json(
      { ok: false, error: { code: "SERVER_ERROR", message_fa: message } },
      { status: 500 }
    );
  }
}
