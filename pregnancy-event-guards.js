/** Strict, fail-closed plot-event parser. Marker alone never changes pregnancy. */
export const CONDITIONS=Object.freeze({
 THREATENED_MISCARRIAGE:{label:'Threatened miscarriage',term:/\bthreatened miscarriage\b/i,severity:'critical'},
 LOW_PROGESTERONE:{label:'Low progesterone',term:/\blow progesterone\b/i,severity:'warning'},
 CERVICAL_INSUFFICIENCY:{label:'Cervical insufficiency',term:/\bcervical insufficiency\b/i,severity:'critical'},
 PLACENTA_PREVIA:{label:'Placenta previa',term:/\bplacenta previa\b/i,severity:'critical'},
 PREECLAMPSIA:{label:'Preeclampsia',term:/\bpreeclampsia\b/i,severity:'critical'},
 ANEMIA:{label:'Anemia',term:/\banemia\b/i,severity:'warning'},
 GESTATIONAL_DIABETES:{label:'Gestational diabetes',term:/\bgestational diabetes\b/i,severity:'warning'},
 OTHER:{label:'Pregnancy complication',term:/\bpregnancy complication\b/i,severity:'warning'}
});
const SPECIAL= /<!--\s*\[(ABORTION|STILLBIRTH)(?::(CHAR))?\]\s*-->/gi;
const TERMINATION=/\b(?:underwent an abortion|had an abortion|abortion was performed|completed the abortion|pregnancy was terminated|termination was completed)\b/i;
const STILLBORN=/\b(?:was stillborn|were stillborn|stillborn (?:baby|child|twin)|stillbirth (?:was|has been) confirmed|confirmed (?:the |a )?stillbirth)\b/i;
const TAG=/<!--\s*\[(?:PREG_EVENT:(USER|CHAR):(WARNING|CARE|ONGOING|RESOLVED):([A-Z_]+)|(MISCARRIAGE)(?::(CHAR))?|PREG_LOSS:(USER|CHAR):([1-4]))\]\s*-->/gi;
const UNCERTAIN=/\b(?:might|may|could|would|should|possibly|possible|risk of|fear(?:s|ed|ing)?|worri(?:es|ed)|suspect(?:s|ed)?|if|whether|hypothetical(?:ly)?|what if|dream(?:ed|t)?|nightmare|flashback|remember(?:ed|s)?|recalled|previously|years ago|last year|in the past|before this pregnancy|not|never|didn't|doesn't|hasn't|wasn't|ruled out|false alarm|scare|plan(?:ned|ning)?|discussed)\b/i;
const THIRD=/\b(?:her sister|his sister|their sister|her friend|his friend|their friend|her mother|his mother|neighbor|neighbour|other patient|another woman|someone else|aunt|stranger|coworker|another character)\b/i;
const CLINICAL=/\b(?:doctor|physician|midwife|obstetrician|ultrasound|scan|hospital|clinic|exam(?:ination)?|diagnos(?:ed|is)|medical team)\b/i;
const CONFIRMED=/\b(?:diagnos(?:ed|is)|confirmed|found|revealed|identified|determined|showed|warned|assessment|examination)\b/i;
const CARE=/\b(?:visited|went to|was admitted|admitted|attended|underwent|received|was given|prescribed|administered|treated|performed|examined|evaluated|monitored|hospitalized|hospitalised|completed|follow[- ]?up)\b/i;
const ONGOING=/\b(?:still present|still at risk|continued monitoring|ongoing|has not resolved|remains|persist(?:s|ed|ing)?|further observation|required monitoring)\b/i;
const RESOLVED=/\b(?:resolved|cleared|no longer (?:present|at risk)|fully recovered|stabili[sz]ed|improved|returned to normal|no longer a concern)\b/i;
const LOST=/\b(?:miscarried|confirmed (?:a |the )?miscarriage|miscarriage (?:was|is|has been) confirmed|diagnosed (?:a |the )?miscarriage|(?:doctor|ultrasound|scan|hospital).{0,85}(?:no fetal heartbeat|fetal demise|non[- ]?viable pregnancy|pregnancy (?:had |has )?ended)|pregnancy loss was confirmed)\b/i;
const REASSURED=/\b(?:remaining|surviving|other|second|first)\s+(?:baby|fetus|foetus|twin).{0,90}\b(?:survived|alive|healthy|heartbeat|continues|developing)\b/i;
function plain(raw){return String(raw||'').replace(/<(?:think|thinking|reasoning)>[\s\S]*?<\/(?:think|thinking|reasoning)>/gi,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\[OOC[^\]]*\]/gi,'');}
function named(c,n){const s=String(n||'').trim().toLowerCase();return s.length>=2&&c.toLowerCase().includes(s);}
function owns(c,who,o){
 if(THIRD.test(c))return false;
 const mine=named(c,who==='char'?o.charName:o.userName)||c.toLowerCase().includes(who==='char'?'{{char}}':'{{user}}');
 const other=named(c,who==='char'?o.userName:o.charName)||c.toLowerCase().includes(who==='char'?'{{user}}':'{{char}}');
 if(other)return false;
 return o.trackFor==='both'?mine:true;
}
function valid(c,kind,code){
 if(UNCERTAIN.test(c))return false;
 if(kind==='loss'||kind==='partial')return LOST.test(c);
 const cond=CONDITIONS[code];
 if(!cond?.term.test(c))return false;
 if(kind==='warning')return CLINICAL.test(c)&&CONFIRMED.test(c);
 if(kind==='care')return CLINICAL.test(c)&&CARE.test(c);
 if(kind==='ongoing')return CLINICAL.test(c)&&ONGOING.test(c);
 if(kind==='resolved')return CLINICAL.test(c)&&CONFIRMED.test(c)&&RESOLVED.test(c);
 return false;
}
export function parsePregnancyPlotEvents(raw,options={}){
 const source=String(raw||'').replace(/\x60{3}[\s\S]*?\x60{3}/g,'');
 const sentences=plain(source).split(/[\n.!?]+/).map(s=>s.trim()).filter(s=>s.length>5&&s.length<600);
 const out=[],seen=new Set(); TAG.lastIndex=0;
 for(const m of source.matchAll(TAG)){
   const kind=m[1]?m[2].toLowerCase():m[4]?'loss':'partial';
   const who=m[1]?m[1].toLowerCase():m[4]?(m[5]?'char':'user'):m[6].toLowerCase();
   const code=m[3]||null, index=kind==='partial'?Number(m[7]):null;
   if(!['user','char','both'].includes(options.trackFor)||(options.trackFor!=='both'&&who!==options.trackFor))continue;
   if(code&&!CONDITIONS[code])continue;
   const matches=sentences.filter(c=>owns(c,who,options)&&valid(c,kind,code));
   if(!matches.length)continue;
   if(kind==='partial'){
     const ordinal=['','first','second','third','fourth'][index];
     if(!matches.some(c=>new RegExp('\\b'+ordinal+'\\s+(?:baby|fetus|foetus|twin)\\b','i').test(c)))continue;
     if(!sentences.some(c=>owns(c,who,options)&&!UNCERTAIN.test(c)&&REASSURED.test(c)))continue;
   }
   const key=[who,kind,code,index].join(':');
   if(seen.has(key))continue;
   seen.add(key);out.push({who,kind,code,index});
 }
 SPECIAL.lastIndex=0;
 for(const m of source.matchAll(SPECIAL)){
   const who=m[2]?'char':'user',kind=m[1].toUpperCase()==='ABORTION'?'termination':'stillbirth';
   if(options.trackFor!=='both'&&options.trackFor!==who)continue;
   if(!['user','char','both'].includes(options.trackFor))continue;
   if(!sentences.some(c=>owns(c,who,options)&&!UNCERTAIN.test(c)&&
      (kind==='termination'?TERMINATION.test(c):STILLBORN.test(c))))continue;
   const key=[who,kind].join(':');
   if(!seen.has(key)){seen.add(key);out.push({who,kind,code:null,index:null});}
 }
 const totalOwners=new Set(out.filter(e=>['loss','termination','stillbirth'].includes(e.kind)).map(e=>e.who));
 const partialOwners=new Set(out.filter(e=>e.kind==='partial').map(e=>e.who));
 const final=out.filter(e=>!(totalOwners.has(e.who)&&partialOwners.has(e.who)));
 const counts=new Map();
 for(const e of final)if(['loss','termination','stillbirth'].includes(e.kind))
   counts.set(e.who,(counts.get(e.who)||0)+1);
 return final.filter(e=>!(['loss','termination','stillbirth'].includes(e.kind)&&counts.get(e.who)>1));
}
