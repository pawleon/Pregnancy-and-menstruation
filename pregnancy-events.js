/** Plot-driven pregnancy complications, care, confirmation and loss records.
 * Reads/writes the existing per-chat pregnancy objects. No random pregnancy loss.
 */
import {getSettings,getPregnancyData,getPartnerData,saveSettingsDebounced,carrierName,isTracked} from './state.js';
import {createUndoCheckpoint} from './pregnancy.js';
import {showNotification} from './notifications.js';
import {CONDITIONS} from './pregnancy-event-guards.js';

function carrier(who){return who==='char'?getPartnerData():getPregnancyData();}
function date(){return getPregnancyData().rpDate||null;}
export function lossCyclePaused(who){const c=carrier(who);return !c.isPregnant&&!!c.lossRecovery&&!c.lossRecovery.cycleResumed;}
function notify(who,description,kind,silent){
 const s=getSettings();
 if(!silent&&s.showNotifications&&s.complicationNotifications!==false)
   showNotification('<i class="fa-solid fa-heart-pulse"></i> '+carrierName(who)+': '+description,
     kind==='resolved'?'success':['warning','loss'].includes(kind)?'warning':'info');
}
function active(c,code){
 const label=CONDITIONS[code]?.label.toLowerCase();
 return (c.complications||[]).find(item=>!item.resolved&&
   (item.code===code||String(item.type||'').toLowerCase()===label));
}
function recalc(c){
 const a=(c.complications||[]).filter(x=>!x.resolved);
 c.healthStatus=a.some(x=>x.severity==='critical')?'critical':a.length?'warning':'normal';
}
function log(c,item){
 c.complicationEvents||=[];
 c.complicationEvents.push({rpDate:date(),...item});
 c.complicationEvents=c.complicationEvents.slice(-150);
}
export function applyPregnancyPlotEvent(event,{manual=false,silent=false,sourcePosition=null}={}){
 if(!event||!['user','char'].includes(event.who)||!isTracked(event.who))return false;
 const c=carrier(event.who),s=getSettings(),k=event.kind,def=CONDITIONS[event.code];
 if(!c.isPregnant||!['warning','care','ongoing','resolved','loss','partial','termination','stillbirth'].includes(k))return false;
 if(!['loss','partial','termination','stillbirth'].includes(k)&&!def)return false;
 if(k==='partial'&&(!Number.isInteger(event.index)||event.index<1||event.index>(c.fetusCount||1)||c.fetusCount<2))return false;
 const comp=def?active(c,event.code):null;
 if(k==='warning'&&comp)return false;
 // A corrected false warning must not reappear when old messages are rescanned.
 // The cutoff is this chat's message count at the time of manual correction:
 // later genuine diagnoses remain eligible.
 if(k==='warning'&&!manual&&Number.isSafeInteger(sourcePosition) && sourcePosition>0 &&
    (c.dismissedPregnancyWarnings||[]).some(item=>item.code===event.code &&
      Number.isSafeInteger(item.throughPosition) && sourcePosition<=item.throughPosition))
   return false;
 if(['care','ongoing','resolved'].includes(k)&&!comp)return false;
 if(manual)createUndoCheckpoint('Pregnancy '+k);
 if(k==='warning'){
   c.complications||=[];
   c.complications.push({code:event.code,type:def.label,severity:def.severity,
     week:c.pregnancyWeeks||0,rpDate:date(),resolved:false,status:'warning',care:[],
     origin:manual?'manual':'rp', sourcePosition:manual?null:(Number.isSafeInteger(sourcePosition)?sourcePosition:null)});
   log(c,{kind:k,code:event.code,origin:manual?'manual':'rp',
     sourcePosition:manual?null:(Number.isSafeInteger(sourcePosition)?sourcePosition:null)});
   notify(event.who,def.label+' — warning only; pregnancy continues',k,silent);
 }else if(['care','ongoing','resolved'].includes(k)){
   comp.care||=[];comp.care.push({kind:k,rpDate:date()});
   if(k==='resolved')comp.resolved=true;
   comp.status=k==='care'?'under care':k==='ongoing'?'monitoring':'resolved';
   log(c,{kind:k,code:event.code});
   notify(event.who,def.label+' — '+(k==='resolved'?'resolved':k==='care'?'medical care recorded':'monitoring continues'),k,silent);
 }else{
   const before=c.fetusCount||1,partial=k==='partial';
    const lossType=k==='termination'?'abortion':k==='stillbirth'?'stillbirth':'miscarriage';
   c.lossHistory||=[];
   const alreadyRecorded=c.lossHistory.some(item=>item.type===lossType &&
     item.rpDate===date() && item.conceptionDate===c.conceptionDate &&
     item.fetusIndex===(partial?event.index:null));
   if(!alreadyRecorded)c.lossHistory.push({type:lossType,who:event.who,rpDate:date(),weeks:c.pregnancyWeeks||0,
     conceptionDate:c.conceptionDate||null,fetusCount:partial?1:before,
     remaining:partial?before-1:0,fetusIndex:partial?event.index:null,
     secondParent:c.fatherName||null,manual});
   log(c,{kind:'loss',fetusCount:partial?1:before,fetusIndex:partial?event.index:null});
   if(partial){
     c.fetusCount=before-1;
     if(Array.isArray(c.fetusSex))c.fetusSex.splice(event.index-1,1);
     if(Array.isArray(c.fetusGenetics))c.fetusGenetics.splice(event.index-1,1);
     notify(event.who,'One fetus lost; remaining pregnancy continues','loss',silent);
   }else{
     c.isPregnant=false;c.conceptionDate=null;c.pregnancyWeeks=0;c.fetusCount=0;
     c.fetusSex=[];c.fetusGenetics=[];c.fetusSexRevealed=false;
     c.complications=[];c._plannedComplications=[];c.healthStatus='normal';c._dynamic={};
     c._conceptionAnchored=false;c.pregnancyKnown=false;c.lastTestResult=null;c.testTakenAt=null;
     c.lossRecovery={startRpDate:date(),bleeding:'unknown',cycleResumed:false};
     if(manual)c._userSetWeeksAt=Date.now();
     // Do NOT create babies, remove existing children, or fabricate childbirth postpartum.
     notify(event.who,'Confirmed '+lossType+'; recovery tracking started','loss',silent);
     if(!s._historyScanInProgress){
       try{
         const n=SillyTavern.getContext()?.chat?.length||0,suf=event.who==='char'?'Char':'User';
         s['_birthBlockedUntil'+suf]=n+10;
         s['_conceptionBlockedUntil'+suf]=n+6;
       }catch{}
     }
   }
 }
 recalc(c);saveSettingsDebounced();
 return true;
}
export function recordManualPregnancyEvent(event){return applyPregnancyPlotEvent(event,{manual:true});}
export function setLossRecoveryBleeding(who,value){
 if(!['user','char'].includes(who)||!isTracked(who)||!['unknown','ongoing','stopped'].includes(value))return false;
 const c=carrier(who);
 if(!c.lossRecovery||c.isPregnant||c.lossRecovery.bleeding===value)return false;
 createUndoCheckpoint('Pregnancy-loss recovery bleeding');
 c.lossRecovery.bleeding=value;
 saveSettingsDebounced();
 return true;
}
export function resumeLossRecovery(who){
 if(!['user','char'].includes(who)||!isTracked(who))return false;
 const c=carrier(who);
 if(!c.lossRecovery||c.lossRecovery.cycleResumed||c.isPregnant)return false;
 createUndoCheckpoint('Cycle return after pregnancy loss');
 c.lossRecovery.cycleResumed=true;saveSettingsDebounced();
 notify(who,'Cycle return confirmed after pregnancy loss','resolved',false);
 return true;
}


