declare module "*/shared/constants.js" {
  export const ACTIVITY_LEVELS: any[];
  export const GOALS: any[];
  export const SPORT_CATEGORIES: any[];
  export const SPORT_PHASES: Record<string, any>;
  export const DIET_PREFS: any[];
  export const CONDITIONS: Record<string, any>;
  export const ALLERGIES_AND_RESTRICTIONS: any[];
  export const DEFAULT_SLOTS_PCT: Record<string, number>;
  export const SLOT_META: Record<string, any>;
  export const POS_TAGS: string[];
  export const NEG_TAGS: string[];
  export const PLANS_SEED: any[];
}

declare module "*/shared/persian.js" {
  export function toEnDigits(str: any): string;
  export function toFaDigits(val: any): string;
  export function normalizeFa(text: any): string;
  export function formatToman(amount: any): string;
  export function formatJalali(dateInput?: any): string;
  export function formatHalfFa(num: any, style?: string): string;
}

declare module "*/server/engine/bodyFat.js" {
  export function calcBodyFatNavy(params: any): number;
  export function calcBodyFatJacksonPollock3(params: any): number;
  export function calcBodyFatDurnin4(params: any): number;
  export function calcBodyFatBMI(params: any): number;
  export function analyzeBodyComposition(params: any): any;
}

declare module "*/server/engine/clinicalRules.js" {
  export function round1(n: number): number;
  export function round10(n: number): number;
  export function clamp(n: number, min: number, max: number): number;
  export function scanX(rawText: string): string[];
  export function calculateClinicalMetrics(profile: any): any;
}

declare module "*/server/engine/scaler.js" {
  export function scaleIngredientText(rawDesc: string, scaleFactor?: number, options?: any): string;
  export function buildGrainBox(meal: any, scaleFactor?: number, slotId?: string, isDialysis?: boolean): any;
  export function buildOilBox(meal: any, profileMetrics: any, slotId?: string): any;
  export function buildPrintCompactLine(params: any): string;
  export function validateManualFoodSelection(item: any, slotId: string, targetSlotCalories: number): any;
}

declare module "*/server/engine/cookingGuide.js" {
  export function generateCookingGuide(params: any): any;
}

declare module "*/server/engine/pipeline.js" {
  export function getSeedData(): any;
  export function getDishBaseSignature(mealName: string): string;
  export function formatMealAsOption(
    meal: any,
    slotId: string,
    slotTargetCalories: number,
    profile: any,
    metrics: any,
    source?: string
  ): any;
  export function selectCandidatesForSlot(params: any): any[];
  export function buildClinicalPrintFooter(profile: any, metrics: any): any;
  export function buildWeeklyScheduleAndShoppingList(day1Slots: any[]): any;
  export function generateRegimenPipeline(profile: any, optionsPerSlot?: number): any;
}

declare module "*/server/engine/searchPolicy.js" {
  export function recipeProfileType(profile: any): string;
  export function mayShowSearchRecipe(meal: any, profile: any): boolean;
  export function isRestrictedAutomaticMeal(meal: any, profile: any): boolean;
}

declare module "*/shared/patientEducation.js" {
  export function getPatientEducation(profile: any, metrics: any): {title: string; tips: string[]; print: string}[];
}
