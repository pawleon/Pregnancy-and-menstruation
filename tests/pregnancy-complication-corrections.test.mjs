// Run: node --experimental-default-type=module --test tests/pregnancy-complication-corrections.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONDITIONS } from '../pregnancy-event-guards.js';

// Isolate the state-changing module so the test does not need SillyTavern globals.
const source=readFileSync(new URL('../pregnancy-events.js',import.meta.url),'utf8')
    .replace(/^import .*;\s*$/gm,'')
    .replace(/^export /gm,'');
const factory=new Function(
    'getSettings','getPregnancyData','getPartnerData','saveSettingsDebounced',
    'carrierName','isTracked','createUndoCheckpoint','showNotification',
    'CONDITIONS','SillyTavern',
    source+'; return {removeIncorrectPregnancyComplication,applyPregnancyPlotEvent};'
);
function setup({size=15}={}){
    const user={isPregnant:true,pregnancyWeeks:2,conceptionDate:'2026-11-22T00:00:00Z',
        pregnancyKnown:false,healthStatus:'critical',fetusCount:1,
        complications:[{code:'THREATENED_MISCARRIAGE',type:'Threatened miscarriage',severity:'critical',resolved:false}],
        complicationEvents:[],lossHistory:[],rpDate:'2026-11-22T00:00:00Z'};
    const partner={isPregnant:true,healthStatus:'normal',complications:[],complicationEvents:[]};
    user.partner=partner;
    const logs={saves:0,checkpoints:0,notifications:[]};
    const api=factory(()=>({showNotifications:true,complicationNotifications:true}),
        ()=>user,()=>partner,()=>logs.saves++,who=>who,
        ()=>true,()=>{logs.checkpoints++;},
        (...args)=>logs.notifications.push(args),CONDITIONS,
        {getContext:()=>({chat:new Array(size)})});
    return {user,partner,logs,api};
}
test('correcting false warning resets health but preserves Gwen pregnancy and dates',()=>{
    const {user,api,logs}=setup();
    const copy={pregnancyWeeks:user.pregnancyWeeks,conceptionDate:user.conceptionDate,
        known:user.pregnancyKnown,fetusCount:user.fetusCount};
    assert.equal(api.removeIncorrectPregnancyComplication('user',0),true);
    assert.equal(user.complications.length,0);
    assert.equal(user.healthStatus,'normal');
    assert.equal(user.isPregnant,true);
    assert.equal(user.pregnancyWeeks,copy.pregnancyWeeks);
    assert.equal(user.conceptionDate,copy.conceptionDate);
    assert.equal(user.pregnancyKnown,copy.known);
    assert.equal(user.fetusCount,copy.fetusCount);
    assert.deepEqual(user.lossHistory,[]);
    assert.equal(logs.checkpoints,1);
    assert.equal(logs.saves,1);
});
test('older false diagnosis stays suppressed but new confirmed event can be recorded',()=>{
    const {user,api}=setup();
    assert.equal(api.removeIncorrectPregnancyComplication('user',0),true);
    const event={who:'user',kind:'warning',code:'THREATENED_MISCARRIAGE'};
    assert.equal(api.applyPregnancyPlotEvent(event,{sourcePosition:9,silent:true}),false);
    assert.equal(user.complications.length,0);
    assert.equal(api.applyPregnancyPlotEvent(event,{sourcePosition:16,silent:true}),true);
    assert.equal(user.complications[0].sourcePosition,16);
    assert.equal(user.complications[0].origin,'rp');
    assert.equal(user.healthStatus,'critical');
});
test('other active conditions preserve warning health when critical false condition is removed',()=>{
    const {user,api}=setup();
    user.complications.push({code:'ANEMIA',type:'Anemia',severity:'warning',resolved:false});
    assert.equal(api.removeIncorrectPregnancyComplication('user',0),true);
    assert.equal(user.complications.length,1);
    assert.equal(user.complications[0].type,'Anemia');
    assert.equal(user.healthStatus,'warning');
});
test('manual warnings stay explicitly manual and correction is per carrier',()=>{
    const {user,partner,api}=setup();
    partner.complications.push({code:'ANEMIA',type:'Anemia',severity:'warning',resolved:false});
    assert.equal(api.removeIncorrectPregnancyComplication('user',0),true);
    assert.equal(partner.complications.length,1);
    assert.equal(api.applyPregnancyPlotEvent(
        {who:'user',kind:'warning',code:'THREATENED_MISCARRIAGE'},
        {manual:true,silent:true}),true);
    assert.equal(user.complications[0].origin,'manual');
    assert.equal(user.complications[0].sourcePosition,null);
});
test('rejects invalid correction targets and resolved records',()=>{
    const {user,api}=setup();
    assert.equal(api.removeIncorrectPregnancyComplication('user',5),false);
    user.complications[0].resolved=true;
    assert.equal(api.removeIncorrectPregnancyComplication('user',0),false);
});
test('rescan retains false-warning exclusions and new UI requires deliberate selection',()=>{
    const scanner=readFileSync(new URL('../scanner.js',import.meta.url),'utf8');
    const ui=readFileSync(new URL('../ui.js',import.meta.url),'utf8');
    const prompt=readFileSync(new URL('../prompts.js',import.meta.url),'utf8');
    assert.match(scanner,/savedDismissedUser/);
    assert.match(scanner,/sourcePosition:i\+1/);
    assert.match(ui,/id="repro-comp-remove"/);
    assert.match(ui,/Select a complication first/);
    assert.match(prompt,/Complications=none confirmed/);
});