import { cycleLength, bleedingDays, pregnancyLength, fertileDays, advanceCycle, hormoneCycleHint, developmentRate } from './cycle-model.js';
import { reportError } from './diagnostics.js';
import { setExtensionPrompt, extension_prompts, extension_prompt_types, extension_prompt_roles } from '../../../../script.js';
import { extensionName } from './config.js';
import { activeProtectionMethods, contraceptionStatus } from './contraception-rules.js';
import { getSettings, getPregnancyData, getPartnerData, getCycleDay, isTracked, getContraception, getContraceptionDetails } from './state.js';
import { isOmegaverse, hasMenstrualCycle, hasOvulation, hasAnyTracking, canCarry, hasCycle, designationOf, cyclePhase, heatDay, heatSettings } from './omegaverse.js';
import { pregnancyIsKnown, getPostpartum, monthsTrying, conceptionTerm, displayPregnancyWeeks, pregnancyDatingMode } from './pregnancy.js';
import { getParentProfile } from './state.js';
import { fertileWindow, conceptionStruggle } from './fertility.js';
import { getFlow, getHygieneState, realismPromptLine, hoursBetween } from './cycle-realism.js';
import { calculateWeeksFromDates, detectChatLanguage } from './helpers.js';
import { babyAgeDays, getCareNeeds } from './baby-care.js';

/*
 * LLM prompt is intentionally compact.
 * JavaScript remains authoritative for state; the model only gets the current
 * state plus the few rules needed to narrate it and emit scanner tags.
 */
function langRequirement() {
    const lang = detectChatLanguage();
    const langName = lang === 'ru' ? 'Russian' : 'English';
    return { lang, langName, line: `RP_STATUS text values must be in ${langName}. Keep values short (2–5 words).` };
}

function sexToText(arr) {
    if (!arr?.length) return '';
    return arr.map(s => s === 'M' ? 'boy' : s==='F'?'girl':'unknown').join(', ');
}

function carrierCycleLine(who, s) {
    if (!hasAnyTracking(s, who)) return '';
    if (!hasCycle(s, who)) return `${who}: no cycle tracking`;
    const c = who === 'char' ? getPartnerData() : getPregnancyData();
    const nm = who === 'char' ? '{{char}}' : '{{user}}';
    if (c.isPregnant) return pregnancyIsKnown(c, s) ? `${nm}: pregnant; cycle paused` : `${nm}: pregnancy private; cycle paused`;
    const pp = getPostpartum(c, getPregnancyData());
    if (pp && !pp.cycleReturned) return `${nm}: postpartum; cycle paused`;
    const day = who === 'char' ? (c.cycleDay || 1) : getCycleDay();
    const method = getContraception(who);
    const active = contraceptionStatus(method, getContraceptionDetails(who), getPregnancyData().rpDate).active;
    const phase = cyclePhase(s, who, day, 'en', getPregnancyData().rpDate).name;
    const label = active && ['implant','injection','pill','patch','ring'].includes(method) && /ovulation/i.test(phase)
        ? 'hormonal cycle; ovulation may be suppressed' : phase;
    return `${nm}: day ${day}/${cycleLength(s, who)} (${label})`;
}

function realismBlock(s, p) {
    if (!s.realism || p.isPregnant || !hasMenstrualCycle(s,'user')) return '';
    if (!hasMenstrualCycle(s, 'user') || !isTracked('user')) return '';
    const day = getCycleDay();
    const method = getContraception('user');
    const hint = hormoneCycleHint(method, contraceptionStatus(method, getContraceptionDetails('user'), p.rpDate));
    const flow = getFlow(day, bleedingDays(s, 'user'));
    const hy = flow.factor > 0
        ? getHygieneState(p.hygieneType || 'pad', hoursBetween(p.hygieneChangedRpDate, p.rpDate), flow)
        : null;
    let b = `[BODY] {{user}}: ${realismPromptLine(day, hy, { lang: 'en', length: cycleLength(s, 'user'), bleeding: bleedingDays(s, 'user') })}. Let it affect the scene naturally, not dominate it. Only visible/told signs are known to others.`;
    if (hint) b += ` ${hint}`;
    if (hy && (hy.overdue || hy.type.id === 'none')) b += ' If relevant, handle hygiene plainly.';
    b += ' If this reply contains a genuine cycle disruptor (severe stress, illness, starvation, travel, overtraining), add cycle_event to RP_STATUS; otherwise omit it.\n';
    return b;
}

