// Search-only recipes are curated fixed portions, never evidence of personalized safety.
import { normalizeFa } from '../../shared/persian.js';
export function recipeProfileType(profile = {}) {
  const conditions = Array.isArray(profile.conditions) ? profile.conditions : [];
  if (conditions.includes('kidney') || profile.is_dialysis) return 'renal';
  if (profile.is_athlete) return 'athlete';
  return 'light';
}
export function mayShowSearchRecipe(meal, profile) {
  return !meal.search_only || (Boolean(profile) && meal.adaptation_for === recipeProfileType(profile));
}
export function isRestrictedAutomaticMeal(meal, profile = {}) {
  if (meal.search_only) return true;
  const cond = Array.isArray(profile.conditions) ? profile.conditions : [];
  const atRisk = profile.is_athlete || cond.some(c => ['kidney','fatty_liver','cholesterol','heart','hypertension','diabetes'].includes(c) || c.startsWith('stone_'));
  if (!atRisk) return false;
  const text = normalizeFa(`${meal.name || ''} ${meal.ingredients_desc || ''}`);
  return /(پیتزا|لازانیا|پپرونی|فست فود|سوسیس|کالباس|ژامبون|سرخ شده|سرخ کردنی|سرخ شده در روغن|سس الفردو|خامه)/.test(text);
}