/**
 * Erase an incorrectly recorded complication, not a real condition's resolution.
 * Does not affect pregnancy dating, parentage, fetal state, or loss records.
 */
export function removeIncorrectPregnancyComplication(who,index){
 if(!['user','char'].includes(who)||!isTracked(who)||!Number.isSafeInteger(index)||index<0)return false;
 const c=carrier(who);
 if(!c.isPregnant||!Array.isArray(c.complications))return false;
 const target=c.complications[index];
 if(!target||target.resolved)return false;
 createUndoCheckpoint('Remove incorrect pregnancy complication');
 const code=target.code || Object.entries(CONDITIONS).find(([,def])=>
   String(def.label).toLowerCase()===String(target.type||'').toLowerCase())?.[0] || null;
 const chatLength=(() => {try{
   return SillyTavern.getContext()?.chat?.length || 0;
 }catch{return 0;}})();
 if(code && Number.isSafeInteger(chatLength) && chatLength>0){
   c.dismissedPregnancyWarnings ||= [];
   // Keep the exclusion limited to already existing RP messages. A new,
   // genuinely confirmed diagnosis in a later message can be accepted.
   const found=c.dismissedPregnancyWarnings.find(item=>item.code===code);
   if(found) found.throughPosition=Math.max(found.throughPosition||0,chatLength);
   else c.dismissedPregnancyWarnings.push({code,throughPosition:chatLength});
   c.dismissedPregnancyWarnings=c.dismissedPregnancyWarnings.slice(-30);
 }
 c.complications.splice(index,1);
 log(c,{kind:'invalidated-warning',code,origin:'manual-correction',
   sourcePosition:target.sourcePosition??null});
 recalc(c);
 saveSettingsDebounced();
 return true;
}