function cycleScenePrompt(s) {
    let b = '';
    for (const who of ['user', 'char']) {
        if (!isTracked(who) || !hasCycle(s, who)) continue;
        const c = who === 'char' ? getPartnerData() : getPregnancyData();
        const pp = getPostpartum(c, getPregnancyData());
        if (c.isPregnant || (pp && !pp.cycleReturned)) continue;
        const d = who === 'char' ? c.cycleDay || 1 : getCycleDay();
        if (d <= bleedingDays(s, who) && hasMenstrualCycle(s,who)) {
            b += `${who}: menstruating. Reflect only scene-supported blood, hygiene, or discomfort; never force actions.\n`;
        }
        if (heatDay(s,who,d,getPregnancyData().rpDate)?.active) {
            b += `${who}: ${designationOf(s, who) === 'alpha' ? 'rut' : 'heat'}; use only scene-supported signs, never forced actions.\n`;
        }
    }
    return b;
}

function pregnancyBlock(who, s, p) {
    const c = who === 'char' ? getPartnerData() : p;
    if (!isTracked(who) || !c.isPregnant) return '';
    const known = pregnancyIsKnown(c, s);
    const nm = who === 'char' ? '{{char}}' : '{{user}}';
    const suffix = who === 'char' ? ':CHAR' : '';
    const duration = conceptionTerm(s,who,c);
    const { weeks } = calculateWeeksFromDates(c.conceptionDate, p.rpDate, c.pregnancyWeeks);
    const pct = Math.round(weeks / duration * 100);
    let b = `[PREGNANCY] ${who}=${known ? nm : 'private'}; ${displayPregnancyWeeks(c,s)}/${pregnancyLength(s,who)} weeks (${pregnancyDatingMode(c,s)==='obstetric'?'gestational':'since conception'}); fetuses=${c.fetusCount || 1}; sex=${c.fetusSexRevealed ? sexToText(c.fetusSex) : 'unknown'}; health=${c.healthStatus || 'normal'}; cycle paused.\n`;
    if (c.fatherName) b += `parent=${JSON.stringify(c.fatherName)}.\n`;
    if (!known) b += 'Pregnancy facts are private simulation data until the scene establishes discovery.\n';
    b += 'Do not invent multiples, delivery, fetal traits, or discoveries. Due date alone is not birth.\n';
    if (duration !== 40) b += `Development scale=${pct}% of configured term.\n`;
    if (c.complications?.length) b += `Complications=${c.complications.filter(x => !x.resolved).map(x => x.type).join(', ')}.\n`;
    b += `Completed delivery only: <!-- [BIRTH${suffix}] --> and <!-- [BABY_TRAITS:{"babies":[{"name":"","fatherName":"","personality":[],"appearance":[]}]}] -->.\n`;
    b += 'Use pregnancy status fields only when relevant: libido, weight_gain, baby_activity, movements, swelling, braxton_hicks, fetal_position, recommendations.\n';
    if (!c.fetusSexRevealed) b += `If a medical reveal occurs: <!-- [SEX_REVEAL${suffix}] -->.\n`;
    if (who === 'user') b += 'Confirmed loss/termination only: <!-- [MISCARRIAGE] --> or <!-- [ABORTION] -->; never for a scare or plan.\n';
    return b;
}

