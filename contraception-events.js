// Contraception scene events. Stored in SillyTavern chatMetadata, never global settings.
// Deterministic replay means deleted, edited and swiped messages cannot leave
// obsolete contraception events active. Existing manually chosen methods form
// the starting snapshot, and later manual choices override earlier RP events.
import { reportError } from './diagnostics.js';
import { CHANCES } from './config.js';
import { getContraception, setContraception, getContraceptionDetails, setContraceptionDetails, carrierName } from './state.js';
import { normalizedDetails } from './contraception-rules.js';

const KEY = 'reproductiveSystem_contraceptionTimeline_v1';
const ACTIONS = new Set(['start', 'stop', 'add', 'remove_backup', 'miss_one', 'miss_multiple', 'resume_pills', 'expire_implant', 'use']);
const TAG_RE = /<!--\s*\[CONTRACEPTION_EVENT:\s*(\{[^\r\n]*?\})\s*\]\s*-->/gi;
const REPLACE_BY_YEARS = 5; // Gameplay default for standard contemporary implant; change the RP date manually if needed.
const methodIsValid = method => typeof method === 'string' && method !== 'none' && Object.prototype.hasOwnProperty.call(CHANCES.contraception, method);
export const SINGLE_USE_METHODS = Object.freeze(['condom','internal_condom','diaphragm','cervical_cap','spermicide','withdrawal','fertility_awareness','historical_condom','historical_sponge']);
const shortDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const [y,m,d] = value.split('-').map(Number);
    const dt = new Date(`${value}T12:00:00`);
    return dt.getFullYear() === y && dt.getMonth() + 1 === m && dt.getDate() === d ? value : '';
};
const clone = value => JSON.parse(JSON.stringify(value));

