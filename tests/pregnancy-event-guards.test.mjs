// Run: node --experimental-default-type=module --test tests/pregnancy-event-guards.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePregnancyPlotEvents } from '../pregnancy-event-guards.js';

const both={trackFor:'both',userName:'Elena',charName:'Alexander'};
const single={...both,trackFor:'user'};
const cases=[
 ['completed user miscarriage','The doctor confirmed Elena had miscarried. <!-- [MISCARRIAGE] -->',both,'user:loss'],
 ['completed character miscarriage','The physician confirmed Alexander had miscarried. <!-- [MISCARRIAGE:CHAR] -->',both,'char:loss'],
 ['no marker','The doctor confirmed Elena miscarried.',both,''],
 ['marker only','<!-- [MISCARRIAGE] -->',both,''],
 ['fear only','Elena feared miscarriage. <!-- [MISCARRIAGE] -->',both,''],
 ['symptom only','Elena had cramps and bleeding. <!-- [MISCARRIAGE] -->',both,''],
 ['future risk','The doctor warned Elena she might miscarry. <!-- [MISCARRIAGE] -->',both,''],
 ['threatened miscarriage is not loss','The doctor diagnosed Elena with threatened miscarriage. <!-- [MISCARRIAGE] -->',both,''],
 ['historical event','Elena remembered miscarrying years ago. <!-- [MISCARRIAGE] -->',both,''],
 ['wrong carrier','The physician confirmed Alexander had miscarried. <!-- [MISCARRIAGE] -->',both,''],
 ['other family member','Elena learned her sister miscarried. <!-- [MISCARRIAGE] -->',both,''],
 ['both carriers: anonymous not attributed','The doctor confirmed she miscarried. <!-- [MISCARRIAGE] -->',both,''],
 ['negation','The doctor confirmed Elena did not miscarry. <!-- [MISCARRIAGE] -->',both,''],
 ['plot warning','The doctor diagnosed Elena with a threatened miscarriage. <!-- [PREG_EVENT:USER:WARNING:THREATENED_MISCARRIAGE] -->',both,'user:warning'],
 ['miscarriage scare is not warning','Elena feared threatened miscarriage after her fall. <!-- [PREG_EVENT:USER:WARNING:THREATENED_MISCARRIAGE] -->',both,''],
 ['care recorded','Elena underwent an ultrasound at the hospital for threatened miscarriage. <!-- [PREG_EVENT:USER:CARE:THREATENED_MISCARRIAGE] -->',both,'user:care'],
 ['care not resolution','Elena underwent an ultrasound for threatened miscarriage. <!-- [PREG_EVENT:USER:RESOLVED:THREATENED_MISCARRIAGE] -->',both,''],
 ['medical resolution','The doctor confirmed Elena threatened miscarriage had resolved. <!-- [PREG_EVENT:USER:RESOLVED:THREATENED_MISCARRIAGE] -->',both,'user:resolved'],
 ['not a resolution','Elena hoped her threatened miscarriage had resolved. <!-- [PREG_EVENT:USER:RESOLVED:THREATENED_MISCARRIAGE] -->',both,''],
 ['ongoing monitoring','The doctor confirmed Elena threatened miscarriage remains under observation. <!-- [PREG_EVENT:USER:ONGOING:THREATENED_MISCARRIAGE] -->',both,'user:ongoing'],
 ['partial fetus two',"The doctor confirmed Elena miscarried her second twin, and Elena's remaining twin survived. <!-- [PREG_LOSS:USER:2] -->",both,'user:partial'],
 ['partial identity unspecified','The doctor confirmed Elena miscarried a twin. <!-- [PREG_LOSS:USER:2] -->',both,''],
 ['only one event if duplicate tag','The doctor confirmed Elena miscarried. <!-- [MISCARRIAGE] --><!-- [MISCARRIAGE] -->',both,'user:loss'],
 ['stillbirth confirmed',"The physician confirmed Alexander's baby was stillborn. <!-- [STILLBIRTH:CHAR] -->",both,'char:stillbirth'],
 ['stillbirth fear',"Alexander feared stillbirth. <!-- [STILLBIRTH:CHAR] -->",both,''],
 ['abortion completed','Elena underwent an abortion at the clinic. <!-- [ABORTION] -->',both,'user:termination'],
 ['abortion merely planned','Elena planned an abortion. <!-- [ABORTION] -->',both,''],
 ['wrong abortion owner','Alexander underwent an abortion. <!-- [ABORTION] -->',both,''],
 ['single tracking with clear event','The doctor confirmed she miscarried. <!-- [MISCARRIAGE] -->',single,'user:loss'],
 ['comment tag inside quoted code','The doctor confirmed Elena had miscarried. \x60\x60\x60html\n<!-- [MISCARRIAGE] -->\n\x60\x60\x60',both,''],
 ['conflicting losses','The doctor confirmed Elena miscarried, and Elena gave birth to a stillborn baby. <!-- [MISCARRIAGE] --><!-- [STILLBIRTH] -->',both,'']
];
for(const [name,scene,options,expected] of cases){
 test(name,()=>{
   const actual=parsePregnancyPlotEvents(scene,options).map(e=>e.who+':'+e.kind).join(',');
   assert.equal(actual,expected);
 });
}
test('plot events are applied with snapshots and no model-request side effects',()=>{
 const code=readFileSync(new URL('../message-handler.js',import.meta.url),'utf8');
 assert.match(code,/parsePregnancyPlotEvents\(text/);
 assert.match(code,/restoreTurnBaseline\(positionId\)/);
 assert.match(code,/pushStateHistory\(positionId\)/);
});
test('manual pregnancy warning/loss controls exist for both carriers',()=>{
 const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
 assert.match(ui,/id="repro-comp-source"/);
 assert.match(ui,/id="repro-comp-loss"/);
 assert.match(ui,/id="repro-comp-stillbirth"/);
 assert.match(ui,/id="repro-comp-partial"/);
 assert.match(ui,/id="repro-comp-cycle-return"/);
 assert.match(ui,/recordManualPregnancyEvent/);
});
test('technical plot tags are preserved for scans and hidden from rendered chat',()=>{
 const scanner=readFileSync(new URL('../scanner.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.js',import.meta.url),'utf8');
 assert.match(scanner,/PREG_EVENT/);
 assert.match(scanner,/PREG_LOSS/);
 assert.match(scanner,/STILLBIRTH/);
 assert.match(index,/\[PREG_EVENT:/);
});
