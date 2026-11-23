import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.js',import.meta.url),'utf8');
const a=source.indexOf('function syncLatestRpDateFromHistory(');
const b=source.indexOf('\nfunction refreshAfterChatChange(',a);
assert.ok(a>=0&&b>a);
const build=new Function('SillyTavern','getPregnancyData','rawTextOf','scanDateTag',
 'processDateTag','reportError',source.slice(a,b)+'\nreturn syncLatestRpDateFromHistory;');
function scenario({saved='2026-11-15T03:18:00Z',latest='2026-11-16T08:24:00Z'}={}){
 const p={rpDate:saved,isPregnant:true,pregnancyKnown:false,cycleDay:8,conceptionDate:'2026-11-15T00:00:00Z'};
 const chat=[{mes:'<!-- [RP_DATE:'+latest+'] -->',is_system:false}];
 let updates=0, errors=[];
 const run=build({getContext:()=>({chat})},()=>p,m=>m.mes,
 raw=>{const s=raw.match(/\[RP_DATE:([^\]]+)\]/);return s?new Date(s[1]):null;},
 raw=>{const s=raw.match(/\[RP_DATE:([^\]]+)\]/);if(!s||p.rpDate===s[1])return false;p.rpDate=s[1];updates++;return true;},
 e=>errors.push(String(e)));
 return {p,chat,run,updates:()=>updates,errors};
}
test('startup reads latest stored RP date without another generation',()=>{
 const s=scenario(); assert.equal(s.run(),true);
 assert.equal(s.p.rpDate,'2026-11-16T08:24:00Z');
 assert.equal(s.p.cycleDay,8);assert.equal(s.p.pregnancyKnown,false);
});
test('sync is idempotent',()=>{
 const s=scenario();s.run();s.run();assert.equal(s.updates(),1);
});
test('older saved reply never rewinds RP date',()=>{
 const s=scenario({saved:'2026-11-16T08:24:00Z',latest:'2026-11-15T03:18:00Z'});
 assert.equal(s.run(),false);assert.equal(s.p.rpDate,'2026-11-16T08:24:00Z');
});