function explicitRecipient(line, isUser) {
    const found=new Set();
    if(/\{\{user\}\}/i.test(line))found.add('user');
    if(/\{\{char\}\}/i.test(line))found.add('char');
    for(const who of ['user','char']){
        const name=String(carrierName(who)||'').trim();
        if(!name || name.length<2)continue;
        const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        try { if(new RegExp('(^|\\W)'+escaped+'(?=\\W|$)','i').test(line))found.add(who); }catch(_){ }
    }
    if(found.size===1)return [...found][0];
    if(found.size>1)return null;
    // First/second person requires an actual personal subject, not a vague
    // narrator's 'she had a ring inserted' or 'the doctor gave a shot'.
    if(/\b(?:I|my|me)\b/i.test(line))return isUser?'user':'char';
    if(/\b(?:you|your)\b/i.test(line))return isUser?'char':'user';
    return null;
}
export function parseContraceptionEvents(text, isUser = false, fallbackWho = null) {
    if (typeof text !== 'string' || !text) return [];
    // OOC prompts/tests cannot change the roleplay state even if a model echoes
    // an event marker. Ignore markers inside hidden model reasoning as well.
    if (/^\s*(?:\(?\s*OOC\b|\[OOC\b|\/\/?\s*OOC\b)/i.test(text)) return [];
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    const events = [];
    let m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(text)) !== null && events.length < 8) {
        try {
            const raw = JSON.parse(m[1]);
            const who = raw?.who === 'char' ? 'char' : raw?.who === 'user' ? 'user' : null;
            const action = raw?.action;
            if (!who || !ACTIONS.has(action)) continue;
            if (['start', 'stop', 'add', 'use'].includes(action) && !methodIsValid(raw.method)) continue;
            if (['add','use'].includes(action) && !SINGLE_USE_METHODS.includes(raw.method)) continue;
            events.push({ who, action, method: methodIsValid(raw.method) ? raw.method : null, expires: shortDate(raw.expires) });
        } catch (_) { /* reject malformed markup instead of guessing */ }
    }
    // A conservative fallback for clear, completed actions. Role-tagged events
    // take priority. For a scene with two tracked carriers, require an explicit
    // who in the marker instead of guessing whose contraception changed.
    if (!events.length && (isUser || ['user','char'].includes(fallbackWho)) &&
        !/^\s*(?:\(?\s*OOC\b|\[OOC\b|\/\/?\s*OOC\b)/i.test(text)) {
        const narrative = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<think>[\s\S]*?<\/think>/gi, '')
            .replace(/\[[^\]]*OOC[^\]]*\]/gi,'')
            .split(/[.!?\n]+/).map(part => part.trim()).filter(Boolean);
        const methods = [
            ['internal_condom', /\b(?:internal|female) condoms?\b/i],
            ['historical_condom', /\b(?:animal[- ]?(?:gut|membrane|intestine)|sheep(?:skin|[- ]?gut)|linen) condoms?\b|\bhistorical condoms?\b/i],
            ['condom', /\b(?:external|male|latex|rubber) condoms?\b|\bcondoms?\b/i],
            ['iud', /\b(?:IUD|intrauterine device|copper coil|hormonal coil)\b/i],
            ['implant', /\b(?:Nexplanon|Implanon|contraceptive implant|birth[- ]?control implant)\b/i],
            ['injection', /\b(?:Depo[- ]?Provera|contraceptive (?:shot|injection)|birth[- ]?control (?:shot|injection)|depo shot)\b/i],
            ['patch', /\b(?:contraceptive patch|birth[- ]?control patch|hormonal patch)\b/i],
            ['ring', /\b(?:vaginal ring|contraceptive ring|NuvaRing|Annovera)\b/i],
            ['pill', /\b(?:birth[- ]?control pills?|contraceptive pills?|oral contraceptives?|the pill)\b/i],
            ['diaphragm', /\bdiaphragm\b/i],
            ['cervical_cap', /\bcervical cap\b/i],
            ['spermicide', /\b(?:spermicide|spermicidal (?:gel|cream|foam|film|suppository))\b/i],
            ['historical_sponge', /\b(?:contraceptive sponge|historical sponge|vaginal sponge|sea sponge)\b/i],
            ['withdrawal', /\b(?:withdrawal method|pull[- ]?out method|pulled out|withdrew (?:before|in time)|pulling out)\b/i],
            ['fertility_awareness', /\b(?:fertility awareness|rhythm method|calendar method|safe[- ]?days method)\b/i],
        ];
        const rejected = /\b(?:will|would|may|might|could|planning|plan to|going to|appointment|scheduled|tomorrow|hope to|wants? to|asked? (?:about|for)|considering|hypothetical|what if|never|not|didn.t|hadn't|remembered|recalled|flashback|used to|read about|talked about|discussed|suggested|recommended)\b/i;
        for (const line of narrative) {
            if (rejected.test(line)) continue;
            const found = methods.find(([method, pattern]) => pattern.test(line));
            if (!found) continue;
            const method = found[0];
            const owner=explicitRecipient(line,isUser);
            // If the recipient isn't explicit, never use sender or carrier mode
            // as a guess: the narrator may describe a different character.
            if(!owner)continue;
            const push = (action) => events.push({ who:owner, action, method, expires:'' });
            if (method === 'pill') {
                if (/\b(?:missed|forgot|skipped)\b/i.test(line) && /\b(?:two|three|four|multiple|several|[2-9])\b/i.test(line)) push('miss_multiple');
                else if (/\b(?:missed|forgot|skipped)\b/i.test(line) && /\b(?:one|a|single|1)\b/i.test(line)) push('miss_one');
                else if (/\b(?:resumed|returned to|back on)\b/i.test(line) && /\b(?:regular|daily|consistently|schedule|routine|taking)\b/i.test(line)) push('resume_pills');
                else if (/\b(?:started taking|began taking|went on|started using)\b/i.test(line)) push('start');
                else if (/\b(?:stopped taking|quit taking|discontinued|went off)\b/i.test(line)) push('stop');
            } else if (['iud','implant'].includes(method)) {
                if (/\b(?:inserted|implanted|fitted|placed|put in|installed)\b/i.test(line)) push('start');
                else if (/\b(?:removed|taken out|extracted|had .* removed)\b/i.test(line)) push('stop');
            } else if (method === 'injection') {
                if (/\b(?:received|administered|given|gave|got|injected)\b/i.test(line)) push('start');
                else if (/\b(?:stopped|discontinued|quit)\b/i.test(line)) push('stop');
            } else if (method === 'patch') {
                if (/\b(?:applied|put on|stuck on|started using|began using)\b/i.test(line)) push('start');
                else if (/\b(?:peeled off|removed|took off|stopped using|discontinued)\b/i.test(line)) push('stop');
            } else if (method === 'ring') {
                if (/\b(?:inserted|placed|put in|started using)\b/i.test(line)) push('start');
                else if (/\b(?:removed|pulled out|took out|stopped using|discontinued)\b/i.test(line)) push('stop');
            } else if (SINGLE_USE_METHODS.includes(method)) {
                // A specific encounter action does not become permanent contraception.
                if (/\b(?:put on|rolled on|slipped on|wore|used|inserted|placed|applied|pulled out|withdrew|pulling out|avoided fertile days|followed the calendar method)\b/i.test(line)) push('use');
                else if (/\b(?:started using|began relying on|adopted)\b/i.test(line)) push('start');
                else if (/\b(?:stopped using|discontinued|abandoned)\b/i.test(line)) push('stop');
            }
            if (events.length) break; // Do not infer multiple actions from ambiguous prose.
        }
    }
    return events;
}

