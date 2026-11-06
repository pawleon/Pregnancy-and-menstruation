// Independent per-character reproductive capability and Omegaverse cycle model.
import { getPhaseInfo } from './helpers.js';
import { cycleLength, bleedingDays, fertileDays } from './cycle-model.js';
export function isOmegaverse(s) { return s?.universe === 'omegaverse'; }
export function carrierMode(s) {
    if (['user','char','both','none'].includes(s?.carrierMode)) return s.carrierMode;
    return ['user','char','both','none'].includes(s?.trackFor) ? s.trackFor : 'user';
}
const suffix = who => who === 'char' ? 'Char' : 'User';
export function canCarry(s, who) {
    if (!['user','char'].includes(who)) return false;
    const choice = s?.['carry'+suffix(who)];
    if (typeof choice === 'boolean') return choice;
    const m = carrierMode(s);
    return m === 'both' || m === who;
}
export function hasMenstrualCycle(s, who) {
    const choice = s?.['bleed'+suffix(who)];
    if (typeof choice === 'boolean') return choice;
    // Old saves without separate settings still honor the legacy checkbox.
    return s?.menstruationEnabled !== false && canCarry(s,who);
}
export function hasOvulation(s,who) {
    const choice=s?.['ovulate'+suffix(who)];
    if (typeof choice==='boolean') return choice;
    return hasMenstrualCycle(s,who);
}
export function hasAnyTracking(s, who) { const m = s?.trackFor || 'user'; return m === 'both' || m === who; }
export function designationOf(s, who) {
    const v = who === 'char' ? s?.charDesignation : s?.userDesignation;
    return ['alpha','beta','omega'].includes(v) ? v : who === 'char' ? 'alpha' : 'omega';
}
export function sexOf(s, who) { return who === 'char' ? s?.sexChar : s?.sexUser; }
export function heatSettings(s, who) {
    const suf=suffix(who), freq=Number(s?.['heatFrequency'+suf]), dur=Number(s?.['heatDuration'+suf]);
    return { mode: ['linked','independent','off'].includes(s?.['heatMode'+suf]) ? s['heatMode'+suf] : 'linked',
        frequency: Number.isInteger(freq) && freq>0 ? freq : cycleLength(s,who),
        duration: Number.isInteger(dur) && dur>0 ? dur : 5,
        anchor: s?.['heatAnchor'+suf] || '',
        fertility: ['none','boost','required'].includes(s?.['heatFertility'+suf]) ? s['heatFertility'+suf] : 'none' };
}
export function heatDay(s, who, day, rpDate='') {
    const cfg=heatSettings(s,who);
    if (cfg.mode === 'off' || !isOmegaverse(s) || designationOf(s,who)==='beta') return null;
    if (cfg.mode === 'linked') {
        const n=cycleLength(s,who), {start,end}=fertileDays(n,bleedingDays(s,who));
        return { day, length:n, active:day>=start && day<=end, start,end, type: designationOf(s,who)==='alpha'?'rut':'heat' };
    }
    // An independent heat must NEVER borrow the menstrual day. Until RP time
    // and a valid anchor exist, report an unanchored cycle instead of fake heat.
    const anchorMs=cfg.anchor ? Date.parse(cfg.anchor+'T00:00:00Z') : NaN;
    const rpMs=rpDate ? Date.parse(String(rpDate).slice(0,10)+'T00:00:00Z') : NaN;
    if (!Number.isFinite(anchorMs) || !Number.isFinite(rpMs))
        return {day:null,length:cfg.frequency,active:false,unanchored:true,start:1,end:Math.min(cfg.duration,cfg.frequency),type:designationOf(s,who)==='alpha'?'rut':'heat'};
    const elapsed=Math.floor((rpMs-anchorMs)/86400000);
    const dayInCycle=((elapsed % cfg.frequency)+cfg.frequency)%cfg.frequency+1;
    return { day:dayInCycle,length:cfg.frequency,active:dayInCycle<=Math.min(cfg.duration,cfg.frequency),
        start:1,end:Math.min(cfg.duration,cfg.frequency),type:designationOf(s,who)==='alpha'?'rut':'heat' };
}
export function hasCycle(s, who) {
    return hasMenstrualCycle(s,who) || hasOvulation(s,who) || !!heatDay(s,who,1);
}
export function roleLabel(s, who) { return {alpha:'Alpha',beta:'Beta',omega:'Omega'}[designationOf(s,who)]; }
export function cyclePhase(s, who, day, lang='en', rpDate='') {
    const cycle = hasMenstrualCycle(s,who) || hasOvulation(s,who);
    const info = getPhaseInfo(day,lang,false,hasMenstrualCycle(s,who),cycleLength(s,who),bleedingDays(s,who));
    const h=heatDay(s,who,day,rpDate);
    if (h?.active) return {...info,name: h.type==='rut'?'Rut':'Heat', heatCycleDay:h.day, heatCycleLength:h.length, heatDuration:h.end, color:'#ff6b6b'};
    if (cycle) return info;
    return {...info,name:h ? (h.type==='rut'?'Outside rut':'Between heats') : 'Status',color:'#a88ae3'};
}
export function getCfg(s=null,who='user') { const cfg=heatSettings(s,who);return {heatCycleLength:cfg.frequency,heatDuration:cfg.duration,rutCycleLength:cfg.frequency,rutDuration:cfg.duration}; }
export function getHeatPhase(day,s=null,who='user',rpDate='') {
    const h=heatDay(s,who,day,rpDate); const active=!!h?.active;
    return {phase:active?'heat':'normal',day:h?.day||day,len:h?.length||cycleLength(s,who),label: active?'Heat':'Between heats',
        sub:`day ${h?.day||day} of ${h?.length||cycleLength(s,who)}`, labelEn:active?'Heat':'Between heats',fertility:active?1.5:1};
}
export function getRutPhase(day,s=null,who='user',rpDate='') { const h=getHeatPhase(day,s,who,rpDate);return {...h,phase:h.phase==='heat'?'rut':'normal',inRut:h.phase==='heat',potency:h.phase==='heat'?1.5:1}; }
export function carrierAboStatus(carrier,designation,s) {
    if (carrier?.isPregnant) return {kind:'cycle',phase:'paused',label:'Cycle paused',labelEn:'cycle paused',fertility:0};
    const who=carrier?._who==='char'?'char':'user';
    const h=heatDay(s,who,Math.max(1,Number(carrier?.cycleDay)||1),carrier?.rpDate);
    const phase=h?.active ? (designation==='alpha'?'rut':'heat') : 'normal';
    return {kind:designation,phase,day:carrier?.cycleDay||1,len:h?.length||cycleLength(s,who),inRut:phase==='rut',fertility:h?.active?1.5:1,label:phase==='rut'?'Rut':phase==='heat'?'Heat':designation==='alpha'?'Outside rut':'Between heats'};
}
export function advanceAboCycles() { return []; }