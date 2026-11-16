// Recognizes completed menstrual hygiene changes; no tracker state is modified here.
const PRODUCTS = [
 ['belt', /\b(?:sanitary belt|menstrual belt|period belt)\b/i],
 ['cloth', /\b(?:reusable (?:menstrual )?cloth|menstrual cloth|cloth pads?|cloth menstrual pads?)\b/i],
 ['sponge', /\b(?:menstrual sponge|period sponge|sponge (?:for|during) (?:her |the )?(?:period|menstruation))\b/i],
 ['tampon', /\btampons?\b/i],
 ['cup', /\b(?:menstrual cups?|period cups?)\b/i],
 ['pad', /\b(?:sanitary pads?|menstrual pads?|period pads?|panty liners?|pads?)\b/i],
];
const PLANNED = /\b(?:will|would|could|might|may|should|must|need(?:s|ed)? to|want(?:s|ed)? to|intend(?:s|ed)? to|plan(?:s|ned)? to|planning|going to|about to|hop(?:e|ed|es) to|trying to|tried to|consider(?:s|ed|ing)?|discuss(?:ed|ing|es)?|ask(?:s|ed)? about|remind(?:s|ed)?|suggest(?:s|ed)?|refus(?:e|ed|es)|thought about|thinking about|imagined|remember(?:s|ed)?|used to|if she|if he|if they|tomorrow|later on)\b/i;
const NEGATED = /\b(?:never|not|didn.t|did not|doesn.t|does not|hadn.t|hasn.t|wasn.t|weren.t|couldn.t|without changing|without replacing|instead of changing)\b/i;
const COMPLETED = /\b(?:chang(?:e|es|ed)|replac(?:e|es|ed)|swapp?(?:ed|s)?|switch(?:ed|es)?|put(?:s)? on|put(?:s)? in|insert(?:s|ed)?|reinsert(?:s|ed)?|slipp?(?:ed|s)? on|fitt?(?:ed|s)?|empt(?:y|ied|ies)|rins(?:e|ed|es)|wash(?:ed|es)|remov(?:e|ed|es)|took off|takes off|pull(?:s|ed)? out)\b/i;
const REPLACED = /\b(?:chang(?:e|es|ed)|replac(?:e|es|ed)|swapp?(?:ed|s)?|switch(?:ed|es)?)\b/i;
const APPLIED = /\b(?:put(?:s)? on|put(?:s)? in|insert(?:s|ed)?|reinsert(?:s|ed)?|slipp?(?:ed|s)? on|fitt?(?:ed|s)?|us(?:e|es|ed)|wear(?:s)?|wore)\b/i;
const TAKEN_OFF = /\b(?:remov(?:e|ed|es)|took off|takes off|pulled out|pulls out|took out|takes out)\b/i;
const WENT_WITHOUT = /\b(?:went without|go(?:es)? without|did not replace|didn.t replace|left (?:it )?off|no (?:longer|more) (?:pad|tampon|cup|protection)|stopp?(?:ed|s)? wearing)\b/i;
const OTHER_PAD = /\b(?:mouse pad|desk pad|ink pad|sketch pad|writing pad|notepad|knee pad|elbow pad|shoulder pad|helmet pad|furniture pad|chair pad|phone pad|paper pad)\b/i;
const LOCATION = /\b(?:on (?:the|a) (?:bed|table|chair|desk|floor)|in (?:the|a) (?:box|drawer|bag|bin))\b/i;

function nameRegex(name) {
 const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
 if (!parts.length) return null;
 const variants = [parts.join(' ')];
 if (parts[0].length >= 3) variants.push(parts[0]);
 const escape = value => value.replace(/[.*+?^\x24{}()|[\]\\]/g, '\\$&');
 return new RegExp('\\b(?:' + [...new Set(variants)].map(escape).join('|') + ')\\b', 'i');
}
function ownerOf(line, options) {
 const userName = nameRegex(options.userName), charName = nameRegex(options.charName);
 const u = !!userName?.test(line) || /\{\{user\}\}/i.test(line) ||
     /\b(?:I (?:changed|replace|put|inserted|emptied|swapped)|my (?:pad|tampon|menstrual cup|period))\b/i.test(line);
 const c = !!charName?.test(line) || /\{\{char\}\}/i.test(line);
 if (u && c) return null;
 if (u) return 'user';
 if (c) return 'char';
 return options.trackFor === 'both' ? null : options.trackFor === 'char' ? 'char' : 'user';
}
function completed(line, options, forcedWho = null) {
 if (!line || PLANNED.test(line) || NEGATED.test(line) || !COMPLETED.test(line)) return null;
 const product = PRODUCTS.find(([, re]) => re.test(line));
 if (!product || (product[0] === 'pad' && OTHER_PAD.test(line))) return null;
 const inferred = ownerOf(line, options);
 // A model tag cannot redirect a named user's completed action to another character.
 if (forcedWho && inferred && inferred !== forcedWho) return null;
 const type = product[0], who = forcedWho || inferred;
 if (!who || (options.trackFor !== 'both' && options.trackFor !== who)) return null;
 if (LOCATION.test(line) && !/\b(?:her|his|my|their|own|herself|himself)\b/i.test(line)) return null;
 if (TAKEN_OFF.test(line) && WENT_WITHOUT.test(line)) return { who, type:'none', action:'remove' };
 const replacement = REPLACED.test(line);
 const emptied = type === 'cup' && /\b(?:empt(?:y|ied|ies)|rins(?:e|ed|es)|wash(?:ed|es))\b/i.test(line);
 const application = APPLIED.test(line) && (
    /\b(?:fresh|clean|new|another|replacement|sanitary|menstrual|period|panty liner)\b/i.test(line) ||
    /\b(?:her|my|his|their|own)\s+(?:pads?|tampon|menstrual cup)\b/i.test(line) ||
    type === 'tampon');
 return replacement || emptied || application ? {who, type, action:'change'} : null;
}
export function parseHygieneEvents(input, options = {}) {
 const raw = String(input || ''), tags = [];
 for (const match of raw.matchAll(/<!--\s*\[HYGIENE_EVENT\s*:\s*(\{[\s\S]*?\})\s*\]\s*-->/gi)) {
   try {
     const t = JSON.parse(match[1]);
     if (['user','char'].includes(t.who) &&
         (t.action === 'remove' ? t.type === 'none' : t.action === 'change' && PRODUCTS.some(([type]) => type === t.type))) tags.push(t);
   } catch { /* ignore malformed tag */ }
 }
 const scene = raw.replace(/<(think|thinking|reasoning|analysis)[^>]*>[\s\S]*?<\/\1>/gi, '')
   .replace(/<!--[\s\S]*?-->/g, '')
   .replace(/\[[^\]]*OOC[^\]]*\]/gi, '')
   .replace(/\b(?:OOC:|out of character:)[^\n]*/gi, '');
 const found = [];
 for (const line of scene.split(/[.!?;\n]+/).map(x => x.trim()).filter(Boolean)) {
   let event = null;
   for (const tag of tags) {
     const candidate = completed(line, options, tag.who);
     if (candidate && candidate.type === tag.type && candidate.action === tag.action) {
       event = candidate; break;
     }
   }
   if (!event) event = completed(line, options);
   if (event) found.push(event);
 }
 return [...new Map(found.map(event => [event.who, event])).values()];
}
