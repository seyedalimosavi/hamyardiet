import test from 'node:test';
import assert from 'node:assert/strict';
import {getSeedData,getDishBaseSignature,selectCandidatesForSlot,formatMealAsOption,generateRegimenPipeline} from '../server/engine/pipeline.js';
import {calculateClinicalMetrics,scanX} from '../server/engine/clinicalRules.js';
import {mayShowSearchRecipe,isRestrictedAutomaticMeal} from '../server/engine/searchPolicy.js';
const base={gender:'female',age:30,height_cm:165,weight_kg:65,activity_factor:1.375,goal:'maintain',conditions:[]};
test('near-duplicate Persian names with quantities map to same dish across lunch and dinner',()=>{
 for(const [a,b] of [['۱ کاسه عدسی','۴ قاشق عدس پخته'],['دال عدس گیاهی','خوراک عدسی غلیظ'],['۸ قاشق عدس‌پلو','عدس پلو کم روغن'],['کوکو سبزی با نان','نان + کوکو سبزی'],['ماکارونی با گوشت','۱ لیوان پاستا پنه']])assert.equal(getDishBaseSignature(a),getDishBaseSignature(b),`${a} / ${b}`);
 assert.notEqual(getDishBaseSignature('عدسی'),getDishBaseSignature('عدس پلو'));
});
test('adapted recipe types have different clinical profiles and remain search only',()=>{
 const meals=getSeedData().meals.filter(m=>m.search_only && m.slot_type==='d');assert.equal(meals.length,6);
 for(const meal of meals){assert.ok(isRestrictedAutomaticMeal(meal,base)); assert.equal(mayShowSearchRecipe(meal,{...base,conditions:['kidney'],is_athlete:true}),meal.adaptation_for==='renal');assert.equal(mayShowSearchRecipe(meal,{...base,is_athlete:true}),meal.adaptation_for==='athlete');assert.equal(mayShowSearchRecipe(meal,{...base,conditions:['fatty_liver']}),meal.adaptation_for==='light');}
});
test('search recipes preserve fixed portions and deliver method and caution',()=>{
 const meal=getSeedData().meals.find(m=>m.code==='ADAPT_pizza_renal_d');const option=formatMealAsOption(meal,'d',700,{...base,conditions:['kidney']},{});
 assert.equal(option.final_calories,meal.base_calories);assert.equal(option.scaled_ingredients_fa,meal.ingredients_desc);assert.ok(option.preparation_fa);assert.ok(option.soft_warnings_fa.length);assert.equal(option.grain_box,null);
});
test('ordinary processed pizza does not appear in automatic plans for liver or athlete',()=>{
 for(const p of [{...base,conditions:['fatty_liver']},{...base,is_athlete:true,sport_phase:'lean_bulk'}, {...base,conditions:['kidney']}]){
 const plan=generateRegimenPipeline(p);for(const slot of plan.day1_slots) for(const opt of slot.options) assert.doesNotMatch(opt.title_fa,/پیتزا|لازانیا/);
 }
});
test('rejected food families are avoided and repeating becomes possible after long refresh history',()=>{
 const allMeals=[]; for(let i=0;i<25;i++)allMeals.push({code:`q${i}`,name:`غذای متمایز شماره ${i}`,slot_type:'l',ingredients_desc:`غذای متمایز ${i}`,base_calories:400,neg_tags_final:[]});
 // Prefix numbers differ after the signature limit, so use truly unique names instead.
 allMeals.forEach((m,i)=>m.name=`غذای ${String.fromCharCode(65+i)} متمایز`);
 const metrics=calculateClinicalMetrics(base), rejected=new Set(), signatures=new Set();let repeated=false;
 for(let i=0;i<30;i++){let [o]=selectCandidatesForSlot({allMeals,slotId:'l',slotType:'l',slotCal:400,profile:base,metrics,count:1,softRejectedCodes:rejected});assert.ok(o); if(rejected.has(o.meal_code)) repeated=true; else {assert.ok(!signatures.has(getDishBaseSignature(o.title_fa)));rejected.add(o.meal_code);signatures.add(getDishBaseSignature(o.title_fa));}}
 assert.ok(repeated);
});

test('ordinary pizza and lasagna are not silently marked gluten free',()=>{
 assert.ok(scanX('پیتزا گوشت و قارچ با خمیر ضخیم').includes('NEG_GLUTEN'));
 assert.ok(scanX('لازانیا مرغ').includes('NEG_GLUTEN'));
});
