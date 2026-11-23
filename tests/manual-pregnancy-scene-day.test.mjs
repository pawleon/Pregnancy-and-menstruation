import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const handler=readFileSync(new URL('../message-handler.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
const a=handler.indexOf('export function setManualCycleDay(');
const b=handler.indexOf('\nexport function refreshRegenSnapshot(',a);
assert.ok(a>=0&&b>a);
const setter=new Function('getPregnancyData','getPartnerData','cycleLength','getSettings','SillyTavern','scanDateTag',
 'stripThink','rawTextOf','refreshRegenSnapshot','saveSettingsDebounced',
 'updatePromptInjection','syncUI','renderInfoblock',
 handler.slice(a,b).replace('export function','function')+'\nreturn setManualCycleDay;');
const helperStart=ui.indexOf('function sceneCalendarDayDelta(');
const helperEnd=ui.indexOf('\nfunction cycleSummary(',helperStart);
assert.ok(helperStart>=0&&helperEnd>helperStart);
function harness(){
 const root={isPregnant:true,pregnancyKnown:false,cycleDay:8,conceptionDate:'2026-11-15T00:00:00Z',rpDate:'2026-11-15T03:18:00Z'};
 const partner={isPregnant:true,pregnancyKnown:false,cycleDay:6,conceptionDate:'2026-11-15T00:00:00Z'};
 const chat=[{mes:'<!-- [RP_DATE:16.11.2026 08:24] -->',is_system:false}];
 let saved=0;
 const setting=setter(()=>root,()=>partner,()=>28,()=>({}),{getContext:()=>({chat})},
 text=>{const m=text.match(/\[RP_DATE:(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d\d):(\d\d)\]/);return m?new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5]):null},
 x=>x,m=>m.mes,()=>{},()=>saved++,()=>{},()=>{},()=>{});
 const funcs=new Function('getCycleDay',ui.slice(helperStart,helperEnd)+'\nreturn {sceneDisplayDay,sceneCalendarDaysSinceConception};')(()=>root.cycleDay);
 return {root,partner,chat,setting,saveCount:()=>saved,...funcs};
}
test('manual pregnant correction really saves Day 9 without modifying frozen day or awareness',()=>{
 const h=harness();assert.equal(h.setting('user',9),9);assert.equal(h.saveCount(),1);
 assert.equal(h.root.cycleDay,8);assert.equal(h.root.pregnancyKnown,false);
 assert.equal(h.root._pregnancySceneDayManual.day,9);
 assert.equal(h.sceneDisplayDay('user',h.root,h.root),9);
});
test('manual Day 9 survives serialized chat metadata reload',()=>{
 const h=harness();h.setting('user',9);
 const saved=JSON.parse(JSON.stringify(h.root));
 assert.equal(h.sceneDisplayDay('user',saved,saved),9);
});
test('future RP date advances anchored scene counter to Day 10',()=>{
 const h=harness();h.setting('user',9);
 h.root.rpDate='2026-11-17T08:24:00Z';
 assert.equal(h.sceneDisplayDay('user',h.root,h.root),10);
});
test('character pregnancy override remains separate from user',()=>{
 const h=harness();h.setting('char',9);
 assert.equal(h.partner.cycleDay,6);assert.equal(h.partner.pregnancyKnown,false);
 assert.equal(h.sceneDisplayDay('char',h.partner,h.root),9);
 assert.equal(h.root._pregnancySceneDayManual,undefined);
});
test('future different conception does not inherit an old scene day override',()=>{
 const h=harness();h.setting('user',9);
 h.root.conceptionDate='2026-11-16T00:00:00Z';
 assert.equal(h.sceneDisplayDay('user',h.root,h.root),8);
});
test('normal nonpregnant manual cycle still changes real stored cycle day',()=>{
 const h=harness();h.root.isPregnant=false;
 assert.equal(h.setting('user',9),9);
 assert.equal(h.root.cycleDay,9);
 assert.equal(h.root._pregnancySceneDayManual,undefined);
});
test('quick UI cannot falsely report a failed setter as success',()=>{
 assert.ok(ui.includes('if (saved === false)'));
 assert.ok(ui.includes("showNotification('Cycle day was not saved', 'warning')"));
});
