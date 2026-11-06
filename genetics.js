// Fictional RP inheritance: species-agnostic, not a medical genetics predictor.
// No species database and no assumptions about real-world Mendelian inheritance.
export const PROFILE_FIELDS = ['species','hair','eyes','skin','face','height','traits','abilities'];
const LIMITS = {species:90,hair:150,eyes:150,skin:150,face:240,height:80,traits:350,abilities:350};
const safe = (v, max) => typeof v === 'string' ? v.trim().slice(0,max).replace(/[<>]/g,'') : '';
export function normalizeParentProfile(data={}) {
    const result={};
    for(const field of PROFILE_FIELDS) result[field]=safe(data?.[field],LIMITS[field]);
    return result;
}
export function parseParentDescription(description, seed={}) {
    // Deliberately conservative. Explicitly labeled attributes only; ambiguous prose
    // must be edited manually instead of fabricating canon traits or species.
    const profile=normalizeParentProfile(seed), lines=String(description||'').split(/\n|;|\r/g);
    const labels={species:/^(?:species|race|ancestry)\s*:\s*(.+)$/i,
        hair:/^(?:hair|hair color|hair colour)\s*:\s*(.+)$/i,
        eyes:/^(?:eyes|eye color|eye colour)\s*:\s*(.+)$/i,
        skin:/^(?:skin|skin tone|complexion)\s*:\s*(.+)$/i,
        face:/^(?:face|facial features|features)\s*:\s*(.+)$/i,
        height:/^(?:height|adult height)\s*:\s*(.+)$/i,
        traits:/^(?:traits|supernatural traits|physical traits)\s*:\s*(.+)$/i,
        abilities:/^(?:abilities|powers|supernatural abilities)\s*:\s*(.+)$/i};
    for(const line of lines){
        const trimmed=line.trim().replace(/^[-*]\s*/,'');
        for(const [field,re] of Object.entries(labels)){
            const match=trimmed.match(re);if(match)profile[field]=safe(match[1],LIMITS[field]);
        }
    }
    // Conservative English prose detection. Unknown details remain unknown.
    const text=String(description||'').slice(0,16000);
    const sentence=text.replace(/\s+/g,' ');
    const patterns={
        hair:[/\b(?:has|with|wears)\s+([\w -]{2,65}?)\s+hair\b/i, /\bhair\s+(?:is|was|of)\s+([\w -]{2,55})(?=[,.]|$)/i],
        eyes:[/\b(?:has|with)\s+([\w -]{2,55}?)\s+eyes\b/i, /\beyes\s+(?:are|were|of)\s+([\w -]{2,55})(?=[,.]|$)/i],
        skin:[/\b(?:has|with)\s+([\w -]{2,70}?)\s+skin\b/i, /\bskin\s+(?:is|was)\s+([\w -]{2,70})(?=[,.]|$)/i],
        height:[/\b(?:height|stands at|is)\s+(\d{2,3})\s*cm\b/i],
    };
    for(const [field,list] of Object.entries(patterns)){
        if(profile[field])continue;
        for(const re of list){const match=sentence.match(re);if(match){profile[field]=safe(match[1],LIMITS[field]);break;}}
    }
    return profile;
}
const parts = (value) => String(value||'').split(/[,;\n]/g).map(x=>x.trim()).filter(Boolean);
const pick = (a,b,rnd) => {
    if(!a) return b||'';if(!b) return a;
    return a===b?a:(rnd()<0.5?a:b);
};
function mixedList(a,b,rnd,limit=4){
    const vals=[...new Set([...parts(a),...parts(b)])];
    if(!vals.length) return [];
    const chosen=[];
    for(const val of vals){ if(chosen.length<limit && rnd()<0.65)chosen.push(val); }
    if(!chosen.length)chosen.push(vals[Math.min(vals.length-1,Math.floor(rnd()*vals.length))]);
    return chosen.slice(0,limit);
}
export function defaultChildSpecies(parent1,parent2){
    const a=safe(parent1?.species,90),b=safe(parent2?.species,90);
    if(a && b) return a.toLowerCase()===b.toLowerCase()?a:`${a}–${b} hybrid`;
    return a&&b ? `${a}–${b} hybrid` : (a||b ? `${a||b} / unknown ancestry` : 'Unknown');
}
export function generateBabyGenetics(parentA={},parentB={},rnd=Math.random){
    const a=normalizeParentProfile(parentA),b=normalizeParentProfile(parentB);
    const genome={species:defaultChildSpecies(a,b),parents:{a,b},traits:[],abilities:[],appearance:[],source:'parent profiles'};
    for(const field of ['hair','eyes','skin','face']){
        const val=field==='face' && a.face && b.face ? mixedList(a.face,b.face,rnd,4).join(', ') : pick(a[field],b[field],rnd);
        genome[field]=val;
        if(val)genome.appearance.push(`${{hair:'Hair',eyes:'Eyes',skin:'Complexion',face:'Facial traits'}[field]}: ${val}`);
    }
    const h1=parseFloat(a.height),h2=parseFloat(b.height);
    genome.height=(Number.isFinite(h1)&&Number.isFinite(h2)&&h1>=60&&h2>=60&&h1<=300&&h2<=300) ?
        `${Math.round(((h1+h2)/2)*(0.95+rnd()*0.10))} cm (estimated adult height)` : '';
    genome.traits=mixedList(a.traits,b.traits,rnd);
    genome.abilities=mixedList(a.abilities,b.abilities,rnd);
    if(genome.traits.length)genome.appearance.push(`Inherited traits: ${genome.traits.join(', ')}`);
    return genome;
}
// Manual override preserves the original parent record and known canon.
export function overrideBabyGenetics(existing={},patch={}) {
    const allowed=['species','hair','eyes','skin','face','height','traits','abilities'];
    const out={...existing};
    for(const key of allowed){
        if(!Object.prototype.hasOwnProperty.call(patch,key)) continue;
        if(['traits','abilities'].includes(key))out[key]=Array.isArray(patch[key])?patch[key].map(x=>safe(x,100)).filter(Boolean).slice(0,12):parts(patch[key]).slice(0,12);
        else out[key]=safe(patch[key],LIMITS[key]||160);
    }
    return out;
}