function knowledgePrompt(s) {
    let b = `Pregnancy knowledge: ${s.hiddenPregnancy === false ? 'no concealment rule' : 'do not assume discovery'}. Scene tests/disclosures override missing records.\n`;
    for (const who of ['user', 'char']) {
        const c = who === 'char' ? getPartnerData() : getPregnancyData();
        if (isTracked(who) && c.isPregnant) b += `${who}: known=${!!c.pregnancyKnown}; test=${c.lastTestResult || 'none'}. `;
    }
    return b + 'Only establish pregnancy_known/test_result from actual scene evidence.\n';
}

function tryingBlock(s, p) {
    if (!s.tryingToConceive || p.isPregnant) return '';
    const w = fertileWindow(getCycleDay(), cycleLength(s, 'user'),hasMenstrualCycle(s,'user')?bleedingDays(s,'user'):0);
    const months = monthsTrying(p);
    const struggle = conceptionStruggle(months);
    let b = `[TRYING] {{user}} and partner are trying for a baby. `;
    b += w.fertile ? `Fertile window now${w.peak ? ', peak' : ''}; she knows and may initiate.` : `Not fertile; peak in about ${w.daysToPeak} day(s).`;
    if (months > 0) b += ` Trying ${months} month(s).`;
    if (struggle) b += ` ${struggle.label}. Reflect quietly, without forcing the scene.`;
    return b + '\n';
}

function contraceptionLine(who, s, p) {
    const c = who === 'char' ? getPartnerData() : p;
    if (c.isPregnant || !canCarry(s, who)) return '';
    const suffix = who === 'char' ? ':CHAR' : '';
    const method = getContraception(who);
    const details = getContraceptionDetails(who);
    const active = activeProtectionMethods(method, details, p.rpDate).map(x => x.method);
    const status = contraceptionStatus(method, details, p.rpDate);
    const hint = hormoneCycleHint(method, status);
    const note = (status.reason ? ` Status: ${status.reason}.` : '') + (hint ? ` ${hint}` : '');
    const condoms = active.some(x => ['condom', 'internal_condom', 'historical_condom'].includes(x));
    const exposureRule = condoms
        ? 'When the condom barrier holds and semen cannot enter, do not trigger a conception check; if it breaks/slips/leaks, exposure can occur.'
        : 'Do not invent missed pills, insertion, removal, expiration, or method failure events.';
    const withdrawal = method === 'withdrawal' || details.backup === 'withdrawal';
    const triggerRule = withdrawal
        ? 'For actual penetrative sex using withdrawal, pregnancy exposure is possible from pre-ejaculate even without internal ejaculation; a conception check can be triggered once for that scene.'
        : 'Only actual internal semen exposure in this scene can trigger a conception check; exclude memories, intentions, external/oral release.';
    return `${who}: contraception=${method}; backup=${details.backup}; effective methods=${active.join('+') || 'none'}.${note} ${triggerRule} ${exposureRule} Pregnancy risk is resolved by the extension. Use <!-- [CONCEPTION_CHECK${suffix}] --> only on an eligible event.\n`;
}

function statusTemplate(s, p) {
    const fields = c => c.isPregnant && pregnancyIsKnown(c, s)
        ? { mood: '...', symptoms: '...', fetus_count: c.fetusCount || 1, fetus_size: '...', note: '...' }
        : { libido: '...', mood: '...', physical: '...', note: '...' };

    // Keep actor ownership explicit so {{user}} and {{char}} status fields
    // cannot be mistaken for one another by the model or the parser.
    const status = {};
    if (isTracked('user') && !p.hasBaby) {
        status.user = { subject: 'user', ...fields(p) };
    }
    if (isTracked('char')) {
        status.partner = { subject: 'char', ...fields(getPartnerData()) };
    }
    if (p.hasBaby) status.babies = p.babies.map((c, i) => ({
        label: c.name || `Baby${i + 1}`, mood: '...', sleep: '...', feeding: '...', diaper: '...', care_note: '...', milestone: null
    }));
    return status;
}

