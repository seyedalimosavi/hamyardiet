import test from 'node:test';
import assert from 'node:assert/strict';
import { getDishBaseSignature, formatMealAsOption, getSeedData, selectCandidatesForSlot } from '../server/engine/pipeline.js';
import { calculateClinicalMetrics } from '../server/engine/clinicalRules.js';

test('عدسی variants use one family', () => assert.equal(getDishBaseSignature('عدسی خانگی'), getDishBaseSignature('خوراک عدس رژیمی')));
test('apple does not inherit the slot target', () => {
 const meal = getSeedData().meals.find(m => m.name === 'سیب متوسط با دارچین');
 const option = formatMealAsOption(meal, 's1', 220, {conditions:[]}, {}, 'auto');
 assert.equal(option.final_calories, 100); assert.match(option.scaled_ingredients_fa, /۱ عدد سیب/);
});
test('stone advice and restrictions remain distinct from chronic kidney disease', () => {
 const profile={gender:'female',age:30,height_cm:165,weight_kg:70,activity_factor:1.375,goal:'loss',conditions:['stone_calcium_oxalate']};
 const metrics=calculateClinicalMetrics(profile); assert.ok(metrics.warnings_fa.some(w=>w.includes('اگزالات')));
 const options=selectCandidatesForSlot({allMeals:[{name:'اسفناج',ingredients_desc:'اسفناج',slot_type:'l',base_calories:300,code:'x',neg_tags:[]}],slotId:'l',slotType:'l',slotCal:300,profile,metrics}); assert.equal(options.length,0);
});
test('cooking fat is not replaced with yogurt for omelette', () => {
 const meal={name:'املت',ingredients_desc:'۲ تخم مرغ + گوجه + ۱ ق‌چ روغن مایع',base_calories:250,cook_kind:'pan'};
 const option=formatMealAsOption(meal,'b',250,{conditions:['fatty_liver']},{zero_oil_cooking:true,conditions:['fatty_liver']});
 assert.match(option.oil_box.instruction_fa,/تابه نچسب/); assert.doesNotMatch(option.oil_box.instruction_fa,/ماست/); assert.match(option.scaled_ingredients_fa,/روغن/);
});
