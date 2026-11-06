import test from 'node:test';
import assert from 'node:assert/strict';
import {scanX,calculateClinicalMetrics} from '../server/engine/clinicalRules.js';
import {generateRegimenPipeline,getSeedData,formatMealAsOption,selectCandidatesForSlot} from '../server/engine/pipeline.js';
import {generateCookingGuide} from '../server/engine/cookingGuide.js';
const base={gender:'female',age:32,height_cm:165,weight_kg:65,activity_factor:1.375,goal:'maintain'};
test('bank preserves original meals and adds separate fixed-serving records with unique codes',()=>{
 const meals=getSeedData().meals;assert.equal(meals.filter(m=>m.code.startsWith('EXT')).length,16);assert.equal(new Set(meals.map(m=>m.code)).size,meals.length);
 for(const m of meals.filter(m=>m.fixed_portion)) {const o=formatMealAsOption(m,m.slot_type,800,base,{});assert.equal(o.final_calories,m.base_calories);assert.equal(o.scaled_ingredients_fa,m.ingredients_desc);}
});
test('stone ingredient flags handle Persian variants and explicit absence',()=>{
 assert.ok(scanX('خوراک اسفناج و بادام‌زمینی').includes('NEG_STONE_OXALATE_HIGH'));
 assert.ok(!scanX('خوراک بدون اسفناج').includes('NEG_STONE_OXALATE_HIGH'));
 assert.ok(scanX('ساردین').includes('NEG_STONE_PURINE_HIGH'));
 assert.ok(scanX('خیارشور').includes('NEG_HIGH_SALT'));
});
test('stone-specific tags differ, stone does not imply CKD or forbid dietary calcium',()=>{
 const ox=calculateClinicalMetrics({...base,conditions:['stone_calcium_oxalate']});
 const ur=calculateClinicalMetrics({...base,conditions:['stone_uric_acid']});
 const str=calculateClinicalMetrics({...base,conditions:['stone_struvite']});
 assert.ok(ox.hard_bans.includes('NEG_STONE_OXALATE_HIGH'));assert.ok(!ox.hard_bans.includes('NEG_KIDNEY'));
 assert.ok(ur.hard_bans.includes('NEG_STONE_PURINE_HIGH'));assert.ok(!str.hard_bans.includes('NEG_STONE_OXALATE_HIGH'));
 assert.ok(!scanX('ماست کم چرب').includes('NEG_STONE_OXALATE_HIGH'));
});
test('CKD, dialysis and athlete combinations do not prescribe a fixed fluid allowance or high athlete protein',()=>{
 for (const is_dialysis of [true,false]){
  const m=calculateClinicalMetrics({...base,conditions:['kidney','stone_uric_acid'],is_dialysis,is_athlete:true,sport_phase:'cut_definition'});
  assert.equal(m.water_l,null);assert.equal(m.protein_g,Math.round(65*(is_dialysis?1.2:0.8)));assert.match(m.athlete_protocol.hydration_electrolyte_fa,/تیم درمان/);assert.doesNotMatch(m.athlete_protocol.post_workout_guide_fa,/پنجره طلایی|موز|اسکوپ/);
 }
});
test('renal guide never directs blanket tomato avoidance and requires individualized assessment',()=>{
 const g=generateCookingGuide({profile:{conditions:['kidney']}});assert.match(g.condition_protocols_fa[0].body_fa,/آزمایش/);assert.doesNotMatch(g.condition_protocols_fa[0].body_fa,/مطلقاً/);
});
test('all auto options respect combined stone plus allergy tags',()=>{
 for(const stone of ['stone_calcium_oxalate','stone_calcium_phosphate','stone_uric_acid','stone_cystine','stone_struvite','stone_unknown']){
 const profile={...base,conditions:[stone],allergies:['NEG_LACTOSE'],is_athlete:true,sport_phase:'lean_bulk'};const r=generateRegimenPipeline(profile);const map=new Map(getSeedData().meals.map(m=>[m.code,m]));
 for(const slot of r.day1_slots)for(const o of slot.options){const m=map.get(o.meal_code);assert.ok(m);assert.ok(!m.neg_tags_final.includes('NEG_LACTOSE'));if(stone==='stone_calcium_oxalate')assert.ok(!m.neg_tags_final.includes('NEG_STONE_OXALATE_HIGH'));if(stone==='stone_uric_acid')assert.ok(!m.neg_tags_final.includes('NEG_STONE_PURINE_HIGH'));}
 }
});
test('explicit oil in fixed recipe is not added a second time',()=>{
 const m=getSeedData().meals.find(m=>m.code==='EXT009');const o=formatMealAsOption(m,'l',600,base,{});assert.match(o.oil_box.instruction_fa,/روغن دیگری اضافه نشود/);
});

test('scanner does not confuse bell pepper or leafy vegetables with organ or red meat',()=>{
 assert.ok(!scanX('فلفل دلمه ای و برگ کلم').includes('NEG_GOUT'));
 assert.ok(!scanX('فلفل دلمه ای و برگ کلم').includes('NEG_RED_MEAT'));
 assert.ok(scanX('دل و قلوه').includes('NEG_GOUT'));
});