export function getBasePrompt() {
    const s = getSettings(), p = getPregnancyData();
    if (!s.isEnabled) return '';
    const active = ['user', 'char'].filter(isTracked);
    if (!active.length && !p.hasBaby) return '';

    const universe = isOmegaverse(s) ? 'OMEGAVERSE' : 'NORMAL';
    let b = `[REPRO TRACKER] ${universe}. Tracked=${active.join(',') || 'none'}; carriers=${active.filter(w => canCarry(s, w)).join(',') || 'none'}. State is authoritative; do not infer anatomy/carrier status.\n`;
    if (p.rpDate) b += `RP time=${new Date(p.rpDate).toLocaleString('en-GB', { hour12: false })}; advance only by elapsed scene time.\n`;
    b += 'Identity: {{user}}=player, {{char}}=bot. Keep their states separate. Do not reveal private tracker facts without scene evidence.\n';
    b += active.map(w=>`${w}: sex=${s[w==='char'?'sexChar':'sexUser']||'unspecified'}, canCarry=${canCarry(s,w)}, bleeds=${hasMenstrualCycle(s,w)}, ovulates=${hasOvulation(s,w)}`).join(' | ')+'\n';
    if (isOmegaverse(s)) b += active.map(w => {
        const cfg=heatSettings(s,w),state=w==='char'?getPartnerData():p;
        const h=heatDay(s,w,state.cycleDay||1,p.rpDate);
        return `${w}=${designationOf(s,w)}; heat/rut=${cfg.mode}, every ${cfg.frequency} days, ${cfg.duration} days, now=${h?.active?'active':'inactive'}, fertility=${cfg.fertility}`;
    }).join(' | ')+'. Heat/rut and menstruation are separate unless configured as linked.\n';
    for(const who of active){
        const profile=getParentProfile(who);
        const traits=Object.entries(profile).filter(([k,v])=>v).map(([k,v])=>`${k}:${v}`).join('; ');
        if(traits)b+=`${who} established parental traits: ${traits.slice(0,850)}.\n`;
    }
    b += active.map(w => carrierCycleLine(w, s)).join(' | ') + '\n';
    b += `[CONTRACEPTION EVENTS — all methods] Emit hidden markers only for COMPLETED events for the correct carrier. Format: <!-- [CONTRACEPTION_EVENT:{"who":"user","action":"start","method":"iud"}] -->. who=user for {{user}}, char for {{char}}.
`;
    b += `Available method IDs: condom, pill, iud, implant, injection, patch, ring, internal_condom, diaphragm, cervical_cap, spermicide, withdrawal, fertility_awareness, historical_condom, historical_sponge.
`;
    b += `For ongoing contraception use action=start when a pill regimen begins, injection is administered, patch is applied, vaginal ring is inserted, IUD or implant is placed; use stop when actually discontinued or removed. Do NOT start a method merely because an appointment is planned or the person talks about it.
`;
    b += `For ONE ENCOUNTER, use action=use for condom or internal condom, withdrawal, diaphragm, cervical cap, spermicide, historical condom, historical sponge, or fertility awareness. Example: <!-- [CONTRACEPTION_EVENT:{"who":"user","action":"use","method":"condom"}] -->. Use is scene-only and does not change permanent dropdown settings. When these methods are adopted as an ongoing choice, action=start is permitted; action=add marks a regularly selected second barrier.
`;
    b += `Missed active combined pill: miss_one or miss_multiple. Confirmed adherence resumed: resume_pills. Explicit implant expiry: expire_implant. An implant insertion can include expires=YYYY-MM-DD if known. Never invent doses or contraceptive events. Never emit for planning, speculation, OOC tests, memories or flashbacks. Emit a marker at most once per actually completed event; multiple separate completed actions can have separate markers. If an encounter spans multiple messages, include the scene-only use marker again in the message with a conception check so its protection is applied at that check.
`;


    if (active.every(w=>!hasMenstrualCycle(s,w))) b += 'No tracked character menstruates; no hygiene reminders.\n';
    b += cycleScenePrompt(s);
    b += 'Cycle days are simulation estimates; methods that suppress ovulation must not be described as confirmed ovulation.\n';
    b += realismBlock(s, p);

    {
        for (const who of active) {
            const c = who === 'char' ? getPartnerData() : p;
            const pp = getPostpartum(c, p);
            if (!hasMenstrualCycle(s,who) || c.isPregnant || c.cycleDay > bleedingDays(s, who) || (pp && !pp.cycleReturned)) continue;
            const h = getHygieneState(c.hygieneType || 'pad', hoursBetween(c.hygieneChangedRpDate, p.rpDate), getFlow(c.cycleDay, bleedingDays(s, who)));
            if (c.hygieneType && c.hygieneType !== 'none') b += `${who}: using ${h.type.labelEn} for menstruation; use era-appropriate descriptions.\n`;
            if (h.needsChange) b += `${who}: hygiene needs changing; mention only if relevant/observable.\n`;
        }
    }

    if (active.some(w => (w === 'char' ? getPartnerData() : p).isPregnant)) {
        b += knowledgePrompt(s);
        b += 'Appearance comes only from established story/card facts; omit unknown hair/eye traits.\n';
    }
    for (const who of active) b += contraceptionLine(who, s, p);
    for (const who of active) b += pregnancyBlock(who, s, p);
    if (isTracked('user') && s.tryingToConceive && !p.isPregnant) b += tryingBlock(s, p);

    const { langName, line } = langRequirement();
    const status = statusTemplate(s, p);
    b += `End with exactly one hidden status tag. Values: ${langName}, short, current-scene only; omit unknown fields.\n`;
    b += "RP_STATUS ownership is strict: user = {{user}} only; partner = {{char}} only. Never put {{char}}'s libido, mood, physical state, symptoms, pregnancy state, or sexual state inside user. Never put {{user}}'s state inside partner.\n";
    b += 'When a pregnancy is confirmed and the biological second parent is EXPLICITLY known from the current scene, include father_name with that verified name in the correct RP_STATUS user/partner object, or in PREGNANCY_STATE.father_name. If unknown, omit father_name. Never assume {{char}} is necessarily the biological parent; donors and prior partners are possible.\n';
    b += `<!-- [RP_STATUS:${JSON.stringify(status)}] -->\n`;
    b += line + '\n';
    if (p.hasBaby) {
        b += 'Keep existing baby labels, species, sexes, and inherited traits unchanged unless a completed scene explicitly confirms new information. Milestone only for a new first achievement.\n';
        for(const baby of (p.babies||[])){
            b+=`Baby ${baby.name||'unnamed'}: sex=${baby.sex||'unknown'}, species=${baby.species||'unknown'}; fixed traits=${(baby.appearance||[]).join('; ').slice(0,350)}; abilities=${(baby.genetics?.abilities||[]).join(', ').slice(0,200)}.\n`;
        }
        if (developmentRate(s) !== 1) b += `Baby development speed: ${developmentRate(s)}x (fictional, chronological birth dates unchanged).\n`;
    }
    b += 'End with current RP time: <!-- [RP_DATE:DD.MM.YYYY HH:MM] -->. Event tags belong only in the final reply and must reflect completed/current-scene events.\n';
    return b;
}

