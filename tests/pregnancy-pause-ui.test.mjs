import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const handler=readFileSync(new URL('../message-handler.js',import.meta.url),'utf8');
const prompts=readFileSync(new URL('../prompts.js',import.meta.url),'utf8');
const a=ui.indexOf('function cycleCardHtml('),b=ui.indexOf('\n// Internal implementation note.\nfunction formatAgeStr(',a);
const x=ui.indexOf('function cycleSummary('),y=ui.indexOf('\nfunction getPhaseInfo(',x);
assert.ok(a>=0&&b>a&&x>=0&&y>x);
const card=ui.slice(a,b),summary=ui.slice(x,y);
const c={isPregnant:true,pregnancyKnown:false,cycleDay:8,conceptionDate:'2026-11-15T00:00:00Z',rpDate:'2027-01-16T08:24:00Z',_dynamic:{_owner:'user',note:'Calling him husband casually'}};
const s={trackFor:'user',tryingToConceive:true};
const mocks={
 getSettings:()=>s,getPregnancyData:()=>c,getCycleDay:()=>c.cycleDay,
 pregnancyIsKnown:p=>!!p.pregnancyKnown,getPostpartum:()=>null,lossCyclePaused:()=>false,hasCycle:()=>true,
 isOmegaverse:()=>false,roleLabel:()=>'',cycleLength:()=>28,bleedingDays:()=>5,
 hasMenstrualCycle:()=>true,hasOvulation:()=>true,
 getContraception:()=>null,getContraceptionDetails:()=>({}),contraceptionStatus:()=>({active:false}),
 getPhaseInfo:()=>({name:'Follicular'}),canCarry:()=>true,heatDay:()=>null,heatSettings:()=>({mode:'linked'}),
 getCycleDetails:()=>({fertility:'Fertile',libido:'High',mood:'Energetic',physical:'Energy rising',note:''}),
 hormoneCycleHint:()=>'',missedDays:(d,n)=>Math.max(0,d-n),
 getFlow:()=>null,hoursBetween:()=>null,getHygieneState:()=>({needsChange:false}),
 stat:(_icon,_color,label,val)=>'<p>'+label+': '+val+'</p>',
 fertileWindow:()=>({fertile:true,peak:true,daysToPeak:0}),
 carrierTag:()=>'',ic:()=>'',tr:x=>x
};
const keys=Object.keys(mocks);
const makeCard=new Function(...keys,card+'\nreturn cycleCardHtml;')(...Object.values(mocks));
const makeSummary=new Function(...keys,summary+'\nreturn cycleSummary;')(...Object.values(mocks));
test('hidden pregnancy keeps Day 8 for two months',()=>{
 const prior=JSON.stringify(c);
 const html=makeCard('user',c,v=>v);
 assert.match(html,/Day 8\/28 · Cycle paused \(pregnancy\)/);
 assert.doesNotMatch(html,/Day 9\/28/);
 assert.match(html,/Menstrual cycle paused due to pregnancy/);
 assert.match(html,/character remains unaware/);
 assert.equal(JSON.stringify(c),prior);
});
test('quick status states character remains unaware',()=>{
 assert.match(makeSummary('user',c,s),/Day 8\/28 · Cycle paused due to pregnancy \(character unaware\)/);
});
test('paused card does not invent fertility, hygiene or delay',()=>{
 const html=makeCard('user',c,v=>v);
 assert.match(html,/Fertility: Paused \(pregnancy\)/);
 assert.doesNotMatch(html,/Trying to conceive:/);
 assert.doesNotMatch(html,/Hygiene:/);
 assert.doesNotMatch(html,/Delay:/);
 assert.match(html,/Calling him husband casually/);
});
test('existing pregnancy-discovery switch is preserved',()=>{
 assert.match(ui,/const showPreg = data\.isPregnant && pregnancyIsKnown\(data, s\)/);
 assert.match(ui,/cards\.push\(showPreg \? pregnancyCardHtml\(who, data, tr\) : cycleCardHtml\(who, data, tr\)\)/);
});
test('quick panel hides manual day-setter during pregnancy',()=>{
 assert.match(ui,/\(!isTracked\('user'\)\) \? '' : p\.isPregnant/);
 assert.match(ui,/Cycle paused; day not changed/);
});
test('biological cycle setter still rejects pregnant updates',()=>{
 const a=handler.indexOf('export function setManualCycleDay('), b=handler.indexOf('\nexport function refreshRegenSnapshot(',a);
 const setter=new Function('getPregnancyData','getPartnerData',handler.slice(a,b).replace('export function','function')+'\nreturn setManualCycleDay;')(
  ()=>c,()=>({isPregnant:false}));
 assert.equal(setter('user',9),false);
 assert.equal(c.cycleDay,8);
 assert.equal(c.pregnancyKnown,false);
});
test('old scene-day override no longer changes the UI',()=>{
 assert.doesNotMatch(ui,/_pregnancySceneDayManual/);
 assert.doesNotMatch(handler,/_pregnancySceneDayManual/);
});
test('injected prompt separates private knowledge and biological pause',()=>{
 assert.match(prompts,/Pregnancy pauses the biological cycle at its saved day/);
 assert.match(prompts,/private pregnancy tracking never grants RP-character knowledge/);
});
test('normal menstrual summary remains unchanged',()=>{
 const normal={...c,isPregnant:false};
 assert.match(makeSummary('user',normal,s),/Day 8\/28/);
 assert.doesNotMatch(makeSummary('user',normal,s),/Cycle paused due to pregnancy/);
});