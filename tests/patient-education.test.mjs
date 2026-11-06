import test from 'node:test';
import assert from 'node:assert/strict';
import {getPatientEducation} from '../shared/patientEducation.js';
const titles = (s) => s.map(x=>x.title);
test('combined conditions are composed without hiding other guidance',()=>{
 const sections=getPatientEducation({conditions:['kidney','stone_calcium_oxalate','diabetes','hypothyroid','pcos'],is_dialysis:true},{bmi:27});
 for(const title of ['بیماری کلیه و دیالیز','سنگ کلیه','قند خون و دیابت','کم‌کاری تیروئید','تخمدان پلی‌کیستیک','مدیریت وزن']) assert.ok(titles(sections).includes(title),title);
 const stone=sections.find(s=>s.title==='سنگ کلیه').tips.join(' ');assert.match(stone,/محدودیت مایعات|تیم درمان/);assert.doesNotMatch(stone,/لیتر/);
});
test('stone and reflux advice does not insist on vinegar or automatically impose CKD',()=>{
 const sections=getPatientEducation({conditions:['stone_uric_acid','diabetes','reflux']},{});const text=sections.flatMap(s=>s.tips).join(' ');assert.ok(!titles(sections).includes('بیماری کلیه و دیالیز'));assert.match(text,/سرکه.*ضروری نیست/);assert.match(text,/جگر/);
});
test('different stone types are not given identical restrictions',()=>{
 const s=getPatientEducation({conditions:['stone_struvite']},{}).flatMap(x=>x.tips).join(' ');assert.match(s,/عفونت/);assert.doesNotMatch(s,/اسفناج/);
});