export function getPregnancyPrompt() {
    const s = getSettings(), p = getPregnancyData();
    if (!s.isEnabled) return '';
    let b = '';
    if (p.hasBaby) b += postpartumBlock(p) + birthdayBlock(p) + compactFamily(p);
    return b;
}

function compactFamily(p) {
    let b = '[CHILDREN] Use age-appropriate behaviour and current scene needs.\n';
    for (const [i, c] of (p.babies || []).entries()) {
        const age = babyAgeDays(c, p);
        b += `${c.name || `Baby${i + 1}`}: age=${age ?? '?'}d, health=${c.health || 'normal'}, mood=${c.mood || '?'}, sleep=${c.sleep || '?'}, feeding=${c.feedingType || '?'}, diaper=${c.diaperClean === false ? 'needs changing' : 'clean'}.`;
        const needs = getCareNeeds(age, p.rpTime, c);
        b += ` Care=${[needs.feeding, needs.sleep, needs.diaper, needs.careNote].filter(Boolean).join('; ')}.\n`;
        if (c.personality?.length) b += `Personality=${c.personality.join(', ')}. `;
        if (c.appearance?.length) b += `Appearance=${c.appearance.join(', ')}. `;
        const recent = (c.milestones || []).slice(-3).map(x => x.text).filter(Boolean);
        if (recent.length) b += `Achieved=${recent.join('; ')}. `;
        b += '\n';
    }
    if (p.grownChildren?.length) b += 'Older children: ' + p.grownChildren.map(c => `${c.name || 'unnamed'} (${babyAgeDays(c, p) ?? '?'}d)`).join('; ') + '.\n';
    return b;
}

