import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const a=source.indexOf('function cycleCardHtml(');
const b=source.indexOf('\n// Internal implementation note.\nfunction formatAgeStr(',a);
assert.ok(a>=0&&b>a,'cycle card function found');
const card=source.slice(a,b);
const helperStart=source.indexOf('function sceneCalendarDaysSinceConception(');
const helperEnd=source.indexOf('\nfunction cycleSummary(',helperStart);
assert.ok(helperStart>=0 && helperEnd>helperStart);
const sceneCalendarDaysSinceConception=new Function(source.slice(helperStart,helperEnd)+'\nreturn sceneCalendarDaysSinceConception;')();
const rpTime={value:'2026-11-16T08:24:00Z'};
const mocks={
 getSettings:()=>({tryingToConceive:true}),
 getPregnancyData:()=>({rpDate:rpTime.value}),
 getCycleDay:()=>8,
 sceneCalendarDaysSinceConception,
 cycleLength:()=>28,bleedingDays:()=>5,
 getContraception:()=>null,getContraceptionDetails:()=>({}),contraceptionStatus:()=>({active:false}),
 getPhaseInfo:()=>({name:'Ovulation'}),
 hasCycle:()=>true,canCarry:()=>true,hasMenstrualCycle:()=>true,hasOvulation:()=>true,
 isOmegaverse:()=>false,heatDay:()=>null,
 getCycleDetails:()=>({fertility:'Fertile',libido:'Moderate',mood:'Energetic',physical:'Energy rising',note:''}),
 missedDays:(d,n)=>Math.max(0,d-n),getPostpartum:()=>null,
 getFlow:()=>null,getHygieneState:()=>({needsChange:false}),
 stat:(_icon,_color,label,val)=>'<'+'p>'+label+': '+val+'<'+'/p>',
 fertileWindow:()=>({fertile:true,peak:true,daysToPeak:0}),
 tr:x=>x,ic:()=>'',carrierTag:()=>''
};
const keys=Object.keys(mocks);
const render=new Function(...keys,card+'\nreturn cycleCardHtml;')(...Object.values(mocks));
function sample({pregnant=true,known=true,who='user',frozenDay=8,conception='2026-11-15T00:00:00Z'}={}){
 const carrier={isPregnant:pregnant,pregnancyKnown:known,
   cycleDay:frozenDay,conceptionDate:conception,_dynamic:{}};
 const before=JSON.stringify(carrier);
 const html=render(who,carrier,x=>x);
 assert.equal(JSON.stringify(carrier),before,'no cycle/pregnancy state mutations');
 return html;
}
test('known pregnancy day 8 + Nov 16 = scene day 9',()=>{
 assert.match(sample(),/Day 9\/28 · scene-based status/);
});
test('hidden pregnancy uses same day as known pregnancy',()=>{
 assert.match(sample({known:false}),/Day 9\/28 · scene-based status/);
});
test('conception date still displays day 8',()=>{
 rpTime.value='2026-11-15T08:24:00Z';
 assert.match(sample(),/Day 8\/28 · scene-based status/);
 rpTime.value='2026-11-16T08:24:00Z';
});
test('Nov 17 displays day 10 without changing stored day',()=>{
 rpTime.value='2026-11-17T08:24:00Z';
 assert.match(sample(),/Day 10\/28 · scene-based status/);
 rpTime.value='2026-11-16T08:24:00Z';
});
test('nonpregnant cycle still uses frozen normal day',()=>{
 const html=sample({pregnant:false});
 assert.match(html,/Day 8\/28/);
 assert.doesNotMatch(html,/scene-based status/);
});
test('character carrier uses its own stored day',()=>{
 assert.match(sample({who:'char',frozenDay:6}),/Day 7\/28 · scene-based status/);
});
test('pregnant scene card does not invent menstrual or fertility events',()=>{
 const html=sample();
 for(const marker of ['Delay:', 'Hygiene:', 'Trying to conceive:', 'Fertility: Fertile']) assert.ok(!html.includes(marker),marker);
 assert.match(html,/Fertility: Undetermined/);
});
test('pregnancy card ignores outdated dynamic text from other carrier',()=>{
 const html=sample();assert.ok(html.includes('Day 9/28'));
});
test('a calendar date transition advances before 24 hours elapsed',()=>{
  // Conception at 23:30 Nov 15, scene at 08:24 Nov 16 (<24h).
  assert.equal(sceneCalendarDaysSinceConception(
    {conceptionDate:'2026-11-15T23:30:00Z'},{rpDate:'2026-11-16T08:24:00Z'}),1);
  assert.match(sample({known:false,conception:'2026-11-15T23:30:00Z'}),/Day 9\/28 · scene-based status/);
});
test('same calendar date does not advance scene day',()=>{
  rpTime.value='2026-11-15T23:59:00Z';
  assert.match(sample({conception:'2026-11-15T00:01:00Z'}),/Day 8\/28 · scene-based status/);
  rpTime.value='2026-11-16T08:24:00Z';
});