function extractSceneDate(text) {
    // Only a date in the message itself; otherwise leave insertion expiry unset.
    const m = text.match(/<!--\s*\[RP_DATE:\s*(\d{2})\.(\d{2})\.(\d{4})\b/i);
    if (!m) return '';
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(`${iso}T12:00:00`);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === +m[3] && d.getMonth() + 1 === +m[2] && d.getDate() === +m[1] ? iso : '';
}
function addScheduleDays(date, days) {
    if (!date) return '';
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addImplantYears(date) {
    if (!date) return '';
    const d = new Date(`${date}T12:00:00`);
    d.setFullYear(d.getFullYear() + REPLACE_BY_YEARS);
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
export function applyContraceptionEvent(state, event, sceneDate = '') {
    const next = { method: state.method, details: normalizedDetails(state.details) };
    const d = next.details;
    const method = event.method;
    if (event.action === 'start') {
        next.method = method;
        if (method === 'implant') {
            d.implantStatus = 'active';
            d.implantExpires = event.expires || addImplantYears(sceneDate);
        }
        if (['injection','patch','ring'].includes(method)) {
            d.methodDue = event.expires || addScheduleDays(sceneDate, { injection: 91, patch: 7, ring: 21 }[method]);
        } else d.methodDue = '';
        if (method === 'pill') {
            d.missedPills = 'normal';
            d.pillLastConfirmed = sceneDate || '';
        }
        if (d.backup === method) d.backup = 'none';
    } else if (event.action === 'stop') {
        if (next.method === method) {
            next.method = 'none';
            if (method === 'implant') d.implantStatus = 'removed';
            d.methodDue = '';
            if (method === 'pill') d.pillLastConfirmed = '';
        } else if (d.backup === method) d.backup = 'none';
    } else if (event.action === 'add') {
        if (next.method === 'none') next.method = method;
        else if (next.method !== method) {
            const ext = ['condom', 'historical_condom'];
            if ((ext.includes(next.method) && method === 'internal_condom') || (next.method === 'internal_condom' && ext.includes(method))) return next;
            d.backup = method;
        }
    } else if (event.action === 'remove_backup') d.backup = 'none';
    else if (event.action === 'miss_one' && next.method === 'pill') d.missedPills = 'one';
    else if (event.action === 'miss_multiple' && next.method === 'pill') d.missedPills = 'multiple';
    else if (event.action === 'resume_pills' && next.method === 'pill') { d.missedPills = 'normal'; d.pillLastConfirmed = sceneDate || d.pillLastConfirmed; }
    else if (event.action === 'expire_implant' && next.method === 'implant') d.implantStatus = 'expired';
    return next;
}

function contextForTimeline() {
    try {
        const c = SillyTavern.getContext();
        return c?.chatMetadata && typeof c.saveMetadata === 'function' && Array.isArray(c.chat) ? c : null;
    } catch (_) { return null; }
}
function current(who) { return { method: getContraception(who), details: getContraceptionDetails(who) }; }
function persist(context) {
    try {
        const promise = context.saveMetadata();
        if (promise?.catch) promise.catch(err => reportError('[Reproductive] timeline save:', err));
    } catch (err) { reportError('[Reproductive] timeline save:', err); }
}
export function initializeContraceptionTimeline() {
    const context = contextForTimeline();
    if (!context) return false;
    if (context.chatMetadata[KEY]) return true;
    context.chatMetadata[KEY] = {
        startIndex: context.chat.length,
        initial: { user: current('user'), char: current('char') },
        manual: [],
        lastEvent: '',
    };
    persist(context);
    return true;
}
export function recordManualContraception(who) {
    const context = contextForTimeline();
    if (!context) return;
    initializeContraceptionTimeline();
    const ledger = context.chatMetadata[KEY];
    if (!ledger || !Array.isArray(ledger.manual)) return;
    const field = who === 'char' ? 'char' : 'user';
    ledger.manual.push({ at: context.chat.length - 0.25, who: field, state: current(field) });
    persist(context);
}
export function getLastContraceptionEvent() {
    return contextForTimeline()?.chatMetadata?.[KEY]?.lastEvent || '';
}
export function reconcileContraceptionTimeline() {
    const context = contextForTimeline();
    if (!context) return false;
    // Initialization intentionally does not scan the old transcript. Never
    // reinterpret past RP as a new method when upgrading the extension.
    if (!context.chatMetadata[KEY]) { initializeContraceptionTimeline(); return false; }
    const ledger = context.chatMetadata[KEY];
    if (!ledger.initial || !Number.isSafeInteger(ledger.startIndex)) return false;
    const state = { user: clone(ledger.initial.user), char: clone(ledger.initial.char) };
    const actions = [];
    for (const entry of ledger.manual || []) {
        if (entry && ['user','char'].includes(entry.who) && Number.isFinite(entry.at) && entry.state) {
            actions.push({ at: entry.at, rank: 1, who: entry.who, state: entry.state, manual: true });
        }
    }
    for (let i = Math.max(0, ledger.startIndex); i < context.chat.length; i++) {
        const msg = context.chat[i];
        const text = typeof msg?.mes === 'string' ? msg.mes : '';
        if (!text) continue;
        const roleMode = context.chatMetadata?.reproductiveSystem_chatOptions_v1?.carrierMode || 'user';
        const fallbackWho = roleMode === 'user' || roleMode === 'char' ? roleMode : null;
        const events = parseContraceptionEvents(text, !!msg.is_user, fallbackWho);
        const sceneDate = extractSceneDate(text);
        for (const [j,event] of events.entries()) {
            if (event.action === 'use') continue; // encounter-only; never replay into persistent contraception
            actions.push({ at: i, rank: j / 20, event, sceneDate });
        }
    }
    actions.sort((a,b) => a.at - b.at || a.rank - b.rank);
    let lastEvent = '';
    for (const item of actions) {
        if (item.manual) {
            state[item.who] = { method:item.state.method, details:normalizedDetails(item.state.details) };
        } else {
            const who = item.event.who;
            const before = JSON.stringify(state[who]);
            state[who] = applyContraceptionEvent(state[who], item.event, item.sceneDate);
            if (JSON.stringify(state[who]) !== before) lastEvent = `${who}: ${item.event.action.replaceAll('_',' ')} ${item.event.method || ''}`.trim();
        }
    }
    let changed = false;
    for (const who of ['user','char']) {
        const target = state[who];
        if (getContraception(who) !== target.method) {
            setContraception(who, target.method);
            changed = true;
        }
        const normalized = normalizedDetails(target.details);
        if (JSON.stringify(getContraceptionDetails(who)) !== JSON.stringify(normalized)) {
            setContraceptionDetails(who, normalized);
            changed = true;
        }
    }
    if (ledger.lastEvent !== lastEvent) { ledger.lastEvent = lastEvent; persist(context); changed = true; }
    return changed;
}