function postpartumBlock(p) {
    const pp = getPostpartum(p, p);
    if (!pp) return '';
    let b = `[POSTPARTUM] ${pp.days}d since birth; recovery=${pp.healing || 'normal'}; lochia=${pp.lochia ? 'yes' : 'no'}; breastfeeding=${pp.lactating ? 'yes' : 'no'}.\n`;
    b += pp.cycleReturned ? 'Cycle returned; conception possible.\n' : 'Cycle not returned yet.\n';
    if (pp.days < 42) b += 'Early recovery: fatigue/discomfort may matter; never force intimacy.\n';
    return b;
}

function birthdayBlock(p) {
    if (!p.rpDate || !Array.isArray(p.babies)) return '';
    const now = new Date(p.rpDate);
    if (isNaN(now.getTime())) return '';
    const lines = [];
    for (const k of [...(p.babies || []), ...(p.grownChildren || [])]) {
        if (!k.birthRpDate) continue;
        const b = new Date(k.birthRpDate);
        if (isNaN(b.getTime())) continue;
        const years = now.getFullYear() - b.getFullYear();
        if (years < 1) continue;
        const sameDay = now.getDate() === b.getDate() && now.getMonth() === b.getMonth();
        if (sameDay) lines.push(`${k.name || 'Child'} birthday today; turning ${years}.`);
        else {
            const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
            if (next < now) next.setFullYear(now.getFullYear() + 1);
            const days = Math.round((next - now) / 86400000);
            if (days > 0 && days <= 3) lines.push(`${k.name || 'Child'} birthday in ${days}d; turning ${years + (next.getFullYear() > now.getFullYear() ? 1 : 0)}.`);
        }
    }
    return lines.length ? `[BIRTHDAYS]\n${lines.join('\n')}\n` : '';
}

let legacySlotsCleared = false;
export function updatePromptInjection() {
    try {
        if (!legacySlotsCleared) {
            setExtensionPrompt(extensionName + '_sys', '', extension_prompt_types.IN_PROMPT, 0);
            setExtensionPrompt(extensionName + '_scan', '', extension_prompt_types.IN_PROMPT, 0);
            legacySlotsCleared = true;
        }
        const core = getBasePrompt() + getPregnancyPrompt();
        const installed = extension_prompts[extensionName];
        if (installed?.value === core && installed.position === extension_prompt_types.IN_CHAT && installed.depth === 0 && installed.role === extension_prompt_roles.SYSTEM) return;
        setExtensionPrompt(extensionName, core, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
    } catch (error) {
        reportError('[Reproductive] updatePromptInjection error:', error);
    }
}
