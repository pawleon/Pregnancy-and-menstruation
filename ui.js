import { cycleLength, bleedingDays, pregnancyLength, fertileDays, advanceCycle, hormoneCycleHint, developmentRate } from './cycle-model.js';
import { setManualCycleDay, setManualPregnancyWeeks, setSecondParent } from './message-handler.js';
import { reportError } from './diagnostics.js';
function cycleSummary(who, c, s) {
    if (!hasCycle(s, who) && !c.isPregnant) return isOmegaverse(s) ? roleLabel(s, who) : 'Status';
    if (c.isPregnant && pregnancyIsKnown(c, s)) return `Pregnancy — ${displayPregnancyWeeks(c,s)} weeks`;
    const pp = getPostpartum(c, getPregnancyData());
    if (pp && !pp.cycleReturned) return 'Cycle paused — postpartum';
    const day = (who === 'char' ? (c.cycleDay || 1) : getCycleDay()) + (c.isPregnant ? daysSinceConception(c, getPregnancyData()) : 0);
    const length = cycleLength(s, who);
    if (day > length) return `Delay ${day - length} days`;
    if (c.isPregnant) return `Day ${day}/${length} · scene-based status`;
    const h=heatDay(s,who,day,getPregnancyData().rpDate);
    if (h && heatSettings(s,who).mode==='independent'){
        const phase=h.unanchored?'Heat/rut waiting for RP date':`${h.type==='rut'?'Rut':'Heat'} ${h.day}/${h.length}${h.active?` (active ${h.day}/${h.end})`:' (between)'}`;
        return (hasMenstrualCycle(s,who)||hasOvulation(s,who))?`Cycle ${day}/${length} · ${phase}`:phase;
    }
    return `Day ${day}/${length} · ${getPhaseInfo(day, 'en', who).name}`;
}
function getPhaseInfo(day, lang = 'en', who = 'user') {
    const phase = cyclePhase(getSettings(), who, day, lang, getPregnancyData().rpDate);
    const method = getContraception(who);
    const status = contraceptionStatus(method, getContraceptionDetails(who), getPregnancyData().rpDate);
    if (['implant','injection','pill','patch','ring'].includes(method) && status.active && /ovulation/i.test(phase.name))
        return {...phase, name:'Hormonal cycle (ovulation may be suppressed)'};
    return phase;
}
// UI v5 — compact, minimal icons, visual infoblock
import { saveSettingsDebounced } from './state.js';
import { getSettings, getPregnancyData, getPartnerData, getCarriers, carrierName, isTracked, getCycleDay, setCycleDay, getCurrentChatId, L, getContraception, setContraception, getContraceptionDetails, setContraceptionDetails, canSetContraception, canSetChatOptions, setCycleRealism, getParentProfile, setParentProfile, syncBabyLegacyFields } from './state.js';
import { isOmegaverse, hasMenstrualCycle, hasOvulation, canCarry, hasAnyTracking, hasCycle, designationOf, roleLabel, cyclePhase, heatSettings, heatDay } from './omegaverse.js';
import { missedDays, fertileWindow } from './fertility.js';
import { HYGIENE, getFlow, getHygieneState, getPhaseEffects, hoursBetween } from './cycle-realism.js';
import { getPhaseInfo as phaseInfo, calculateWeeksFromDates, getSymptomsForProgress, getRecommendationsForProgress, formatSexIcons, formatFetusCount, getHealthInfo, detectChatLanguage, translateStatusValue } from './helpers.js';
import { babyAgeDays, getCareNeeds, getGrowthStage, MILESTONE_ICONS, milestonesTotal } from './baby-care.js';
import { calculateDueDate } from './date-parser.js';
import { conceptionTerm, displayPregnancyWeeks, pregnancyDatingMode, resetPregnancy, resetBaby, undoManualDelivery, clearPostpartum, setPostpartumFeeding, resumePostpartumCycle, visitDoctor, applyScanResult, startManualPregnancy, startManualBaby, startPartnerPregnancy, resetPartnerPregnancy, takePregnancyTest, revealPregnancy, getPostpartum, pregnancyIsKnown, daysSinceConception, setLactating, setTrying, monthsTrying, createUndoCheckpoint, undoLastDestructiveChange, editBabyDetails, setFetusSexes } from './pregnancy.js';
import { normalizeParentProfile, parseParentDescription, PROFILE_FIELDS } from './genetics.js';
import { updatePromptInjection } from './prompts.js';
import { recordManualContraception, getLastContraceptionEvent } from './contraception-events.js';
import { manualContraceptionNotice } from './contraception-notices.js';
import { contraceptionStatus, activeProtectionMethods } from './contraception-rules.js';
import { showNotification } from './notifications.js';

function ic(n) { return `<i class="fa-solid ${n}"></i>`; }

// ── Default infoblock CSS (shown in editor for customization) ──
const DEFAULT_INFOBLOCK_CSS = `/* English implementation note. */
details.repro {
  margin: 0 auto 12px;
  max-width: 420px;
  font: 12px system-ui, sans-serif;
  color: rgba(255,255,255,.85);
}

/* English implementation note. */
details.repro .repro-header {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  background: transparent;
  border: 1.5px solid rgba(255,255,255,.18);
  border-radius: 14px;
  transition: border-radius .2s;
}
details.repro[open] .repro-header {
  border-radius: 14px 14px 0 0;
  border-bottom-color: transparent;
}

/* English implementation note. */
details.repro .repro-icon {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
details.repro .repro-icon i { font-size: 11px; }
details.repro .repro-icon.cycle      { border: 1.5px solid rgba(180,120,255,.4); }
details.repro .repro-icon.cycle i    { color: rgba(180,120,255,.8); }
details.repro .repro-icon.pregnancy  { border: 1.5px solid rgba(255,120,180,.4); }
details.repro .repro-icon.pregnancy i{ color: rgba(255,120,180,.8); }
details.repro .repro-icon.baby       { border: 1.5px solid rgba(130,200,255,.4); }
details.repro .repro-icon.baby i     { color: rgba(130,200,255,.8); }

/* English implementation note. */
details.repro .repro-title { font-weight: 600; font-size: 13px; }
details.repro .repro-badge {
  margin-left: auto; font-size: 10px; padding: 2px 8px;
  border-radius: 50px; font-weight: 600;
}
details.repro .repro-badge.cycle     { border: 1px solid rgba(180,120,255,.3); color: rgba(180,120,255,.9); }
details.repro .repro-badge.pregnancy { border: 1px solid rgba(255,120,180,.3); color: rgba(255,120,180,.9); }
details.repro .repro-badge.baby      { border: 1px solid rgba(130,200,255,.3); color: rgba(130,200,255,.9); }

/* English implementation note. */
details.repro .repro-chev {
  width: 16px; height: 16px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: transform .25s;
}
details.repro .repro-chev i { font-size: 10px; color: rgba(255,255,255,.3); }
details.repro[open] .repro-chev { transform: rotate(180deg); }

/* English implementation note. */
details.repro .repro-c {
  padding: 12px 16px;
  background: transparent;
  border: 1.5px solid rgba(255,255,255,.18);
  border-top: none;
  border-radius: 0 0 14px 14px;
}

/* English implementation note. */
details.repro .repro-bar {
  height: 3px; background: rgba(255,255,255,.08);
  border-radius: 50px; overflow: hidden; margin-bottom: 10px;
}
details.repro .repro-bar-fill { height: 100%; border-radius: 50px; }
details.repro .repro-bar-fill.cycle     { background: #b478ff; }
details.repro .repro-bar-fill.pregnancy { background: #ff9eb4; }
details.repro .repro-bar-fill.baby      { background: #82c8ff; }

/* English implementation note. */
details.repro .repro-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }

/* English implementation note. */
details.repro .repro-stat {
  display: flex; align-items: center; gap: 8px; padding: 7px 10px;
  background: transparent;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px;
}
details.repro .repro-wide { grid-column: 1 / -1; }

/* English implementation note. */
details.repro .rp-si {
  width: 20px; height: 20px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
details.repro .rp-si i { font-size: 10px; }
details.repro .rp-si.green  i { color: rgba(0,200,130,.7); }
details.repro .rp-si.pink   i { color: rgba(255,100,150,.7); }
details.repro .rp-si.purple i { color: rgba(180,120,255,.7); }
details.repro .rp-si.blue   i { color: rgba(130,200,255,.7); }
details.repro .rp-si.orange i { color: rgba(255,180,60,.7); }
details.repro .rp-si.red    i { color: rgba(255,80,80,.7); }

/* English implementation note. */
details.repro .rp-lbl { color: rgba(255,255,255,.35); font-size: 9px; }
details.repro .rp-val { color: rgba(255,255,255,.85); font-size: 11px; font-weight: 600; }
details.repro .rp-val-warn { color: rgba(255,170,0,.9) !important; }

/* English implementation note. */
details.repro .repro-note {
  grid-column: 1 / -1; margin-top: 6px; padding: 8px 12px;
  background: transparent;
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 10px; font-size: 10px; color: rgba(255,255,255,.5);
  line-height: 1.5; font-style: italic;
}
details.repro .repro-rec { font-style: normal; color: rgba(255,215,64,.6); }
details.repro .repro-rec i { margin-right: 4px; opacity: .7; }

/* English implementation note. */
details.repro .repro-health {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: 600;
}
details.repro .repro-health.normal   { border: 1px solid rgba(0,200,100,.3);  color: rgba(0,200,100,.9); }
details.repro .repro-health.warning  { border: 1px solid rgba(255,170,0,.3);  color: rgba(255,170,0,.9); }
details.repro .repro-health.critical { border: 1px solid rgba(255,60,60,.3);  color: rgba(255,60,60,.9); }

/* English implementation note. */
details.repro.repro-multi .repro-multi-body { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; }
/* English implementation note. */
details.repro.repro-multi details.repro { margin: 0; max-width: none; }
details.repro.repro-multi details.repro .repro-header {
  border: none; border-radius: 10px; padding: 6px 10px;
  background: rgba(255,255,255,.03);
}
details.repro.repro-multi details.repro[open] .repro-header { border-radius: 10px 10px 0 0; }
details.repro.repro-multi details.repro .repro-c { border: none; padding: 8px 4px 4px; }
details.repro.repro-multi .repro-badge { font-size: 9px; }

/* English implementation note. */
details.repro .rp-sub { opacity: .5; font-weight: 400; font-size: 10px; }`;

// ── Custom CSS for infoblock ──
// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
const CSS_BOOST = ':root:not(#_):not(#_) ';

// Internal implementation note.
function stripCssComments(css) {
    let out = '', quote = null;
    for (let i = 0; i < css.length; i++) {
        const c = css[i];
        if (quote) {
            out += c;
            if (c === '\\') { out += css[++i] || ''; continue; }
            if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'") { quote = c; out += c; continue; }
        if (c === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2);
            i = end === -1 ? css.length : end + 1;
            continue;
        }
        out += c;
    }
    return out;
}

function boostCss(css) {
    const src = stripCssComments(String(css || ''));
    let out = '', i = 0;

    const readBlock = (start) => {
        let depth = 0;
        for (let j = start; j < src.length; j++) {
            if (src[j] === '{') depth++;
            else if (src[j] === '}') { depth--; if (depth === 0) return j; }
        }
        return src.length - 1;
    };

    while (i < src.length) {
        const brace = src.indexOf('{', i);
        if (brace === -1) { out += src.slice(i); break; }

        const head = src.slice(i, brace);
        const end = readBlock(brace);
        const body = src.slice(brace + 1, end);
        const sel = head.trim();

        if (sel.startsWith('@')) {
            // Internal implementation note.
            const nested = /^@(media|supports|layer|container)/i.test(sel);
            out += head + '{' + (nested ? boostCss(body) : body) + '}';
        } else if (sel) {
            const boosted = sel.split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .map(s => CSS_BOOST + s)
                .join(', ');
            out += (head.startsWith('\n') ? '\n' : '') + boosted + ' {' + body + '}';
        } else {
            out += head + '{' + body + '}';
        }
        i = end + 1;
    }
    return out;
}

// Internal implementation note.
// Internal implementation note.
function isSkeletonCss(css) {
    const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    return norm(css) === norm(DEFAULT_INFOBLOCK_CSS);
}

function applyCustomCss(cssRaw) {
    const css = isSkeletonCss(cssRaw) ? '' : cssRaw;
    let styleEl = document.getElementById('repro-custom-infoblock-css');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'repro-custom-infoblock-css';
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = css ? boostCss(css) : '';
}

// Internal implementation note.
export const THEMES = [
    { id: 'glass',   name: 'Glass',    icon: 'fa-wand-magic-sparkles' },
    { id: 'minimal', name: 'Minimal', icon: 'fa-align-left' },
];

// Internal implementation note.
const THEME_ALIASES = { aurora: 'glass', editorial: 'minimal', scrapbook: 'glass', pastel: 'glass' };

export function normalizeTheme(id) {
    const mapped = THEME_ALIASES[id] || id;
    return THEMES.some(t => t.id === mapped) ? mapped : 'glass';
}

export function applyTheme(id, light) {
    document.body.setAttribute('data-rp-theme', normalizeTheme(id));
    const isLight = light === undefined ? !!getSettings().lightMode : !!light;
    if (isLight) document.body.setAttribute('data-rp-light', '1');
    else document.body.removeAttribute('data-rp-light');
}

// Internal implementation note.
function themePreview(id) {
    return `<div class="rp-th-prev" data-rp-theme="${id}">
        <div class="rp-th-couple">
            <span class="rp-th-pill mom"></span>
            <span class="rp-th-heart"><i class="fa-solid fa-heart"></i></span>
            <span class="rp-th-pill dad"></span>
        </div>
        <div class="rp-th-kids">
            <span class="rp-th-kid girl"><span class="rp-th-av"></span><i></i></span>
            <span class="rp-th-kid boy"><span class="rp-th-av"></span><i></i></span>
        </div>
    </div>`;
}

export function showThemePicker() {
    const s = getSettings();
    const cur = normalizeTheme(s.theme);

    const cards = THEMES.map(t => `
        <button class="rp-th-card${t.id === cur ? ' on' : ''}" data-theme="${t.id}">
            ${themePreview(t.id)}
            <span class="rp-th-name"><i class="fa-solid ${t.icon}"></i>${t.name}</span>
            <span class="rp-th-check"><i class="fa-solid fa-check"></i></span>
        </button>`).join('');

    const overlay = $(`
    <dialog id="rp-theme-overlay" aria-modal="true" aria-labelledby="rp-theme-title">
        <div class="rp-th-dialog">
            <div class="rp-th-head">
                <span class="rp-th-head-icon"><i class="fa-solid fa-palette"></i></span>
                <span id="rp-theme-title" class="rp-th-title">Style</span>
                <button class="rp-th-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="rp-th-body">${cards}</div>
        </div>
    </dialog>`);

    $('body').append(overlay);
    const el = overlay[0];
    if (el.showModal) el.showModal(); else overlay.show();

    const close = () => { try { el.close(); } catch (e) { reportError('[Reproductive] handled exception:', e); } overlay.remove(); };
    overlay.on('click', function(e) { if (e.target === el) close(); });
    overlay.find('.rp-th-close').on('click', close);

    overlay.find('.rp-th-card').on('click', function() {
        const id = $(this).attr('data-theme');
        getSettings().theme = id;
        applyTheme(id);
        saveSettingsDebounced();
        overlay.find('.rp-th-card').removeClass('on');
        $(this).addClass('on');
        setTimeout(close, 180);
    });
}

function stat(icon, color, label, value, wide) {
    return `<div class="repro-stat${wide ? ' repro-wide' : ''}"><div class="rp-si ${color}">${ic(icon)}</div><div><div class="rp-lbl">${label}</div><div class="rp-val">${value}</div></div></div>`;
}

function hpBadge(status) {
    const normalized = String(status || '').trim().toLowerCase();
    const isCritical = /^(?:critical)/i.test(normalized);
    const isWarning = /^(?:warning|attention)/i.test(normalized);
    const cls = isCritical ? 'critical' : isWarning ? 'warning' : 'normal';
    const txt = isCritical ? 'Critical' : isWarning ? 'Warning' : 'Normal';
    return `<span class="repro-health ${cls}">${txt}</span>`;
}

function getCycleDetails(day, length = 28, bleeding = 5) {
    const { start, end } = fertileDays(length,bleeding);
    if (day <= bleeding) return { fertility:'Low', libido:'Low', mood:'Fatigue', physical:'Cramps', note:'Menstruation — simulated bleeding and discomfort.' };
    if (day < start) return { fertility:'Moderate', libido:'Moderate', mood:'Energetic', physical:'Energy rising', note:'Follicular phase — simulated cycle.' };
    if (day <= end) return { fertility:'High', libido:'High', mood:'Flirty', physical:'Sensitivity', note:'Estimated fertile window (not proof of ovulation).' };
    return { fertility:'Low', libido:'Low', mood:'PMS', physical:'Bloating', note:'Luteal phase — simulated cycle.' };
}

function getBabies(p) {
    if (p.babies && p.babies.length > 0) return p.babies;
    if (!p.hasBaby || !p.babyCount) return [];
    const babies = [];
    for (let i = 0; i < (p.babyCount || 1); i++) {
        babies.push({
            name: i === 0 ? (p.babyName || '') : '',
            sex: p.babySex?.[i] || '?',
            health: p.babyHealth || 'normal',
            mood: p.babyMood || '—',
            sleep: p.babySleep || '—',
            diaperClean: p.babyDiaperClean !== false,
            teething: !!p.babyTeething,
            colicky: !!p.babyColicky,
            feedingType: p.babyFeedingType || '—',
            milestones: i === 0 ? [...(p.babyMilestones || [])] : [],
        });
    }
    return babies;
}

// ── Infoblock: glassmorphism card for chat messages ──
export function buildInfoblockHtml() {
    const s = getSettings();
    const p = getPregnancyData();
    if (!s.isEnabled) return '';

    // Internal implementation note.
    // Internal implementation note.
    const isRuChat = detectChatLanguage() === 'ru';
    const tr = (v) => (isRuChat ? translateStatusValue(v) : typeof v === 'string' && /[\u0430-\u044f\u0451]/i.test(v) ? '' : v);

    // ── BABY MODE ──
    if (p.hasBaby) {
        const babies = getBabies(p);
        if (babies.length === 0) return ''; // fallthrough safety

        // Internal implementation note.
        const calcAge = (baby) => {
            // Internal implementation note.
            // Internal implementation note.
            // Internal implementation note.
            if (!baby.birthRpDate || !p.rpDate) return baby.age || p.babyAge || 'newborn';
            const birthMs = new Date(baby.birthRpDate).getTime();
            const nowMs = new Date(p.rpDate).getTime();
            if (isNaN(birthMs) || isNaN(nowMs)) return baby.age || p.babyAge || 'newborn';
            const days = Math.max(0, Math.floor((nowMs - birthMs) / 86400000));
            if (days < 30) return days <= 7 ? 'newborn' : `${days} days`;
            const months = Math.floor(days / 30);
            if (months < 12) return `${months} months`;
            const years = Math.floor(months / 12);
            const remMonths = months % 12;
            return remMonths > 0 ? `${years} years ${remMonths} months` : `${years} ${years === 1 ? 'year' : 'years'}`;
        };

        let html = '';
        babies.forEach((baby, i) => {
            const sexIcon = baby.sex === 'M' ? '<i class="fa-solid fa-mars"></i>' : baby.sex === 'F' ? '<i class="fa-solid fa-venus"></i>' : '<i class="fa-solid fa-genderless"></i>';
            const sexColor = baby.sex === 'F' ? 'pink' : baby.sex==='M'?'blue':'purple';
            const label = baby.name || (babies.length > 1 ? `Baby ${i + 1}` : 'Baby');
            const milestones = (baby.milestones || []).slice(-2).map(m => m.text).join(', ');
            const ageStr = calcAge(baby);

            const ageDays = babyAgeDays(baby, p);
            // Internal implementation note.
            let needs = { feeding: null, diaper: null, sleep: null, careNote: null };
            if (ageDays !== null) {
                needs = getCareNeeds(ageDays, p.rpTime, baby);
            }

            // Internal implementation note.
            // Internal implementation note.
            const mature=['school','teen','adult'].includes(getGrowthStage(ageDays,baby)?.key);
            const feedingVal = tr(baby.feeding) || tr(baby.feedingType) || '—';
            // Internal implementation note.
            const diaperText = baby.diaperStatus ? tr(baby.diaperStatus) : (needs.diaper || (baby.diaperClean ? 'Clean' : 'Needs changing'));
            const diaperIsClean = baby.diaperStatus
                ? /^(?:\u0447\u0438\u0441\u0442|clean|dry|\u0441\u0443\u0445)/i.test(baby.diaperStatus)
                : (baby.diaperClean !== false && needs.diaper !== 'Needs changing');
            // Internal implementation note.
            // Internal implementation note.
            // Internal implementation note.
            // Internal implementation note.
            const rawCareRec = tr(baby.careNote);
            const isGenericCareNorm = rawCareRec && (
                /\u043a\u043e\u0440\u043c\u043b\u0435\u043d\w*\s+(?:\u043f\u043e\s+\u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044e\s+)?\u043a\u0430\u0436\u0434\u044b\u0435\s*2\s*[–—-]\s*3\s*(?:\u0447|\u0447\u0430\u0441)/i.test(rawCareRec) ||
                /\u0441\u043e\u043d\s*16\s*[–—-]\s*18\s*(?:\u0447|\u0447\u0430\u0441)/i.test(rawCareRec) ||
                /\u043a\u043e\u043b\u0438\u043a\w*.*(?:\u043f\u0438\u043a|6\s*\u043d\u0435\u0434)/i.test(rawCareRec) ||
                /(?:\u043f\u0430\u043c\u043f\u0435\u0440\u0441|\u043f\u043e\u0434\u0433\u0443\u0437\u043d\u0438\u043a)\w*\s*8\s*[–—-]\s*10\s*\u0440\u0430\u0437/i.test(rawCareRec)
            );
            const careRec = isGenericCareNorm ? null : (rawCareRec || null);

            html += `<details class="repro">
                <summary><div class="repro-header">
                    <div class="repro-icon baby">${ic('fa-baby')}</div>
                    <span class="repro-title repro-baby-name" data-baby-idx="${i}" title="Click to rename" style="cursor:pointer">${escapeLabel(label)}</span>
                    <span class="repro-badge baby" style="color:var(--rp-${sexColor})">${sexIcon} · ${ageStr}${(() => { const st = getGrowthStage(ageDays,baby); return (st && st.key !== 'newborn') ? ' · ' + st.label : ''; })()}</span>
                    <div class="repro-chev">${ic('fa-chevron-down')}</div>
                </div></summary>
                <div class="repro-c"><div class="repro-grid">
                    ${stat('fa-heart-pulse', 'green', 'Health', hpBadge(baby.health || 'normal'))}
                    ${stat('fa-face-smile', 'purple', 'Mood', tr(baby.mood) || '—')}
                    ${mature?'':stat('fa-bottle-water', 'blue', 'Feeding', feedingVal)}
                    ${stat('fa-moon', 'purple', 'Sleep', tr(baby.sleep) || (needs.sleep) || '—')}
                    ${mature?'':stat('fa-baby-carriage', diaperIsClean ? 'green' : 'orange', 'Diaper', diaperIsClean ? diaperText : `<span class="rp-val-warn">${diaperText}</span>`)}
                    ${baby.teething ? stat('fa-tooth', 'blue', 'Teething', 'Teething') : ''}
                    ${baby.colicky ? stat('fa-face-sad-tear', 'pink', 'Colic', 'Yes') : ''}
                    ${baby.fatherName ? stat('fa-user', 'blue', 'Second parent', escapeLabel(baby.fatherName)) : ''}
                    ${baby.species ? stat('fa-dna','purple','Species',escapeLabel(baby.species)) : ''}
                    ${baby.developmentRate ? stat('fa-clock','blue','Development',escapeLabel(baby.developmentRate+'×')) : ''}
                    ${baby.genetics?.abilities?.length ? stat('fa-wand-magic-sparkles','purple','Inherited abilities',escapeLabel(baby.genetics.abilities.join(', '))) : ''}
                    ${baby.personality?.length ? `<div class="repro-note"><i class="fa-solid fa-brain" style="margin-right:4px;opacity:0.5"></i>${baby.personality.map(escapeLabel).join(', ')}</div>` : ''}
                    ${baby.appearance?.length ? `<div class="repro-note"><i class="fa-solid fa-eye" style="margin-right:4px;opacity:0.5"></i>${baby.appearance.map(escapeLabel).join(', ')}</div>` : ''}
                    ${baby.special ? `<div class="repro-note" style="border-color:rgba(255,215,64,.35);background:rgba(255,215,64,.06)"><i class="fa-solid fa-star" style="margin-right:4px;color:#ffd740"></i><b>${escapeLabel(baby.special.name || baby.special)}</b>${baby.special.desc ? ` — ${escapeLabel(baby.special.desc)}` : ''}</div>` : ''}
                    ${milestones ? `<div class="repro-note"><i class="fa-solid fa-star" style="margin-right:4px;opacity:0.5"></i>${escapeLabel(milestones)}</div>` : ''}
                    ${careRec ? `<div class="repro-note repro-rec"><i class="fa-solid fa-lightbulb" style="margin-right:4px;opacity:0.7"></i>${escapeLabel(careRec)}</div>` : ''}
                </div></div>
            </details>`;
        });

        // Internal implementation note.
        return html + carriersHtml(tr);
    }

    return carriersHtml(tr);
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
function carriersHtml(tr) {
    const s = getSettings();
    const cards = [];
    for (const { who, data } of getCarriers()) {
        // Internal implementation note.
        // Internal implementation note.
        const showPreg = data.isPregnant && pregnancyIsKnown(data, s);
        // Internal implementation note.
        if (!showPreg && !hasAnyTracking(s, who)) continue;
        cards.push(showPreg ? pregnancyCardHtml(who, data, tr) : cycleCardHtml(who, data, tr));
    }
    if (cards.length <= 1) return cards[0] || '';

    // Internal implementation note.
    const brief = getCarriers().map(({ who, data }) => {
        const nm = carrierName(who);
        if (data.isPregnant && pregnancyIsKnown(data, s)) return `${nm} · ${displayPregnancyWeeks(data,s)} weeks`;
        return `${nm} · ${cycleSummary(who, data, s)}`;
    }).join('  ·  ');

    return `<details class="repro repro-multi">
        <summary><div class="repro-header">
            <div class="repro-icon cycle">${ic('fa-venus-mars')}</div>
            <span class="repro-title">Reproductive</span>
            <span class="repro-badge cycle">${brief}</span>
            <div class="repro-chev">${ic('fa-chevron-down')}</div>
        </div></summary>
        <div class="repro-c repro-multi-body">${cards.join('')}</div>
    </details>`;
}

// Internal implementation note.
function carrierTag(who) {
    return (getSettings()?.trackFor === 'both') ? `${carrierName(who)} · ` : '';
}

function pregnancyCardHtml(who, c, tr) {
    return buildPregnancyCard(who, c, getPregnancyData(), getSettings(), tr);
}

// Internal implementation note.
function buildPregnancyCard(who, p, root, s, tr) {
    {
        const dur = conceptionTerm(s,who,p);
        // Internal implementation note.
        const { weeks, days } = calculateWeeksFromDates(p.conceptionDate, root.rpDate, p.pregnancyWeeks);
        const pct = Math.min(100, Math.round((weeks / dur) * 100));
        // Internal implementation note.
        const trimester = pct <= 33 ? 1 : pct <= 67 ? 2 : 3;
        const sexRevealed = !!p.fetusSexRevealed;
        const sexStr = sexRevealed && p.fetusSex?.length ? p.fetusSex.map(s => s === 'M' ? '<i class="fa-solid fa-mars"></i> boy' : s==='F'?'<i class="fa-solid fa-venus"></i> girl':'unknown').join(', ') : 'unknown';
        // Internal implementation note.
        // Internal implementation note.
        const fetusSize = tr((p._dynamic || {}).fetusSize) || '';
        const symptoms = getSymptomsForProgress(pct, weeks);
        const recs = getRecommendationsForProgress(pct);
        let dueStr = '—';
        if (p.conceptionDate) {
            const dd = calculateDueDate(p.conceptionDate,who,pregnancyDatingMode(p,s));
            if (dd) dueStr = dd.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        let conceptionStr = '—';
        if (p.conceptionDate) {
            conceptionStr = new Date(p.conceptionDate).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        const pd = p._dynamic || {};
        let noteLines = [];
        if (pd.symptoms || symptoms) noteLines.push(tr(pd.symptoms) || tr(symptoms));
        if (pd.note || recs) noteLines.push(tr(pd.note) || tr(recs));

        return `<details class="repro">
            <summary><div class="repro-header">
                <div class="repro-icon pregnancy">${ic('fa-heart')}</div>
                <span class="repro-title">${carrierTag(who)}Pregnancy</span>
                <span class="repro-badge pregnancy">${displayPregnancyWeeks(p,s)}/${pregnancyLength(s,who)} weeks (${pregnancyDatingMode(p,s)==='obstetric'?'gestational':'conception'})${days ? ` + ${days} days` : ''} · ${trimester} tri.</span>
                <div class="repro-chev">${ic('fa-chevron-down')}</div>
            </div></summary>
            <div class="repro-c">
                <div class="repro-bar"><div class="repro-bar-fill pregnancy" style="width:${pct}%"></div></div>
                <div class="repro-grid">
                    ${root.rpDate ? stat('fa-clock', 'purple', 'RP time', new Date(root.rpDate).toLocaleString('en-US', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})) : ''}
                    ${stat('fa-calendar-day', 'pink', 'Conception', conceptionStr)}
                    ${stat('fa-calendar', 'purple', 'Due date', dueStr)}
                    ${stat('fa-baby', 'pink', 'Fetus', `${formatFetusCount(p.fetusCount)} (${sexStr})`)}
                    ${p.fatherName ? stat('fa-user', 'blue', 'Second parent', escapeLabel(p.fatherName)) : ''}
                    ${fetusSize ? stat('fa-ruler', 'blue', 'Size', fetusSize) : ''}
                    ${stat('fa-heart-pulse', 'green', 'Health', hpBadge(p.healthStatus))}
                    ${p.mood ? stat('fa-face-smile', 'purple', 'Mood', tr(p.mood)) : ''}
                    ${p.weightGain ? stat('fa-weight-scale', 'orange', 'Weight', tr(p.weightGain)) : ''}
                    ${p.babyActivity ? stat('fa-person-running', 'blue', 'Activity', tr(p.babyActivity)) : ''}
                    ${p.libido ? stat('fa-fire', 'pink', 'Libido', tr(p.libido)) : ''}
                    ${pd.movements ? stat('fa-hand', 'purple', 'Movements', tr(pd.movements)) : ''}
                    ${pd.swelling ? stat('fa-droplet', 'orange', 'Swelling', tr(pd.swelling)) : ''}
                    ${pd.braxton_hicks ? stat('fa-bolt', 'pink', 'Contractions', tr(pd.braxton_hicks)) : ''}
                    ${pd.fetal_position ? stat('fa-baby', 'blue', 'Position', tr(pd.fetal_position)) : ''}
                    ${pd.recommendations ? `<div class="repro-note repro-rec">${ic('fa-lightbulb')} ${tr(pd.recommendations)}</div>` : ''}
                    ${noteLines.length ? `<div class="repro-note">${noteLines.join(' · ')}</div>` : ''}
                </div>
            </div>
        </details>`;
    }
}

// Internal implementation note.
function cycleCardHtml(who, c, tr) {
    const s = getSettings();
    // Dynamic cycle status is accepted only when the parser marked its owner.
    // This also makes stale legacy/misassigned dynamic values fall back to the
    // deterministic cycle values instead of leaking {{char}} into {{user}}.
    const rawDynamic = c._dynamic || {};
    const d = rawDynamic._owner === who ? rawDynamic : {};


    // Internal implementation note.
    const p0 = getPregnancyData();
    // Internal implementation note.
    // Internal implementation note.
    const hidden = c.isPregnant && !pregnancyIsKnown(c, s);
    const frozenDay = who === 'char' ? Math.max(1, c.cycleDay || 1) : getCycleDay();
    const rawDay = hidden ? frozenDay + daysSinceConception(c, p0) : frozenDay;
    const len = cycleLength(s, who), bleed = bleedingDays(s, who);
    const day = Math.max(1, Math.min(len, rawDay));
    const method = getContraception(who);
    const methodStatus = contraceptionStatus(method, getContraceptionDetails(who), p0.rpDate);
    const hormonal = ['implant','injection','pill','patch','ring'].includes(method) && methodStatus.active;
    const phase = hidden ? { name: 'Scene-based status' } : getPhaseInfo(day, 'ru', who);
    const cycling = hasCycle(s, who);
    const carries = canCarry(s, who);
    const role = isOmegaverse(s) ? roleLabel(s, who) : '';
    const hot = !!heatDay(s,who,day,getPregnancyData().rpDate)?.active;
    const cyclePct = Math.min(100, Math.round(rawDay / len * 100));
    const cd = (hasMenstrualCycle(s,who)||hasOvulation(s,who)) ? getCycleDetails(day, len, hasMenstrualCycle(s,who)?bleed:0) : { fertility:'—', libido:hot?'High':'Normal', mood:hot?'Arousal':'Calm', physical:hot?'Heat, sensitivity':'Normal', note:'' };

    // Internal implementation note.
    if (hormonal) { cd.fertility = 'Suppressed / uncertain'; cd.note = hormoneCycleHint(method, methodStatus); }
    const delay = missedDays(rawDay, len);
    const pp = getPostpartum(c, p0);
    if(pp && !pp.cycleReturned)cd.note='Cycle paused during postpartum recovery; last cycle day is not current.';
    const win = carries && s.tryingToConceive && !hormonal ? fertileWindow(day, len) : null;
    const testRes = c.lastTestResult;

    let extraRows = '';
    let hygieneReminder = false;

    // Internal implementation note.
    if (hasMenstrualCycle(s,who) && day <= bleed && (!pp || pp.cycleReturned) && !hidden) {
        const flow = getFlow(day, bleed);
        const hrs = hoursBetween(c.hygieneChangedRpDate, p0.rpDate);
        const hy = getHygieneState(c.hygieneType || 'pad', hrs, flow);
        hygieneReminder = hy.needsChange;
        const worn = hrs === null ? '' : ` · ${Math.round(hrs)} h`;
        const hygieneText = hy.type.id === 'none' ? 'No hygiene product' : hy.needsChange ? 'Needs changing' : hrs === null ? 'Change not recorded' : `Change in ${hy.hoursLeft} h`;
        extraRows += stat('fa-shield-heart', hy.needsChange ? 'orange' : 'green', 'Hygiene', hygieneText, true);
        if (hy.health === 'tampon-too-long') {
            extraRows += stat('fa-kit-medical', 'red', 'Warning', 'Tampon over 8 hours', true);
        }
    }

    if (carries && delay > 0 && !pp) {
        extraRows += stat('fa-calendar-xmark', 'orange', 'Delay', `${delay} days`);
    }
    if (testRes && carries) {
        const tLabel = testRes === 'positive' ? 'Two lines' : testRes === 'faint' ? 'Faint second line' : 'Negative';
        extraRows += stat('fa-vial', testRes === 'negative' ? 'blue' : 'pink', 'Test', tLabel);
    }
    if (win) {
        extraRows += stat('fa-bullseye', win.fertile ? 'pink' : 'blue', 'Trying to conceive',
            win.fertile ? (win.peak ? 'Peak today' : 'Fertile window') : `Window in ${win.daysToPeak} days`);
    }
    if (pp) {
        extraRows += stat('fa-heart-pulse', 'green', 'Postpartum', `${pp.days} days`);
        if (pp.lactating) extraRows += stat('fa-bottle-droplet', 'blue', 'Lactation', 'Breastfeeding');
        if (pp.healing) extraRows += stat('fa-bandage', 'orange', 'Recovery', pp.healing);
        if (!pp.cycleReturned) extraRows += stat('fa-clock-rotate-left', 'purple', 'Cycle', 'Not returned');
    }

    const heatInfo=heatDay(s,who,day,getPregnancyData().rpDate);
    const separateHeat=heatInfo && heatSettings(s,who).mode==='independent';
    const heatBadge=separateHeat ? (heatInfo.unanchored?'Heat/rut: RP date needed':`${heatInfo.type==='rut'?'Rut':'Heat'} ${heatInfo.day}/${heatInfo.length}${heatInfo.active?' active':''}`):'';
    const badge = pp && !pp.cycleReturned ? `Cycle paused · postpartum ${pp.days}d`
        : separateHeat ? ((hasMenstrualCycle(s,who)||hasOvulation(s,who))?`Cycle ${day}/${len} · ${heatBadge}`:heatBadge)
        : !cycling ? (role || 'Scene-based')
        : delay > 0 ? `Delay ${delay} days`
        : `Day ${day}/${len} · ${phase.name}`;

    return `<details class="repro">
        <summary><div class="repro-header">
            <div class="repro-icon cycle">${ic(pp ? 'fa-heart-pulse' : 'fa-clock')}</div>
            <span class="repro-title">${carrierTag(who)}${pp ? 'Recovery' : role || (cycling ? 'Cycle' : 'Status')}</span>
            <span class="repro-badge cycle">${badge}${hygieneReminder ? ' · Change product' : ''}</span>
            <div class="repro-chev">${ic('fa-chevron-down')}</div>
        </div></summary>
        <div class="repro-c">
            ${cycling ? `<div class="repro-bar"><div class="repro-bar-fill cycle" style="width:${cyclePct}%"></div></div>` : ''}
            <div class="repro-grid">
                ${carries ? stat('fa-droplet', 'green', 'Fertility', hidden || delay > 0 ? 'Undetermined' : pp && !pp.cycleReturned ? 'Very low' : cd.fertility) : stat('fa-clock', 'purple', 'Phase', phase.name)}
                ${stat('fa-fire', 'pink', 'Libido', tr(d.libido) || cd.libido)}
                ${stat('fa-face-smile', 'purple', 'Mood', tr(d.mood) || cd.mood)}
                ${stat('fa-heart', 'blue', 'Physical', tr(d.physical) || cd.physical)}
                ${extraRows}
                <div class="repro-note">${tr(d.note) || (hidden || delay > 0 ? 'Use current symptoms and scene facts.' : pp && !pp.cycleReturned ? 'Cycle has not resumed yet.' : cd.note)}</div>
            </div>
        </div>
    </details>`;
}

// Internal implementation note.
function formatAgeStr(days) {
    if (days === null || days === undefined || isNaN(days)) return '—';
    if (days < 30) return days <= 7 ? 'newborn' : `${days} days`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} months`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0 ? `${years} \u0433. ${rem} months` : `${years} ${years === 1 ? 'year' : 'years'}`;
}

function fmtRpDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Internal implementation note.
function escapeLabel(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function parentPill(name, cls, roleLabel, unknown = false) {
    return `<span class="rp-pill ${cls}${unknown ? ' unknown' : ''}">
        <span class="rp-pill-tx"><b>${escapeLabel(name)}</b></span>
    </span>`;
}

// Internal implementation note.
function bentoTile(label, value, gold = false) {
    return `<div class="rp-bento-tile${gold ? ' gold' : ''}">
        <div class="rp-bento-lbl">${label}</div>
        <div class="rp-bento-val">${value}</div>
    </div>`;
}

// Internal implementation note.
function progressRing(pct, initial, sexCls) {
    const r = 18, circ = 2 * Math.PI * r;
    const dash = Math.max(0, Math.min(circ, (pct / 100) * circ));
    return `<span class="rp-ring ${sexCls}">
        <svg viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="${r}" class="rp-ring-bg"></circle>
            <circle cx="20" cy="20" r="${r}" class="rp-ring-fg" stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"></circle>
        </svg>
        <span class="rp-ring-tx">${initial}</span>
    </span>`;
}

// Internal implementation note.
function milestoneChips(k, p) {
    const ms = k.milestones || [];
    if (!ms.length) return `<div class="rp-tree-ms-empty">No achievements yet</div>`;

    const birthMs = k.birthRpDate ? new Date(k.birthRpDate).getTime() : NaN;
    const groupOf = (m) => {
        const t = m.rpDate ? new Date(m.rpDate).getTime() : NaN;
        if (isNaN(birthMs) || isNaN(t)) return { key: 'z', label: '', date: fmtRpDate(m.rpDate) };
        const days = Math.max(0, Math.floor((t - birthMs) / 86400000));
        if (days < 30) return { key: 'a', label: 'first month', date: fmtRpDate(m.rpDate) };
        if (days < 183) return { key: 'b', label: 'under 6 months', date: fmtRpDate(m.rpDate) };
        if (days < 365) return { key: 'c', label: 'under 1 year', date: fmtRpDate(m.rpDate) };
        const years = Math.floor(days / 365);
        return { key: 'd' + years, label: `${years} ${years === 1 ? 'year' : 'years'}`, date: fmtRpDate(m.rpDate) };
    };

    const groups = new Map();
    for (const m of ms) {
        const g = groupOf(m);
        if (!groups.has(g.key)) groups.set(g.key, { label: g.label, date: g.date, items: [] });
        groups.get(g.key).items.push(m);
    }

    let out = `<div class="rp-tree-ms-title"><i class="fa-solid fa-award"></i>Achievements · ${ms.length}</div>`;
    for (const g of [...groups.values()].reverse()) {
        out += `<div class="rp-ms-group">
            <span class="rp-ms-group-lbl">${g.label || 'milestones'}</span>
            <span class="rp-ms-group-line"></span>
            <span class="rp-ms-group-date">${g.date || ''}</span>
        </div><div class="rp-ms-chips">`;
        for (const m of g.items.slice().reverse()) {
            const story = m.source === 'story';
            const icon = story ? 'fa-trophy' : (MILESTONE_ICONS[m.key] || 'fa-star');
            out += `<span class="rp-ms-chip${story ? ' story' : ''}"><i class="fa-solid ${icon}"></i>${m.text}</span>`;
        }
        out += `</div>`;
    }
    return out;
}

export function showFamilyTree() {
    $('#rp-tree-overlay').remove();

    const p = getPregnancyData();
    const s = getSettings();
    const carrierRole = '';
    const partnerRole = '';

    let momName = carrierName(s.carrierMode === 'char' ? 'char' : 'user');
    try {
        const ctx = SillyTavern.getContext();
        if (s.carrierMode !== 'char' && ctx?.name1) momName = ctx.name1;
    } catch (e) { reportError('[Reproductive] handled exception:', e); }

    const initialOf = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';

    // Internal implementation note.
    const kids = [];
    (p.babies || []).forEach(b => kids.push({ ...b, _grown: false }));
    (p.grownChildren || []).forEach(c => kids.push({ ...c, _grown: true }));

    const pregnancies = [
        { state: p, name: carrierName('user') },
        { state: getPartnerData(), name: carrierName('char') },
    ].filter(x => x.state.isPregnant);
    const pairKey = (name, second) => JSON.stringify([name, (second || '').trim() || '—']);
    const groups = new Map();
    for (const k of kids) {
        const key = pairKey(k.motherName || (k.bornBy ? carrierName(k.bornBy) : momName), k.fatherName);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(k);
    }
    for (const pending of pregnancies) {
        const key = pairKey(pending.name, pending.state.fatherName);
        if (!groups.has(key)) groups.set(key, []);
    }

    // Internal implementation note.
    const detailPanels = [];
    const detailKids = []; // Internal implementation note.

    const kidCard = (k) => {
        const days = babyAgeDays(k, p);
        const stage = getGrowthStage(days,k);
        const sexCls = k.sex === 'F' ? 'girl' : k.sex==='M'?'boy':'other';
        const sexIcon = k.sex === 'F' ? 'fa-venus' : k.sex==='M'?'fa-mars':'fa-genderless';
        const ageStr = k._grown && days === null ? 'grown' : formatAgeStr(days);
        // Internal implementation note.
        const stageStr = stage ? (stage.key === 'newborn' ? '' : stage.label) : (k._grown ? 'adult' : '');
        const msCount = (k.milestones || []).length;

        // Internal implementation note.
        const msHtml = milestoneChips(k, p);

        // Internal implementation note.
        const tiles = [];
        const birthStr = fmtRpDate(k.birthRpDate);
        if (birthStr) tiles.push(bentoTile('Born', birthStr));
        if (k.personality?.length) tiles.push(bentoTile('Personality', k.personality.join(', ')));
        if (k.appearance?.length) tiles.push(bentoTile('Appearance', k.appearance.join(', ')));
        if (k.special) tiles.push(bentoTile('Special trait', k.special.name || k.special, true));

        // Internal implementation note.
        const total = milestonesTotal();
        const done = Math.min(total, (k.milestones || []).filter(m => m.source !== 'story').length);
        const pctDone = total ? Math.round((done / total) * 100) : 0;
        const ring = progressRing(pctDone, initialOf(k.name), sexCls);

        const idx = detailPanels.length;
        detailKids.push(k);
        detailPanels.push(`
            <div class="rp-tree-det-head">
                ${ring}
                <div class="rp-tree-det-tx">
                    <div class="rp-tree-det-name">${k.name || 'unnamed'}</div>
                    <div class="rp-tree-det-sub">${ageStr}${stageStr ? ' · ' + stageStr : ''}${k._grown ? ' · grown' : ''} · development ${done} of ${total}</div>
                </div>
                <button class="rp-tree-del" data-del="${idx}" title="Remove from family"><i class="fa-solid fa-trash"></i></button>
            </div>
            ${tiles.length ? `<div class="rp-tree-bento">${tiles.join('')}</div>` : ''}
            ${msHtml}`);

        return `<div class="rp-tree-cell">
            <div class="rp-node kid ${sexCls}" data-det="${idx}" title="Click — profile and achievements">
                <span class="rp-node-ava">${initialOf(k.name)}<i class="fa-solid ${sexIcon} rp-node-sex"></i></span>
                <span class="rp-node-name">${k.name || 'unnamed'}</span>
                <span class="rp-node-sub">${ageStr}${stageStr ? ` · ${stageStr}` : ''}</span>
                <span class="rp-node-badges">
                    ${msCount ? `<span class="rp-node-badge gold" title="Achievements"><i class="fa-solid fa-trophy"></i>${msCount}</span>` : ''}
                    ${k._grown ? `<span class="rp-node-badge green" title="Grown"><i class="fa-solid fa-check"></i></span>` : ''}
                </span>
            </div>
        </div>`;
    };

    let branchesHtml = '';
    for (const [key, children] of groups) {
        const [birthParentName, father] = JSON.parse(key);
        // Internal implementation note.
        children.sort((a, b) => {
            const am = a.birthRpDate ? new Date(a.birthRpDate).getTime() : 0;
            const bm = b.birthRpDate ? new Date(b.birthRpDate).getTime() : 0;
            return am - bm;
        });
        let cells = children.map(kidCard).join('');

        for (const pending of pregnancies.filter(x => pairKey(x.name, x.state.fatherName) === key)) {
            const carrier = pending.state;
            const w = carrier.pregnancyWeeks || 0;
            const cnt = carrier.fetusCount || 1;
            const sexStr = carrier.fetusSexRevealed && carrier.fetusSex?.length
                ? carrier.fetusSex.map(s => s === 'M' ? 'boy' : 'girl').join(', ')
                : 'surprise';
            cells += `<div class="rp-tree-cell">
                <div class="rp-node kid expecting">
                    <span class="rp-node-ava"><i class="fa-solid fa-heart"></i></span>
                    <span class="rp-node-name">Expected</span>
                    <span class="rp-node-sub">${cnt > 1 ? cnt + ' babies' : sexStr}</span>
                    <span class="rp-node-sub dim">${w} weeks</span>
                </div>
            </div>`;
        }

        const isUnknown = father === '—';

        // Internal implementation note.
        branchesHtml += `<div class="rp-tree-union">
            <div class="rp-couple">
                ${parentPill(birthParentName, 'mom', carrierRole)}
                <span class="rp-couple-line"></span>
                <span class="rp-couple-link" title="${isUnknown ? 'second parent not specified' : 'pair'}"><i class="fa-solid ${isUnknown ? 'fa-question' : 'fa-heart'}"></i></span>
                <span class="rp-couple-line"></span>
                ${parentPill(isUnknown ? 'unknown' : father, 'dad', partnerRole, isUnknown)}
            </div>
            ${cells ? `<div class="rp-tree-kids-wrap"><div class="rp-tree-row">${cells}</div></div>` : ''}
        </div>`;
    }

    const canvasHtml = branchesHtml
        ? `<div class="rp-tree-canvas">
              <div class="rp-tree-rail">${branchesHtml}</div>
           </div>
           <div class="rp-tree-details" style="display:none"></div>`
        : `<div class="rp-tree-canvas">
              <div class="rp-tree-root no-line">${parentPill(momName, 'mom', carrierRole)}</div>
           </div>
           <div class="rp-tree-empty"><i class="fa-solid fa-seedling"></i>No children yet — the family tree is waiting for its story</div>`;

    const overlay = $(`
    <dialog id="rp-tree-overlay" aria-modal="true" aria-labelledby="rp-tree-title">
        <div class="rp-tree-dialog">
            <div class="rp-tree-head">
                <span class="rp-tree-head-icon"><i class="fa-solid fa-people-roof"></i></span>
                <span class="rp-tree-title" id="rp-tree-title">Family tree</span>
                <button class="rp-tree-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="rp-tree-body">${canvasHtml}</div>
        </div>
    </dialog>`);

    $('body').append(overlay);
    const dialog = overlay[0];
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else overlay.attr('open', '');

    const close = () => {
        if (typeof dialog.close === 'function' && dialog.open) dialog.close();
        overlay.remove();
    };
    // Internal implementation note.
    overlay.on('mousedown mouseup click touchstart touchend', (e) => e.stopPropagation());
    overlay.on('cancel', (e) => { e.preventDefault(); close(); });
    overlay.on('click', function(e) { if (e.target === this) close(); });
    overlay.find('.rp-tree-close').on('click', close);

    // Internal implementation note.
    overlay.find('.rp-node.kid[data-det]').on('click', function() {
        const idx = parseInt($(this).attr('data-det'));
        const panel = overlay.find('.rp-tree-details');
        const wasSel = $(this).hasClass('sel');
        overlay.find('.rp-node.kid').removeClass('sel');
        if (wasSel) {
            panel.slideUp(150);
        } else {
            $(this).addClass('sel');
            panel.html(detailPanels[idx] || '').slideDown(150);
        }
    });

    // Internal implementation note.
    overlay.on('click', '.rp-tree-del', function(e) {
        e.stopPropagation();
        const idx = parseInt($(this).attr('data-del'));
        const k = detailKids[idx];
        if (!k) return;
        if (!confirm(`Remove ${k.name || 'this child'} from the family? Other children will remain. This cannot be undone.`)) return;
        const pd = getPregnancyData();
        createUndoCheckpoint(`Remove child: ${k.name || 'unnamed'}`);
        const same = (b) => (b.name || '') === (k.name || '')
            && String(b.birthRpDate || '') === String(k.birthRpDate || '')
            && (b.sex || '') === (k.sex || '');
        if (k._grown) {
            pd.grownChildren = (pd.grownChildren || []).filter(b => !same(b));
        } else {
            pd.babies = (pd.babies || []).filter(b => !same(b));
            pd.babyCount = pd.babies.length;
            if (pd.babies.length === 0) {
                pd.hasBaby = false;
                pd.babyName = '';
                pd.babySex = [];
            } else {
                pd.babyName = pd.babies[0].name || '';
                pd.babySex = pd.babies.map(b => b.sex);
            }
        }
        syncBabyLegacyFields(pd);
        saveSettingsDebounced();
        showNotification(`${k.name || 'Child'} removed from the family`, 'info');
        import('./message-handler.js').then(m => m.refreshRegenSnapshot && m.refreshRegenSnapshot());
        close();
        syncUI();
        updatePromptInjection();
        setTimeout(() => { import('./message-handler.js').then(m => m.renderInfoblock()); showFamilyTree(); }, 100);
    });
}

// Internal implementation note.
export function showQuickBar() {
    $('#rp-quick-overlay').remove();
    const s = getSettings();
    const p = getPregnancyData();

    // Internal implementation note.
    const both = s.trackFor === 'both';
    const rows = [];
    if (p.hasBaby) {
        const n = (p.babies?.length || p.babyCount || 1);
        rows.push(`${n > 1 ? n + ' babies' : 'Baby'} in the family`);
    }
    for (const { who, data } of getCarriers()) {
        const nm = both ? `<b>${carrierName(who)}:</b> ` : '';
        rows.push(`${nm}${cycleSummary(who, data, s)}`);
    }
    const statusHtml = rows.join('<br>');

    const day = getCycleDay();

    // Internal implementation note.
    let realismRow = '';
    if (isTracked('user') && !p.isPregnant && hasMenstrualCycle(s, 'user') && day <= bleedingDays(s, 'user')) {
        const hrs = hoursBetween(p.hygieneChangedRpDate, p.rpDate);
        const hy = getHygieneState(p.hygieneType || 'pad', hrs, getFlow(day, bleedingDays(s, 'user')));
        const opts = Object.values(HYGIENE)
            .map(h => `<option value="${h.id}"${(p.hygieneType || 'pad') === h.id ? ' selected' : ''}>${h.label}</option>`)
            .join('');
        realismRow = `<div class="rp-quick-cycle">
            <span class="rp-quick-lbl">Hygiene</span>
            <select id="rp-quick-hygiene" class="text_pole" style="flex:1">${opts}</select>
            <button class="rp-quick-set" id="rp-quick-changed">${hy.needsChange ? 'Change' : 'Changed'}</button>
        </div>`;
    }

    const overlay = $(`
    <dialog id="rp-quick-overlay" aria-modal="true" aria-labelledby="rp-quick-title">
        <div class="rp-quick-dialog">
            <div class="rp-tree-head">
                <span class="rp-tree-title" id="rp-quick-title">Reproductive</span>
                <button class="rp-tree-close" title="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="rp-quick-body">
                <div class="rp-quick-status">${statusHtml}</div>
                ${(!isTracked('user')) ? '' : `<div class="rp-quick-cycle">
                    <span class="rp-quick-lbl">Cycle day</span>
                    <button class="rp-quick-step" data-d="-1"><i class="fa-solid fa-minus"></i></button>
                    <input type="number" id="rp-quick-cycleday" min="1" max="${cycleLength(s, 'user')}" value="${day}" class="text_pole">
                    <button class="rp-quick-step" data-d="1"><i class="fa-solid fa-plus"></i></button>
                    <button class="rp-quick-set" id="rp-quick-setcycle">Set</button>
                </div>`}
                ${realismRow}
                <div class="rp-quick-actions">
                    ${(!p.isPregnant || !pregnancyIsKnown(p, s)) && !p.hasBaby
                        ? `<button class="rp-quick-btn" id="rp-quick-test">Take pregnancy test</button>` : ''}
                    ${!p.isPregnant && !p.hasBaby
                        ? `<button class="rp-quick-btn" id="rp-quick-trying">${s.tryingToConceive ? 'Stop trying' : 'Try for a baby'}</button>` : ''}
                    <button class="rp-quick-btn" id="rp-quick-tree">Family tree</button>
                    ${p.isPregnant ? `<button class="rp-quick-btn" id="rp-quick-birth">Deliver baby</button>` : ''}
                    <button class="rp-quick-btn" id="rp-quick-settings">All settings</button>
                </div>
            </div>
        </div>
    </dialog>`);

    $('body').append(overlay);
    const dialog = overlay[0];
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else overlay.attr('open', '');
    overlay.on('mousedown mouseup click touchstart touchend', (e) => e.stopPropagation());
    const close = () => {
        if (typeof dialog.close === 'function' && dialog.open) dialog.close();
        overlay.remove();
    };
    overlay.on('cancel', (e) => { e.preventDefault(); close(); });
    overlay.on('click', function(e) { if (e.target === this) close(); });
    overlay.find('.rp-tree-close').on('click', close);

    overlay.find('#rp-quick-hygiene').on('change', function() {
        const pd = getPregnancyData();
        pd.hygieneType = this.value;
        pd.hygieneChangedRpDate = pd.rpDate || null;
        saveSettingsDebounced();
        syncUI();
        updatePromptInjection();
    });
    overlay.find('#rp-quick-changed').on('click', function() {
        const pd = getPregnancyData();
        pd.hygieneChangedRpDate = pd.rpDate || null;
        saveSettingsDebounced();
        syncUI();
        updatePromptInjection();
        showNotification('<i class="fa-solid fa-shield-heart"></i> Hygiene product changed', 'success');
        close();
    });

    const applyCycle = (v) => {
        v = Math.max(1, Math.min(cycleLength(getSettings(), 'user'), parseInt(v) || 1));
        overlay.find('#rp-quick-cycleday').val(v);
        setManualCycleDay('user', v);
        saveSettingsDebounced();
        setTimeout(() => { updatePromptInjection(); syncUI(); }, 30);
        // Internal implementation note.
        const ph = getPhaseInfo(v);
        overlay.find('.rp-quick-status').html(`Cycle day ${v}/${cycleLength(getSettings(), 'user')} · <span style="color:${ph.color}">${ph.name}</span>`);
        showNotification(`Cycle day: ${v}`, 'success');
    };
    overlay.find('.rp-quick-step').on('click', function() {
        const cur = parseInt(overlay.find('#rp-quick-cycleday').val()) || 1;
        let nv = cur + parseInt($(this).attr('data-d'));
        if (nv < 1) nv = cycleLength(getSettings(), 'user'); if (nv > cycleLength(getSettings(), 'user')) nv = 1;
        overlay.find('#rp-quick-cycleday').val(nv);
    });
    overlay.find('#rp-quick-setcycle').on('click', () => applyCycle(overlay.find('#rp-quick-cycleday').val()));
    overlay.find('#rp-quick-cycleday').on('keydown', function(e) { if (e.key === 'Enter') applyCycle($(this).val()); });

    // Internal implementation note.
    overlay.find('#rp-quick-test').on('click', () => {
        takePregnancyTest('user');
        close();
        setTimeout(() => { import('./message-handler.js').then(m => m.renderInfoblock()); }, 80);
    });
    overlay.find('#rp-quick-trying').on('click', () => {
        setTrying(!getSettings().tryingToConceive);
        close();
        showNotification(getSettings().tryingToConceive
            ? 'Trying to conceive — the model knows the fertile days'
            : 'Trying-to-conceive mode off', 'success');
    });
    overlay.find('#rp-quick-tree').on('click', () => { close(); showFamilyTree(); });
    overlay.find('#rp-quick-birth').on('click', () => {
        close();
        if (!confirm('Deliver the baby now? This will open the baby naming dialog.')) return;
        applyScanResult({ vaginal_ejaculation_occurred: false, birth_occurred: true, sex_revealed: false, revealed_sexes: null, baby_traits: null, cycle_day: null, _source: 'manual' });
    });
    overlay.find('#rp-quick-settings').on('click', () => {
        close();
        // Internal implementation note.
        // Internal implementation note.
        setTimeout(() => {
            const block = document.querySelector('#rm_extensions_block');
            if (block && block.classList.contains('closedDrawer')) {
                document.querySelector('#extensions-settings-button .drawer-toggle')?.click();
            }
            setTimeout(() => {
                const our = document.querySelector('#extensions_settings2 .reproductive-system-settings');
                const drawer = our?.closest('.inline-drawer');
                if (!drawer) return;
                const content = drawer.querySelector('.inline-drawer-content');
                const closed = content && (content.style.display === 'none' || getComputedStyle(content).display === 'none');
                if (closed) drawer.querySelector('.inline-drawer-toggle')?.click();
                drawer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 280);
        }, 60);
    });
}

// Prevent repeated clicks while this chat's Cycle Realism setting is being saved.
let cycleRealismSaving = false;

// ── syncUI ──
export function syncUI() {
    const s = getSettings();
    const p = getPregnancyData();

    const el = (id) => document.getElementById(id);

    const enabled = el('repro-enabled');
    const notify = el('repro-notify');
    if (enabled) enabled.checked = s.isEnabled;
    if (notify) notify.checked = s.showNotifications;

    const contraUser = el('repro-contraception-user');
    const contraChar = el('repro-contraception-char');
    if (contraUser) { contraUser.value = getContraception('user'); contraUser.disabled = !canSetContraception(); }
    if (contraChar) { contraChar.value = getContraception('char'); contraChar.disabled = !canSetContraception(); }
    const contraUserBox = el('repro-contraception-user-box');
    const contraCharBox = el('repro-contraception-char-box');
    if (contraUserBox) contraUserBox.style.display = isTracked('user') && canCarry(s, 'user') ? 'flex' : 'none';
    if (contraCharBox) contraCharBox.style.display = isTracked('char') && canCarry(s, 'char') ? 'flex' : 'none';
    const contraUserLabel = el('repro-contra-user-label');
    const contraCharLabel = el('repro-contra-char-label');
    if (contraUserLabel) contraUserLabel.textContent = `Contraception ${carrierName('user')}:`;
    if (contraCharLabel) contraCharLabel.textContent = `Contraception ${carrierName('char')}:`;
    const lastEvent = el('repro-contraception-last');
    if (lastEvent) lastEvent.textContent = getLastContraceptionEvent() ? `Last RP contraceptive change — ${getLastContraceptionEvent()}` : ''; 
    for (const who of ['user','char']) {
        const statusLabel = el(`repro-status-${who}`);
        if (statusLabel) {
            const methodForStatus = getContraception(who);
            const detailsForStatus = getContraceptionDetails(who);
            const methodStatus = contraceptionStatus(methodForStatus, detailsForStatus, getPregnancyData().rpDate);
            const active = activeProtectionMethods(methodForStatus, detailsForStatus, getPregnancyData().rpDate);
            statusLabel.textContent = methodForStatus === 'none' && detailsForStatus.backup === 'none'
                ? 'Active methods: none'
                : `Active methods: ${active.map(x => x.method.replaceAll('_', ' ')).join(' + ') || 'none'}${methodStatus.reason ? ' — ' + methodStatus.reason : ''}`;
        }
        const extra = el(`repro-contra-extra-${who}`);
        const visible = isTracked(who) && canCarry(s, who);
        if (extra) extra.style.display = visible ? '' : 'none';
        const method = getContraception(who);
        const details = getContraceptionDetails(who);
        const backup = el(`repro-backup-${who}`);
        if (backup) { backup.value = details.backup; backup.disabled = !canSetContraception(); }
        const missed = el(`repro-missed-${who}`);
        if (missed) { missed.value = details.missedPills; missed.disabled = !canSetContraception(); }
        const pillOpt = el(`repro-pill-options-${who}`);
        if (pillOpt) pillOpt.style.display = method === 'pill' ? '' : 'none';
        const implantStatus = el(`repro-implant-status-${who}`);
        if (implantStatus) { implantStatus.value = details.implantStatus; implantStatus.disabled = !canSetContraception(); }
        const implantExpiry = el(`repro-implant-expiry-${who}`);
        if (implantExpiry) { implantExpiry.value = details.implantExpires; implantExpiry.disabled = !canSetContraception(); }
        const implantOpt = el(`repro-implant-options-${who}`);
        if (implantOpt) implantOpt.style.display = method === 'implant' ? '' : 'none';
        const dueOptions = el(`repro-schedule-options-${who}`);
        if (dueOptions) dueOptions.style.display = ['injection','patch','ring'].includes(method) ? '' : 'none';
        const dueInput = el(`repro-method-due-${who}`);
        if (dueInput) { dueInput.value = details.methodDue; dueInput.disabled = !canSetContraception(); }
    }


    const hiddenPreg = el('repro-hidden-preg');
    const chatOptionsEnabled = canSetChatOptions();
    for (const id of ['repro-trackfor', 'repro-carrier-mode',
                      'repro-hidden-preg', 'repro-duration', 'repro-duration-custom']) {
        const control = el(id);
        if (control) control.disabled = !chatOptionsEnabled;
    }
    if (hiddenPreg) hiddenPreg.checked = s.hiddenPregnancy !== false;
    const cycleRealism = el('repro-realism');
    if (cycleRealism) {
        cycleRealism.checked = s.realism === true;
        cycleRealism.disabled = !chatOptionsEnabled || cycleRealismSaving;
    }

    // Internal implementation note.
    const roleSettings = el('repro-role-settings');
    if (roleSettings) roleSettings.style.display = isOmegaverse(s) ? '' : 'none';
    for(const who of ['user','char']) { const rr=el(`repro-${who}-desig`)?.closest('.rp-setting-row');if(rr)rr.style.display=isTracked(who)?'':'none'; }
    for (const who of ['user','char']) {
        const roleSel = el(`repro-${who}-desig`);
        if (roleSel) roleSel.value = designationOf(s, who);
        const data = who === 'char' ? getPartnerData() : p;
        const row = el(`repro-hygiene-${who}`);
        if (row) row.style.display = isTracked(who) && hasMenstrualCycle(s,who) ? 'flex' : 'none';
        const kit = el(`repro-hygiene-${who}-kit`);
        if (kit) kit.value = data.hygieneType || 'pad';
        const type = el(`repro-hygiene-type-${who}`);
        if (type) type.value = data.hygieneType || 'pad';
    }
    for (const who of ['user','char']) {
        const lengthInput = el(`repro-cycle-length-${who}`);
        const bleedingInput = el(`repro-bleeding-days-${who}`);
        if (lengthInput) { lengthInput.value = cycleLength(s,who); lengthInput.disabled = !canSetChatOptions(); }
        if (bleedingInput) { bleedingInput.value = bleedingDays(s,who); bleedingInput.disabled = !canSetChatOptions(); }
        const block=el(`repro-biology-${who}`) || document.querySelector(`.repro-biology-${who}`);
        if(block)block.style.display=isTracked(who)?'':'none';
        const title=el(`repro-biology-title-${who}`);
        if(title)title.textContent=`${who==='user'?'Me':'Bot'} (${carrierName(who)})`;
        const cycBlock=document.querySelector(`.repro-cycle-config-${who}`);
        if(cycBlock)cycBlock.style.display=(hasMenstrualCycle(s,who)||hasOvulation(s,who))?'grid':'none';
        for(const [cap,key,value] of [['carry','carry',canCarry(s,who)],['bleed','bleed',hasMenstrualCycle(s,who)],['ovulate','ovulate',hasOvulation(s,who)]]){
            const checkbox=el(`repro-cap-${cap}-${who}`);
            if(checkbox){checkbox.checked=value;checkbox.disabled=!chatOptionsEnabled;}
        }
        const sex=el(`repro-sex-${who}`);
        if(sex){sex.value=s[who==='char'?'sexChar':'sexUser']||'unspecified';sex.disabled=!chatOptionsEnabled;}
        const heatBlock=document.querySelector(`.repro-heat-config-${who}`);
        if(heatBlock)heatBlock.style.display=isOmegaverse(s)?'':'none';
        const h=heatSettings(s,who);
        const heatControls={mode:h.mode,frequency:h.frequency,duration:h.duration,anchor:h.anchor,fertility:h.fertility};
        for(const [field,value] of Object.entries(heatControls)){
            const ctrl=el(`repro-heat-${field}-${who}`);
            if(ctrl){ctrl.value=value;ctrl.disabled=!chatOptionsEnabled;}
        }
        const independent=document.querySelector(`.repro-heat-independent-${who}`);
        if(independent)independent.style.display=h.mode==='independent'?'grid':'none';
        const ppCarrier=who==='char'?getPartnerData():p;
        const ppConfig=document.querySelector(`.repro-postpartum-config-${who}`);
        if(ppConfig)ppConfig.style.display=ppCarrier.postpartum?'':'none';
        const ppFeeding=el(`repro-postpartum-feeding-${who}`);
        if(ppFeeding)ppFeeding.value=ppCarrier.postpartum?.feeding || (ppCarrier.postpartum?.lactating===true?'breastfeeding':ppCarrier.postpartum?.lactating===false?'formula':'unknown');
        const ppMode=el(`repro-postpartum-mode-${who}`);
        if(ppMode)ppMode.value=s[who==='char'?'postpartumReturnModeChar':'postpartumReturnModeUser']||'estimated';
        const ppDays=el(`repro-postpartum-days-${who}`);
        if(ppDays){ppDays.value=s[who==='char'?'postpartumReturnDaysChar':'postpartumReturnDaysUser']||90;ppDays.disabled=ppMode?.value!=='custom';}
        const profile=getParentProfile(who);
        const parentBlock=document.querySelector(`.repro-parent-${who}`);
        if(parentBlock)parentBlock.style.display='';
        const parentHeading=el(`repro-parent-heading-${who}`);
        if(parentHeading)parentHeading.textContent=`${who==='user'?'Parent A':'Parent B'} · ${carrierName(who)}`;
        for(const field of PROFILE_FIELDS){const ctrl=el(`repro-parent-${who}-${field}`);if(ctrl && document.activeElement!==ctrl)ctrl.value=profile[field]||'';}
        const fetusBox=document.querySelector(`.repro-fetus-edit-${who}`);
        const carrier=who==='char'?getPartnerData():p;
        if(fetusBox)fetusBox.style.display=isTracked(who) && carrier.isPregnant?'':'none';
        const fetusInput=el(`repro-fetus-${who}`);
        if(fetusInput && document.activeElement!==fetusInput)fetusInput.value=(carrier.fetusSex||[]).join(',');
    }
    const botDuration = el('repro-duration-char');
    if (botDuration) { botDuration.value = pregnancyLength(s,'char'); botDuration.disabled = !canSetChatOptions(); botDuration.closest('div')?.classList.toggle('repro-untracked',!isTracked('char')); }
    const babyBasis=el('repro-baby-graduation-basis');
    if(babyBasis){babyBasis.value=s.babyGraduationBasis||'developmental';babyBasis.disabled=!chatOptionsEnabled;}
    const dating=el('repro-pregnancy-dating');
    if(dating){dating.value=s.pregnancyDatingMode||'conception';dating.disabled=!chatOptionsEnabled;}
    const babySelect=el('repro-baby-genetics-select');
    if(babySelect){
       const babies=p.babies||[];
       const fieldsContainer=el('repro-baby-edit-fields');
       if(fieldsContainer)fieldsContainer.style.display=babies.length?'':'none';
       const selected=Number(babySelect.value);
       const previous=babySelect.value;
       babySelect.innerHTML=babies.map((b,i)=>`<option value="${i}">${escapeLabel(b.name||'Baby '+(i+1))} (${escapeLabel(b.species||'Unknown')})</option>`).join('')||'<option value="">No babies in this chat</option>';
       if(Number.isInteger(selected) && selected>=0 && selected<babies.length)babySelect.value=previous;
       const b=babies[Number(babySelect.value)];
       const genome=b?.genetics||{};
       const fields={sex:b?.sex||'?',developmentRate:b?.developmentRate||s.babyDevelopmentRate||1,species:b?.species||genome.species||'',hair:genome.hair||'',eyes:genome.eyes||'',skin:genome.skin||'',face:genome.face||'',height:genome.height||'',traits:(genome.traits||[]).join(', '),abilities:(genome.abilities||[]).join(', ')};
       for(const [key,value] of Object.entries(fields)){
         const ctrl=el(`repro-baby-edit-${key}`); if(ctrl && document.activeElement!==ctrl)ctrl.value=value;
       }
    }
    const babyRate = el('repro-baby-rate');
    if (babyRate) { babyRate.value = developmentRate(s); babyRate.disabled = !canSetChatOptions(); }
    const menstruationToggle = el('repro-menstruation-enabled');
    if (menstruationToggle) {
        menstruationToggle.checked = s.menstruationEnabled !== false;
        const row=menstruationToggle.closest('label')||menstruationToggle.parentElement;
        if(row)row.style.display='none';
    }
    const trackSel = el('repro-trackfor');
    if (trackSel) trackSel.value = s.trackFor || 'user';
    const carrierSel = el('repro-carrier-mode');
    if (carrierSel) carrierSel.value = s.carrierMode || 'user';
    const uniSel = el('repro-universe');
    if (uniSel) uniSel.value = s.universe || 'normal';
    const cycInfo = el('repro-currentcycle');
    const cycRow = el('repro-cycle-row');
    if (cycInfo) cycInfo.style.display = isTracked('user') ? '' : 'none';
    if (cycRow) cycRow.style.display = isTracked('user') && hasCycle(s, 'user') && !p.isPregnant && !(getPostpartum(p,p)&&!getPostpartum(p,p).cycleReturned) ? 'flex' : 'none';
    const partnerRow = el('repro-partner-cycle-row');
    if (partnerRow) partnerRow.style.display = isTracked('char') && hasCycle(s, 'char') && !getPartnerData().isPregnant && !(getPostpartum(getPartnerData(),p)&&!getPostpartum(getPartnerData(),p).cycleReturned) ? '' : 'none';
    const partnerDay = getPartnerData().cycleDay || 1;
    const partnerInput = el('repro-partner-cycle-day');
    if (partnerInput) { partnerInput.value = partnerDay; partnerInput.max = cycleLength(s, 'char'); }
    const partnerInfo = el('repro-partner-cycle-info');
    if (partnerInfo) {
        partnerInfo.textContent = cycleSummary('char', getPartnerData(), s);
        partnerInfo.style.color = getPartnerData().isPregnant ? 'var(--rp-pink)' : getPhaseInfo(partnerDay, 'ru', 'char').color;
    }

    const babyMaxAge = el('repro-baby-max-age');
    if (babyMaxAge) {
        const v = s.babyMaxAgeDays ?? 730;
        const validOptions = ['180', '365', '730', '1095', '1825', '0'];
        babyMaxAge.value = validOptions.includes(String(v)) ? String(v) : '730';
    }

    const durSel = el('repro-duration');
    if (durSel)durSel.value=pregnancyLength(s,'user');
    const userDurationRow=el('repro-duration-user-row');
    if(userDurationRow)userDurationRow.style.display=isTracked('user')&&canCarry(s,'user')?'flex':'none';
    const charDurationRow=el('repro-duration-char-row');
    if(charDurationRow)charDurationRow.style.display=isTracked('char')&&canCarry(s,'char')?'flex':'none';

    const cycleIn = el('repro-cycleday');
    const cycleInfo = el('repro-currentcycle');
    const _cd = getCycleDay();
    if (cycleIn) { cycleIn.value = _cd; cycleIn.max = cycleLength(s, 'user'); }
    if (cycleInfo) {
        const ph = getPhaseInfo(_cd);
        cycleInfo.textContent = cycleSummary('user', p, s);
        cycleInfo.style.color = p.isPregnant ? 'var(--rp-pink)' : ph.color;
    }

    const status = el('repro-status');
    if (status) {
        if (p.isPregnant) status.innerHTML = `<span style="color:var(--rp-pink)">Pregnant</span>`;
        else if (p.hasBaby) status.innerHTML = `<span style="color:var(--rp-blue)">Baby</span>`;
        else status.innerHTML = `<span style="opacity:0.5">None</span>`;
    }

    const ibSel = el('repro-infoblock');
    if (ibSel) ibSel.value = s.infoblockPosition || 'off';

    // ── Pregnancy monitor ──
    const pregMon = el('repro-preg-mon');
    if (pregMon) {
        if (p.isPregnant && (p.pregnancyWeeks > 0 || p.conceptionDate)) {
            pregMon.style.display = 'block';
            const dur = conceptionTerm(s, 'user',p);
            const { weeks, days } = calculateWeeksFromDates(p.conceptionDate, p.rpDate, p.pregnancyWeeks);
            const pct = Math.min(100, Math.round((weeks / dur) * 100));
            const sexVis = (weeks / dur) * 100 >= 50;
            const sexStr = sexVis && p.fetusSex?.length ? p.fetusSex.map(s => s === 'M' ? 'boy' : s==='F'?'girl':'unknown').join(', ') : '—';
            const health = getHealthInfo(p.healthStatus);
            const hCls = p.healthStatus === 'critical' ? 'crit' : p.healthStatus === 'warning' ? 'warn' : 'ok';

            let dueStr = '—';
            if (p.conceptionDate) {
                const dd = calculateDueDate(p.conceptionDate,'user',pregnancyDatingMode(p,s));
                if (dd) dueStr = dd.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }
            let conceptionStr = '—';
            if (p.conceptionDate) {
                conceptionStr = new Date(p.conceptionDate).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }

            const symptoms = getSymptomsForProgress(pct, weeks);
            const recs = getRecommendationsForProgress(pct);
            const fetusSize = (p._dynamic || {}).fetusSize || '';

            let compsHtml = '';
            if (p.complications?.length > 0) {
                const unres = p.complications.filter(c => !c.resolved);
                compsHtml = `<div class="rp-m-warn">${unres.length > 0 ? unres.map(c => c.type).join(', ') : 'All resolved'}</div>`;
                if (unres.length > 0) {
                    compsHtml += `<button id="repro-doctor-btn" class="rp-m-btn">See doctor (${unres.length})</button>`;
                }
            }

            pregMon.innerHTML = `
                <div class="rp-m-head pink">Pregnancy — ${displayPregnancyWeeks(p,s)}/${pregnancyLength(s,'user')} weeks (${pregnancyDatingMode(p,s)==='obstetric'?'gestational':'since conception'})</div>
                <div class="rp-m-progress"><div class="rp-m-progress-fill pink" style="width:${pct}%"></div></div>
                <div class="rp-m-grid">
                    <div class="rp-m-cell"><span class="rp-m-lbl">Conception</span><span class="rp-m-val">${conceptionStr}</span></div>
                    <div class="rp-m-cell"><span class="rp-m-lbl">Due date</span><span class="rp-m-val">${dueStr}</span></div>
                    <div class="rp-m-cell"><span class="rp-m-lbl">Fetus</span><span class="rp-m-val">${formatFetusCount(p.fetusCount)} (${sexStr})</span></div>
                    ${fetusSize ? `<div class="rp-m-cell"><span class="rp-m-lbl">Size</span><span class="rp-m-val">${fetusSize}</span></div>` : ''}
                    <div class="rp-m-cell"><span class="rp-m-lbl">Health</span><span class="rp-m-val rp-m-hp-${hCls}">${health.text}</span></div>
                    ${p.fatherName ? `<div class="rp-m-cell"><span class="rp-m-lbl">Second parent</span><span class="rp-m-val">${escapeLabel(p.fatherName)}</span></div>` : ''}
                </div>
                <div class="rp-m-text"><b>Symptoms:</b> ${symptoms}</div>
                <div class="rp-m-text"><b>Rec:</b> ${recs}</div>
                ${compsHtml}
                <div style="display:flex;gap:4px;align-items:center;margin-top:6px">
                    <span style="font-size:9px;opacity:0.5">Weeks:</span>
                    <input type="number" id="repro-set-weeks" min="0" max="999" value="${displayPregnancyWeeks(p,s)}" class="text_pole" style="width:50px">
                    <span style="font-size:9px;opacity:0.5">weeks</span>
                    <button id="repro-apply-weeks" class="rp-m-btn" style="flex:1">Set</button>
                </div>
                <button id="repro-reanchor-btn" class="rp-m-btn" style="margin-top:6px;background:rgba(255,255,255,0.05)">Recalculate weeks from RP date</button>`;

            setTimeout(() => {
                const db = el('repro-doctor-btn'); if (db) db.onclick = visitDoctor;
                const rb = el('repro-reanchor-btn');
                if (rb) rb.onclick = () => {
                    if (!p.rpDate) { showNotification('No RP date in chat', 'warning'); return; }
                    if (!p.conceptionDate) {
                        showNotification('Conception date is missing — set it in Manual pregnancy', 'warning');
                        return;
                    }
                    // Internal implementation note.
                    // Internal implementation note.
                    const conceptionMs = new Date(p.conceptionDate).getTime();
                    const rpMs = new Date(p.rpDate).getTime();
                    if (rpMs < conceptionMs) {
                        showNotification('RP date is earlier than conception date — recalculation is not possible', 'warning');
                        return;
                    }
                    const newWeeks = Math.floor((rpMs - conceptionMs) / (7 * 86400000));
                    p.pregnancyWeeks = newWeeks;
                    p._conceptionAnchored = true;
                    p._userSetWeeksAt = Date.now();
                    import('./message-handler.js').then(m => m.refreshRegenSnapshot && m.refreshRegenSnapshot());
                    saveSettingsDebounced();
                    const cDateStr = new Date(p.conceptionDate).toLocaleDateString('en-US');
                    const rDateStr = new Date(p.rpDate).toLocaleDateString('en-US');
                    showNotification(`Weeks recalculated: ${cDateStr} → ${rDateStr} = ${displayPregnancyWeeks(p,s)} displayed weeks`, 'success');
                    syncUI();
                    updatePromptInjection();
                };
                // Internal implementation note.
                const ab = el('repro-apply-weeks');
                if (ab) ab.onclick = () => {
                    const input = el('repro-set-weeks');
                    const displayedWeeks = Math.max(0, Math.min(999, parseInt(input?.value) || 0));
                    const elapsedWeeks = Math.max(0,displayedWeeks-(pregnancyDatingMode(p,s)==='obstetric'?2:0));
                    setManualPregnancyWeeks('user', elapsedWeeks);
                    saveSettingsDebounced();
                    showNotification(`Pregnancy progress set: ${displayedWeeks} displayed weeks`, 'success');
                    syncUI();
                    updatePromptInjection();
                    setTimeout(() => {
                        import('./message-handler.js').then(m => m.renderInfoblock());
                    }, 100);
                };
            }, 10);
        } else {
            pregMon.style.display = 'none';
        }
    }

    // Internal implementation note.
    const partnerMon = el('repro-partner-mon');
    if (partnerMon) {
        const c = isTracked('char') ? getPartnerData() : null;
        if (c && c.isPregnant) {
            partnerMon.style.display = 'block';
            const dur = conceptionTerm(s,'char',c);
            const { weeks } = calculateWeeksFromDates(c.conceptionDate, p.rpDate, c.pregnancyWeeks);
            const pct = Math.min(100, Math.round((weeks / dur) * 100));
            const sexStr = c.fetusSexRevealed && c.fetusSex?.length ? c.fetusSex.map(x => x === 'M' ? 'boy' : x==='F'?'girl':'unknown').join(', ') : '—';
            let dueStr = '—';
            if (c.conceptionDate) {
                const dd = calculateDueDate(c.conceptionDate, 'char',pregnancyDatingMode(c,s));
                if (dd) dueStr = dd.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }
            partnerMon.innerHTML = `
                <div class="rp-m-head pink">${carrierName('char')} — ${displayPregnancyWeeks(c,s)}/${pregnancyLength(s,'char')} weeks (${pregnancyDatingMode(c,s)==='obstetric'?'gestational':'since conception'})</div>
                <div class="rp-m-progress"><div class="rp-m-progress-fill pink" style="width:${pct}%"></div></div>
                <div class="rp-m-grid">
                    <div class="rp-m-cell"><span class="rp-m-lbl">Due date</span><span class="rp-m-val">${dueStr}</span></div>
                    <div class="rp-m-cell"><span class="rp-m-lbl">Fetus</span><span class="rp-m-val">${formatFetusCount(c.fetusCount)} (${sexStr})</span></div>
                    ${c.fatherName ? `<div class="rp-m-cell"><span class="rp-m-lbl">Second parent</span><span class="rp-m-val">${escapeLabel(c.fatherName)}</span></div>` : ''}
                </div>
                <div style="display:flex;gap:4px;margin-top:6px">
                    <button id="repro-partner-birth" class="rp-m-btn" style="flex:1">Deliver baby</button>
                    <button id="repro-partner-reset" class="rp-m-btn" style="flex:1;background:rgba(255,80,80,0.12)">Reset</button>
                </div>`;
            setTimeout(() => {
                const bb = el('repro-partner-birth');
                if (bb) bb.onclick = () => {
                    if (!confirm(`Deliver ${carrierName('char')} now? A naming dialog will open.`)) return;
                    import('./pregnancy.js').then(m => m.partnerBirth(null, { source: 'manual' }));
                };
                const rb2 = el('repro-partner-reset');
                if (rb2) rb2.onclick = () => {
                    if (!confirm(`Reset ${carrierName('char')}'s pregnancy?`)) return;
                    resetPartnerPregnancy();
                    showNotification('Reset', 'info');
                };
            }, 10);
        } else {
            partnerMon.style.display = 'none';
        }
    }

    // Internal implementation note.
    const manualWhoRow = el('repro-manual-who-row');
    if (manualWhoRow) manualWhoRow.style.display = (s.trackFor === 'both') ? 'flex' : 'none';
    const manualWhoSel = el('repro-manual-who');
    if (manualWhoSel && s.trackFor !== 'both') manualWhoSel.value = (s.trackFor === 'char') ? 'char' : 'user';

    const manualParent = el('repro-manual-second-parent');
    const manualCarrier = manualWhoSel?.value === 'char' ? getPartnerData() : p;
    if (manualParent && document.activeElement !== manualParent && manualCarrier.isPregnant) manualParent.value = manualCarrier.fatherName || '';

    const resetBtn = el('repro-reset');
    if (resetBtn) resetBtn.style.display = p.isPregnant ? 'block' : 'none';

    const forceBirthBtn = el('repro-force-birth-btn');
    if (forceBirthBtn) forceBirthBtn.style.display = p.isPregnant ? 'block' : 'none';

    // ── Baby monitor ──
    const babyMon = el('repro-baby-mon');
    const resetBabyBtn = el('repro-reset-baby');
    const undoManualBtn=el('repro-undo-manual-delivery');
    if(undoManualBtn)undoManualBtn.style.display=p._manualDeliveryBackup?'block':'none';
    if (babyMon) {
        if (p.hasBaby) {
            babyMon.style.display = 'block';
            if (resetBabyBtn) resetBabyBtn.style.display = 'block';
            const babies = p.babies && p.babies.length > 0 ? p.babies : [{ name: p.babyName, health: p.babyHealth || 'normal', mood: p.babyMood, sleep: p.babySleep, feedingType: p.babyFeedingType, diaperClean: p.babyDiaperClean, sex: p.babySex?.[0] }];
            let monHtml = '';
            babies.forEach((baby, i) => {
                const bh = getHealthInfo(baby.health || 'normal');
                const bhCls = (baby.health === 'critical') ? 'crit' : (baby.health === 'warning') ? 'warn' : 'ok';
                const sexIcon = baby.sex === 'M' ? '<i class="fa-solid fa-mars"></i>' : baby.sex === 'F' ? '<i class="fa-solid fa-venus"></i>' : '';
                const headColor = baby.sex === 'F' ? 'pink' : baby.sex==='M'?'blue':'purple';
                const label = baby.name || (babies.length > 1 ? `Baby ${i + 1}` : 'unnamed');
                monHtml += `
                <div class="rp-m-head ${headColor}">${sexIcon} ${label} — ${p.babyAge || 'newborn'}</div>
                <div class="rp-m-grid">
                    <div class="rp-m-cell"><span class="rp-m-lbl">Health</span><span class="rp-m-val rp-m-hp-${bhCls}">${bh.text}</span></div>
                    <div class="rp-m-cell"><span class="rp-m-lbl">Mood</span><span class="rp-m-val">${baby.mood || '—'}</span></div>
                    <div class="rp-m-cell"><span class="rp-m-lbl">Sleep</span><span class="rp-m-val">${baby.sleep || '—'}</span></div>
                    <div class="rp-m-cell"><span class="rp-m-lbl">Feeding</span><span class="rp-m-val">${baby.feedingType || '—'}</span></div>
                    <div class="rp-m-cell"><span class="rp-m-lbl">Diaper</span><span class="rp-m-val" style="color:${baby.diaperClean !== false ? 'var(--rp-green)' : 'var(--rp-yellow)'}">${baby.diaperClean !== false ? 'Clean' : 'Change!'}</span></div>
                    ${baby.fatherName ? `<div class="rp-m-cell"><span class="rp-m-lbl">Second parent</span><span class="rp-m-val">${escapeLabel(baby.fatherName)}</span></div>` : ''}
                </div>`;
            });
            babyMon.innerHTML = monHtml;
        } else {
            babyMon.style.display = 'none';
            if (resetBabyBtn) resetBabyBtn.style.display = 'none';
        }
    }

    const stats = el('repro-stats');
    if (stats) {
        const clock = p.rpDate ? new Date(p.rpDate).toLocaleString('en-US', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'no timestamp';
        const counters = p._stats || { checks:0, conceptions:0 };
        stats.textContent = `${counters.checks} checks / ${counters.conceptions} conceptions (this chat) · RP time: ${clock}`;
    }
}

// ── setupUI ──
export function setupUI() {
    try {
        const s = getSettings();
        const html = `
<div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
        <b>${L('title')}</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
        <div class="reproductive-system-settings">
            <label class="checkbox_label"><input type="checkbox" id="repro-enabled"><span>${L('enabled')}</span></label>
            <label class="checkbox_label"><input type="checkbox" id="repro-notify"><span>${L('notifications')}</span></label>
            <hr>
            <div style="display:flex;gap:4px;align-items:center">
                <label for="repro-trackfor">Track:</label>
                <select id="repro-trackfor" class="text_pole">
                    <option value="user">Me</option><option value="char">Bot</option><option value="both">Both</option>
                </select>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
                <span>Pregnancy carriers:</span>
                <select id="repro-carrier-mode" class="text_pole">
                    <option value="user">I carry</option>
                    <option value="char">Bot carries</option>
                    <option value="both">Both carry</option>
                    <option value="none">Neither</option>
                </select>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
                <label for="repro-universe">Universe:</label>
                <select id="repro-universe" class="text_pole" title="In omegaverse mode, heat aligns with the ovulatory phase">
                    <option value="normal">Normal</option>
                    <option value="omegaverse">Omegaverse</option>
                </select>
            </div>
            <div id="repro-role-settings">
                <div class="rp-setting-row"><label for="repro-user-desig">Me:</label><select id="repro-user-desig" class="text_pole"><option value="alpha">Alpha</option><option value="beta">Beta</option><option value="omega">Omega</option></select></div>
                <div class="rp-setting-row"><label for="repro-char-desig">Character:</label><select id="repro-char-desig" class="text_pole"><option value="alpha">Alpha</option><option value="beta">Beta</option><option value="omega">Omega</option></select></div>
            </div>
            <div style="font-size:10px;font-weight:bold;margin:6px 0">Independent biology — this chat</div>
            <small style="opacity:.7;font-size:9px">Sex, designation, pregnancy capability, ovulation, menstruation and heat/rut are separate. These settings are independent for Me and Bot.</small>
            ${['user','char'].map(who=>`
              <details class="repro-biology-${who}" ${who==='user'?'open':''} style="border:1px solid rgba(160,160,160,.25);border-radius:8px;padding:6px;margin:6px 0">
                <summary style="cursor:pointer;font-size:11px"><b id="repro-biology-title-${who}">${who==='user'?'Me':'Bot'}</b></summary>
                <label style="display:block;font-size:10px;margin-top:5px">Biological sex (informational)
                  <select id="repro-sex-${who}" class="text_pole" style="width:100%">
                    <option value="unspecified">Unspecified</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other / fantasy</option>
                  </select>
                </label>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin:5px 0">
                  <label style="font-size:9px"><input type="checkbox" id="repro-cap-carry-${who}"> Can carry</label>
                  <label style="font-size:9px"><input type="checkbox" id="repro-cap-bleed-${who}"> Menstruates</label>
                  <label style="font-size:9px"><input type="checkbox" id="repro-cap-ovulate-${who}"> Ovulates</label>
                </div>
                <div class="repro-cycle-config-${who}" style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:6px 0">
                  <label style="font-size:10px">Cycle days<input id="repro-cycle-length-${who}" type="number" class="text_pole" min="7" max="365" style="width:100%"></label>
                  <label style="font-size:10px">Bleeding days<input id="repro-bleeding-days-${who}" type="number" class="text_pole" min="0" max="30" style="width:100%"></label>
                </div>
                <div class="repro-heat-config-${who}" style="margin-top:6px">
                  <label style="display:block;font-size:10px">Heat/rut timing
                    <select id="repro-heat-mode-${who}" class="text_pole" style="width:100%">
                      <option value="linked">Linked to ovulation phase</option><option value="independent">Independent supernatural cycle</option><option value="off">No heat/rut</option>
                    </select>
                  </label>
                  <div class="repro-heat-independent-${who}" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px">
                    <label style="font-size:9px">Every (days)<input id="repro-heat-frequency-${who}" type="number" class="text_pole" min="1" max="365" style="width:100%"></label>
                    <label style="font-size:9px">Duration (days)<input id="repro-heat-duration-${who}" type="number" class="text_pole" min="1" max="365" style="width:100%"></label>
                    <label style="font-size:9px;grid-column:1 / -1">Independent heat/rut anchor (auto-set at first RP date)<input id="repro-heat-anchor-${who}" type="date" class="text_pole" style="width:100%"></label>
                  </div>
                  <label style="display:block;font-size:9px;margin-top:4px">Effect on fertility
                    <select id="repro-heat-fertility-${who}" class="text_pole" style="width:100%">
                      <option value="none">No change</option><option value="boost">Higher fertility during heat</option><option value="required">Conception only during heat</option>
                    </select>
                  </label>
                </div>
                <div class="repro-postpartum-config-${who}" style="border-top:1px solid rgba(160,160,160,.2);margin-top:8px;padding-top:8px">
                  <b style="font-size:10px">Postpartum recovery</b>
                  <label style="font-size:10px;display:block">Feeding status
                    <select id="repro-postpartum-feeding-${who}" class="text_pole" style="width:100%">
                      <option value="unknown">Not established</option><option value="breastfeeding">Breastfeeding</option><option value="mixed">Mixed feeding</option><option value="formula">Formula / not breastfeeding</option>
                    </select>
                  </label>
                  <label style="font-size:10px;display:block">Cycle return mode
                    <select id="repro-postpartum-mode-${who}" class="text_pole" style="width:100%">
                      <option value="estimated">Estimated from feeding</option><option value="custom">Custom days after birth</option><option value="manual">Story event / manual only</option>
                    </select>
                  </label>
                  <label style="font-size:10px;display:block">Custom days to cycle return
                    <input type="number" min="1" max="3650" id="repro-postpartum-days-${who}" class="text_pole" style="width:100%">
                  </label>
                  <button type="button" class="menu_button" id="repro-postpartum-resume-${who}" style="width:100%">Cycle has returned</button>
                  <button type="button" class="menu_button" id="repro-postpartum-clear-${who}" style="width:100%">Clear postpartum recovery (explicit reset)</button>
                </div>
              </details>`).join('')}
            <small style="opacity:.6;font-size:9px">Fertility is an illustrative RP simulation, not a real-world medical predictor. Existing chats retain their previous capability defaults until you change them.</small>
            <div id="repro-partner-cycle-row">
                <span id="repro-partner-cycle-info"></span>
                <input id="repro-partner-cycle-day" class="text_pole" type="number" min="1" max="365">
                <button id="repro-partner-cycle-set" class="menu_button">Set bot cycle day</button>
            </div>
            <hr>
            <label class="checkbox_label" title="Hide unconfirmed pregnancy; use tests, disclosure, and current scene facts"><input type="checkbox" id="repro-hidden-preg"><span>Hidden pregnancy (test)</span></label>
            <label style="font-size:10px;display:block;margin:6px 0">Pregnancy week convention
              <select id="repro-pregnancy-dating" class="text_pole" style="width:100%">
                <option value="conception">Since conception (legacy / fantasy)</option>
                <option value="obstetric">Gestational / obstetric (+2 weeks; new pregnancies)</option>
              </select>
            </label>
            <details style="border:1px solid rgba(155,155,155,.25);padding:7px;border-radius:8px;margin:6px 0">
              <summary style="cursor:pointer;font-size:11px"><b>Parent profiles & fantasy baby genetics</b></summary>
              <small style="opacity:.7;font-size:9px">Both parents are available regardless of Track mode. Known traits are read from the active persona and current character card; manual edits take priority. Unrecognized traits remain unknown. Born children keep their saved traits.</small>
              ${['user','char'].map(who=>`<div class="repro-parent-${who}" style="padding:4px 0">
                <b id="repro-parent-heading-${who}" style="font-size:10px">${who==='user'?'Parent A':'Parent B'}</b>
                ${[['species','Species'],['hair','Hair'],['eyes','Eyes'],['skin','Skin / undertone'],['face','Facial traits'],['height','Adult height (cm)'],['traits','Supernatural traits'],['abilities','Abilities']].map(([field,label])=>`
                  <label style="display:block;font-size:9px;margin:3px 0">${label}<input class="text_pole" style="width:100%" id="repro-parent-${who}-${field}" maxlength="350" placeholder="Optional"></label>`).join('')}
                <label style="display:block;font-size:9px">Paste labeled character-card details (optional)
                  <textarea id="repro-parent-import-${who}" class="text_pole" rows="3" style="width:100%" placeholder="Species: Elf; Hair: silver; Eyes: violet; ..."></textarea>
                </label>
                <button class="menu_button" id="repro-parent-extract-${who}" type="button" style="width:100%;font-size:10px">Extract labeled fields</button>
              </div>`).join('')}
            </details>
            <details style="border:1px solid rgba(155,155,155,.25);padding:7px;border-radius:8px;margin:6px 0">
              <summary style="cursor:pointer;font-size:11px"><b>Individual fetus / baby overrides</b></summary>
              <small style="font-size:9px;opacity:.7">Use M, F or ? for each fetus (e.g. M,F for twins). Changes are deliberate overrides; AI reveals cannot silently alter established baby records.</small>
              ${['user','char'].map(who=>`<div class="repro-fetus-edit-${who}" style="margin:6px 0">
                <b style="font-size:10px">${who==='user'?'Me':'Bot'} fetus sex</b>
                <div style="display:flex;gap:4px"><input id="repro-fetus-${who}" class="text_pole" placeholder="M,F or ?" style="flex:1;min-width:0"><button id="repro-fetus-set-${who}" class="menu_button">Save</button></div>
              </div>`).join('')}
              <label style="font-size:10px">Existing baby
                <select id="repro-baby-genetics-select" class="text_pole" style="width:100%"></select>
              </label>
              <div id="repro-baby-edit-fields">
              <label style="font-size:10px">Sex<select id="repro-baby-edit-sex" class="text_pole" style="width:100%"><option value="?">Unknown</option><option value="M">Boy</option><option value="F">Girl</option></select></label>
              <label style="font-size:10px">Baby's individual development multiplier<input type="number" min="0.25" max="10" step="0.25" id="repro-baby-edit-developmentRate" class="text_pole" style="width:100%"></label>
              <label style="font-size:10px">Species / hybrid<input id="repro-baby-edit-species" class="text_pole" maxlength="150" style="width:100%"></label>
              <label style="font-size:10px">Hair<input id="repro-baby-edit-hair" class="text_pole" style="width:100%"></label>
              <label style="font-size:10px">Eyes<input id="repro-baby-edit-eyes" class="text_pole" style="width:100%"></label>
              <label style="font-size:10px">Skin<input id="repro-baby-edit-skin" class="text_pole" style="width:100%"></label>
              <label style="font-size:10px">Facial traits<input id="repro-baby-edit-face" class="text_pole" style="width:100%"></label>
              <label style="font-size:10px">Adult height estimate<input id="repro-baby-edit-height" class="text_pole" style="width:100%"></label>
              <label style="font-size:10px">Inherited traits (comma-separated)<input id="repro-baby-edit-traits" class="text_pole" style="width:100%"></label>
              <label style="font-size:10px">Abilities (comma-separated)<input id="repro-baby-edit-abilities" class="text_pole" style="width:100%"></label>
              <button id="repro-baby-genetics-save" class="menu_button" style="width:100%">Save baby's established traits</button>
              </div>
            </details>
            <div style="font-size:10px;opacity:.65;margin-top:4px">Story settings (including contraception, pregnancy length, carrier, universe, and cycles) are saved per chat. Confirmed RP changes can update contraception automatically.</div>
            <div id="repro-contraception-last" style="font-size:10px;opacity:.8;margin:3px 0"></div>
            <div id="repro-contraception-user-box" style="display:flex;gap:4px;align-items:center">
                <span id="repro-contra-user-label" style="font-size:9px;opacity:0.5">Contraception {{user}}:</span>
                <select id="repro-contraception-user" class="text_pole" style="flex:1">
                    <option value="none">None</option>
                    <option value="condom">External condom</option>
                    <option value="pill">Birth control pill</option>
                    <option value="iud">IUD</option>
                    <option value="implant">Contraceptive implant</option>
                    <option value="injection">Contraceptive injection / shot</option>
                    <option value="patch">Contraceptive patch</option>
                    <option value="ring">Vaginal ring</option>
                    <option value="internal_condom">Internal condom</option>
                    <option value="diaphragm">Diaphragm</option>
                    <option value="cervical_cap">Cervical cap</option>
                    <option value="spermicide">Spermicide</option>
                    <option value="withdrawal">Withdrawal</option>
                    <option value="fertility_awareness">Fertility awareness / rhythm</option>
                    <option value="historical_condom">Historical membrane condom</option>
                    <option value="historical_sponge">Historical sponge / barrier</option>
                </select>
            </div>
            <div id="repro-contra-extra-user" style="margin:3px 0 8px;padding:7px;border:1px solid var(--SmartThemeBorderColor);border-radius:6px;display:none;font-size:11px">
                <div id="repro-status-user" style="font-size:10px;opacity:.8;margin-bottom:4px"></div>
                <div style="font-weight:bold;margin-bottom:5px">Optional second method and use details (this chat)</div>
                <div style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
                    <label for="repro-backup-user" style="min-width:95px">Second method:</label>
                    <select id="repro-backup-user" class="text_pole" style="flex:1">
                      <option value="none">None</option><option value="condom">External condom</option><option value="internal_condom">Internal condom</option>
                      <option value="diaphragm">Diaphragm</option><option value="cervical_cap">Cervical cap</option>
                      <option value="spermicide">Spermicide</option><option value="withdrawal">Withdrawal</option>
                      <option value="fertility_awareness">Fertility awareness</option><option value="historical_condom">Historical membrane condom</option>
                      <option value="historical_sponge">Historical sponge</option>
                    </select>
                </div>
                <div id="repro-pill-options-user" style="display:none;margin-bottom:5px">
                    <label for="repro-missed-user">Active pill adherence:</label>
                    <select id="repro-missed-user" class="text_pole" style="width:100%">
                      <option value="normal">Taking pills as scheduled</option>
                      <option value="one">One missed active combined pill (still protected)</option>
                      <option value="multiple">2+ missed active pills (backup needed; clear manually after 7 active pills)</option>
                    </select>
                </div>
                <div id="repro-implant-options-user" style="display:none;margin-bottom:5px">
                    <label for="repro-implant-status-user">Implant:</label>
                    <select id="repro-implant-status-user" class="text_pole" style="width:100%">
                      <option value="active">Inserted (check replacement date)</option>
                      <option value="not_inserted">Not inserted yet</option>
                      <option value="removed">Removed</option>
                      <option value="expired">Expired (manual)</option>
                    </select>
                    <div style="display:flex;align-items:center;gap:5px;margin-top:4px">
                        <label for="repro-implant-expiry-user">Replace by (RP):</label>
                        <input id="repro-implant-expiry-user" type="date" class="text_pole" style="flex:1;min-width:0">
                    </div>
                </div>
                <div id="repro-schedule-options-user" style="display:none;margin:5px 0">
                  <label for="repro-method-due-user">Next renewal due in RP time:</label>
                  <input type="date" id="repro-method-due-user" class="text_pole" style="width:100%">
                  <small style="opacity:.6">Shot: ~13 weeks; patch: ~7 days; ring: ~21 days (simplified gameplay).</small>
                </div>
                    <div style="opacity:.65;font-size:10px">These controls also respond to confirmed RP events. Dates use story time; review AI-detected changes. Do not combine internal and external condoms.</div>
            </div>
            <div id="repro-contraception-char-box" style="display:none;gap:4px;align-items:center">
                <span id="repro-contra-char-label" style="font-size:9px;opacity:0.5">Contraception {{char}}:</span>
                <select id="repro-contraception-char" class="text_pole" style="flex:1">
                    <option value="none">None</option>
                    <option value="condom">External condom</option>
                    <option value="pill">Birth control pill</option>
                    <option value="iud">IUD</option>
                    <option value="implant">Contraceptive implant</option>
                    <option value="injection">Contraceptive injection / shot</option>
                    <option value="patch">Contraceptive patch</option>
                    <option value="ring">Vaginal ring</option>
                    <option value="internal_condom">Internal condom</option>
                    <option value="diaphragm">Diaphragm</option>
                    <option value="cervical_cap">Cervical cap</option>
                    <option value="spermicide">Spermicide</option>
                    <option value="withdrawal">Withdrawal</option>
                    <option value="fertility_awareness">Fertility awareness / rhythm</option>
                    <option value="historical_condom">Historical membrane condom</option>
                    <option value="historical_sponge">Historical sponge / barrier</option>
                </select>
            </div>
            <div id="repro-contra-extra-char" style="margin:3px 0 8px;padding:7px;border:1px solid var(--SmartThemeBorderColor);border-radius:6px;display:none;font-size:11px">
                <div id="repro-status-char" style="font-size:10px;opacity:.8;margin-bottom:4px"></div>
                <div style="font-weight:bold;margin-bottom:5px">Optional second method and use details (this chat)</div>
                <div style="display:flex;gap:5px;align-items:center;margin-bottom:5px">
                    <label for="repro-backup-char" style="min-width:95px">Second method:</label>
                    <select id="repro-backup-char" class="text_pole" style="flex:1">
                      <option value="none">None</option><option value="condom">External condom</option><option value="internal_condom">Internal condom</option>
                      <option value="diaphragm">Diaphragm</option><option value="cervical_cap">Cervical cap</option>
                      <option value="spermicide">Spermicide</option><option value="withdrawal">Withdrawal</option>
                      <option value="fertility_awareness">Fertility awareness</option><option value="historical_condom">Historical membrane condom</option>
                      <option value="historical_sponge">Historical sponge</option>
                    </select>
                </div>
                <div id="repro-pill-options-char" style="display:none;margin-bottom:5px">
                    <label for="repro-missed-char">Active pill adherence:</label>
                    <select id="repro-missed-char" class="text_pole" style="width:100%">
                      <option value="normal">Taking pills as scheduled</option>
                      <option value="one">One missed active combined pill (still protected)</option>
                      <option value="multiple">2+ missed active pills (backup needed; clear manually after 7 active pills)</option>
                    </select>
                </div>
                <div id="repro-implant-options-char" style="display:none;margin-bottom:5px">
                    <label for="repro-implant-status-char">Implant:</label>
                    <select id="repro-implant-status-char" class="text_pole" style="width:100%">
                      <option value="active">Inserted (check replacement date)</option>
                      <option value="not_inserted">Not inserted yet</option>
                      <option value="removed">Removed</option>
                      <option value="expired">Expired (manual)</option>
                    </select>
                    <div style="display:flex;align-items:center;gap:5px;margin-top:4px">
                        <label for="repro-implant-expiry-char">Replace by (RP):</label>
                        <input id="repro-implant-expiry-char" type="date" class="text_pole" style="flex:1;min-width:0">
                    </div>
                </div>
                    <div id="repro-schedule-options-char" style="display:none;margin:5px 0">
                  <label for="repro-method-due-char">Next renewal due in RP time:</label>
                  <input type="date" id="repro-method-due-char" class="text_pole" style="width:100%">
                  <small style="opacity:.6">Shot: ~13 weeks; patch: ~7 days; ring: ~21 days (simplified gameplay).</small>
                </div>
                <div style="opacity:.65;font-size:10px">These controls also respond to confirmed RP events. Dates use story time; review AI-detected changes. Do not combine internal and external condoms.</div>
            </div>
            <div id="repro-duration-user-row" style="display:flex;gap:4px;align-items:center">
                <label for="repro-duration" style="font-size:10px">My pregnancy length:</label>
                <input type="number" id="repro-duration" class="text_pole" min="1" max="999" style="flex:1;min-width:0">
                <span style="font-size:10px">weeks</span>
            </div>
            <div id="repro-duration-char-row" style="display:flex;gap:4px;align-items:center;margin:4px 0">
                <label style="font-size:10px" for="repro-duration-char">Character pregnancy length:</label>
                <input type="number" id="repro-duration-char" class="text_pole" style="flex:1;min-width:0" min="1" max="999">
                <span style="font-size:10px">weeks</span>
            </div>
            <div style="display:flex;gap:4px;align-items:center;margin:4px 0">
                <label style="font-size:10px" for="repro-baby-rate">Baby development:</label>
                <input type="number" id="repro-baby-rate" class="text_pole" style="flex:1;min-width:0" min="0.25" max="10" step="0.25">
                <span style="font-size:10px">× speed</span>
            </div>
            <label style="display:block;font-size:10px;margin:4px 0">Baby tracking limit based on
              <select id="repro-baby-graduation-basis" class="text_pole" style="width:100%">
                <option value="developmental">Developmental age (fantasy)</option>
                <option value="chronological">Actual time since birth</option>
              </select>
            </label>
            <div style="display:flex;gap:4px;align-items:center" title="After this age the child leaves the infoblock but remains in the family, without diaper/feeding tracking.">
                <span style="font-size:9px;opacity:0.5">Baby tracking until:</span>
                <select id="repro-baby-max-age" class="text_pole" style="flex:1">
                    <option value="180">6 months</option>
                    <option value="365">1 year</option>
                    <option value="730">2 years</option>
                    <option value="1095">3 years</option>
                    <option value="1825">5 years</option>
                    <option value="0">Never (manual)</option>
                </select>
            </div>
            <hr>
            <div id="repro-currentcycle" class="rp-cycle-info"></div>
            <div id="repro-cycle-row" style="display:flex;gap:4px;align-items:center">
                <span style="font-size:9px;opacity:0.5">Cycle day:</span>
                <input type="number" id="repro-cycleday" min="1" max="365" value="${getCycleDay()}" class="text_pole" style="width:45px">
                <button id="repro-setcycle" class="menu_button">${ic('fa-check')}</button>
            </div>
            <hr>
            <div style="font-size:10px;opacity:0.7">Status: <span id="repro-status"></span></div>
            <div id="repro-preg-mon" class="rp-m" style="display:none"></div>
            <div id="repro-partner-mon" class="rp-m" style="display:none"></div>
            <div id="repro-baby-mon" class="rp-m" style="display:none"></div>
            <button id="repro-family-tree-btn" class="menu_button" style="width:100%"><i class="fa-solid fa-people-roof" style="margin-right:6px;color:rgba(130,200,255,.8)"></i>Family tree</button>
            <button id="repro-force-birth-btn" class="menu_button" style="width:100%;display:none"><i class="fa-solid fa-baby" style="margin-right:6px;color:rgba(255,120,180,.8)"></i>Deliver now</button>
            <hr>
            <div style="display:flex;gap:4px;align-items:stretch">
                <div id="repro-manual-toggle" class="menu_button" style="flex:1;font-size:10px;text-align:center;cursor:pointer">Manual pregnancy / baby ▼</div>
                <div id="repro-css-toggle" class="menu_button" style="flex:1;font-size:10px;text-align:center;cursor:pointer">Infoblock CSS ▼</div>
                <div id="repro-theme-btn" class="menu_button" style="flex:0 0 auto;font-size:10px;padding:0 9px;text-align:center;cursor:pointer" title="Style"><i class="fa-solid fa-palette"></i></div>
            </div>
            <div id="repro-manual-panel" style="display:none;gap:4px;flex-direction:column">
                <small style="opacity:0.5;font-size:9px;font-weight:600">Pregnancy</small>
                <div style="display:flex;gap:4px;align-items:center" id="repro-manual-who-row">
                    <span style="font-size:9px;opacity:0.5;min-width:62px">Carrier:</span>
                    <select id="repro-manual-who" class="text_pole" style="flex:1">
                        <option value="user">Me</option>
                        <option value="char">Character</option>
                    </select>
                </div>
                <div style="display:flex;gap:4px;align-items:center">
                    <span style="font-size:9px;opacity:0.5;min-width:62px">Conception:</span>
                    <input type="date" id="repro-manual-conception-date" class="text_pole" style="flex:1" title="RP date (not real-world). Weeks are calculated from this date to the current RP_DATE in chat.">
                </div>
                <div style="display:flex;gap:4px;align-items:center">
                    <span style="font-size:9px;opacity:0.5;min-width:62px">Fetuses:</span>
                    <input type="number" id="repro-manual-fetus" min="1" max="4" value="1" class="text_pole" style="width:42px">
                    <select id="repro-manual-sex" class="text_pole" style="flex:1">
                        <option value="random">Sex: random</option>
                        <option value="M">All boys</option>
                        <option value="F">All girls</option>
                        <option value="individual">Individual (below)</option>
                    </select>
                </div>
                <input type="text" id="repro-manual-sex-individual" class="text_pole" maxlength="25" placeholder="Individual sexes: M,F,? (one per fetus)" style="width:100%">
                <label for="repro-manual-second-parent" style="font-size:11px">Second parent</label>
                <input type="text" id="repro-manual-second-parent" class="text_pole" maxlength="80" placeholder="Second parent name" title="For the current pregnancy, the name is saved on completion; for a new one, it is saved when starting pregnancy.">
                <button id="repro-manual-start" class="menu_button" style="width:100%">Start pregnancy</button>
                <small style="opacity:0.5;font-size:9px;font-weight:600;margin-top:4px">Baby <span style="font-weight:400;opacity:0.7">(added to existing)</span></small>
                <div style="display:flex;gap:4px;align-items:center">
                    <input type="text" id="repro-mb-name" class="text_pole" style="flex:1" maxlength="60" placeholder="Name">
                    <select id="repro-mb-sex" class="text_pole" style="width:80px">
                        <option value="M">Boy</option>
                        <option value="F">Girl</option><option value="?">Unknown</option>
                    </select>
                </div>
                <div style="display:flex;gap:4px;align-items:center">
                    <input type="number" id="repro-mb-age-days" class="text_pole" style="width:52px" min="0" max="999" value="0" title="Baby age">
                    <select id="repro-mb-age-unit" class="text_pole" style="width:74px">
                        <option value="d">days</option>
                        <option value="m">months</option>
                        <option value="y">years</option>
                    </select>
                    <input type="text" id="repro-mb-father" class="text_pole" style="flex:1" maxlength="60" placeholder="Second parent (optional)">
                </div>
                <input type="text" id="repro-mb-personality" class="text_pole" maxlength="200" placeholder="Personality: calm, curious (comma-separated)" title="Personality traits, comma-separated — added to the infoblock and model prompt">
                <input type="text" id="repro-mb-appearance" class="text_pole" maxlength="200" placeholder="Appearance: mother's eyes, dark hair (comma-separated)" title="Appearance traits, comma-separated — added to the infoblock and model prompt">
                <button id="repro-manual-baby-add" class="menu_button" style="width:100%">Add baby</button>
                <button id="repro-reset" class="menu_button redWarningBG" style="width:100%;display:none">Reset preg.</button>
                <button id="repro-reset-baby" class="menu_button redWarningBG" style="width:100%;display:none">Remove baby from tracking (keep postpartum)</button>
                <button id="repro-undo-manual-delivery" class="menu_button" style="width:100%;display:none">Undo manual delivery / restore pre-birth state</button>
                <button id="repro-undo" class="menu_button" style="width:100%">↶ Undo last reset/deletion</button>
            </div>
            <hr>
            <div style="display:flex;gap:4px;align-items:center">
                <span style="font-size:9px;opacity:0.5">Infoblock:</span>
                <select id="repro-infoblock" class="text_pole" style="flex:1">
                    <option value="off">Off</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                </select>
            </div>
            <label style="display:flex;gap:6px;align-items:center;font-size:10px;cursor:pointer">
                <input type="checkbox" id="repro-light-mode">
                <span>Light theme</span>
            </label>
            <label style="display:flex;gap:6px;align-items:center;font-size:10px;cursor:pointer" title="Cycle becomes part of RP: hygiene and leaks during menstruation, phase-based symptoms, cycle disruptions from stress or illness">
                <input type="checkbox" id="repro-realism">
                <span>Cycle realism</span>
            </label>
            <button id="repro-purge-tags" class="menu_button" style="width:100%;font-size:10px" title="Remove technical tags from messages in this chat — the model will no longer see them">Remove tags from chat</button>
            <div id="repro-css-panel" style="display:none;flex-direction:column;gap:4px">
                <textarea id="repro-custom-css" class="text_pole" rows="10" style="font-family:monospace;font-size:10px;resize:vertical;min-height:80px;white-space:pre;tab-size:2" placeholder="/* Custom infoblock CSS */\ndetails.repro { ... }"></textarea>
                <div style="display:flex;gap:4px">
                    <button id="repro-css-apply" class="menu_button" style="flex:1">Apply</button>
                    <button id="repro-css-reset" class="menu_button" style="flex:0 0 auto">Reset</button>
                </div>
                <small style="opacity:0.35;font-size:8px">Selectors: details.repro, .repro-header, .repro-c, .repro-stat, .rp-val, .repro-bar-fill, etc. These rules override the selected style.</small>
            </div>
            <hr>
            <small id="repro-stats" style="opacity:0.3;font-size:8px">0 / 0</small>
        </div>
    </div>
</div>`;

        $('#extensions_settings2').append(html);

        // Internal implementation note.
        // Internal implementation note.
        // Internal implementation note.
        // Internal implementation note.
        const registerWandItem = (attempt = 0) => {
            if ($('#repro_wand_open').length > 0) return;
            const menu = $('#extensionsMenu');
            if (menu.length === 0) {
                if (attempt < 30) setTimeout(() => registerWandItem(attempt + 1), 400);
                return;
            }
            const wandItem = $(`
                <div id="repro_wand_open" class="list-group-item flex-container flexGap5 interactable" tabindex="0" title="Reproduction — quick panel">
                    <div class="fa-solid fa-dna extensionsMenuExtensionButton"></div>
                    <span>Reproductive</span>
                </div>`);
            menu.append(wandItem);
            wandItem.on('click', () => { menu.hide(); showQuickBar(); });
        };
        registerWandItem();

        // Events
        $('#repro-enabled').on('change', function() {
            getSettings().isEnabled = this.checked;
            saveSettingsDebounced();
            updatePromptInjection();
            // Internal implementation note.
            // Internal implementation note.
            if (!this.checked) {
                import('./message-handler.js').then(m => {
                    if (!m.chatHasTags()) return;
                    if (!confirm('The extension is disabled, but its technical tags remain in messages — the model can still see them and continue the story. Remove the tags from this chat?')) return;
                    const n = m.purgeChatTags();
                    showNotification(`Tags removed from ${n} messages.`, 'success');
                });
            }
        });
        $('#repro-notify').on('change', function() { getSettings().showNotifications = this.checked; saveSettingsDebounced(); });
        $('#repro-baby-max-age').on('change', function() {
            const v = Number.isInteger(Number(this.value)) ? Number(this.value) : 730;
            getSettings().babyMaxAgeDays = v;
            saveSettingsDebounced();
            updatePromptInjection();
        });

        // Internal implementation note.
        $('#repro-family-tree-btn').on('click', function() {
            showFamilyTree();
        });

        $('#repro-force-birth-btn').on('click', function() {
            const p = getPregnancyData();
            if (!p.isPregnant) {
                showNotification('No pregnancy', 'warning');
                return;
            }
            if (!confirm('Deliver now? This opens the baby naming dialog and changes the state from pregnancy to baby mode.')) return;
            applyScanResult({
                vaginal_ejaculation_occurred: false,
                birth_occurred: true,
                sex_revealed: false,
                revealed_sexes: null,
                baby_traits: null,
                cycle_day: null,
                _source: 'manual',
            });
        });

        // Internal implementation note.
        const refreshAll = () => {
            saveSettingsDebounced();
            updatePromptInjection();
            syncUI();
            setTimeout(() => { import('./message-handler.js').then(m => m.renderInfoblock()); }, 60);
        };
        for(const who of ['user','char']) {
            const suf=who==='char'?'Char':'User';
            $(`#repro-sex-${who}`).on('change',function(){getSettings()['sex'+suf]=this.value;refreshAll();});
            for(const [short,key] of [['carry','carry'],['bleed','bleed'],['ovulate','ovulate']]){
                $(`#repro-cap-${short}-${who}`).on('change',function(){
                    const settings=getSettings();
                    if(key==='bleed' && this.checked) settings.menstruationEnabled=true;
                    settings[key+suf]=this.checked;
                    if(key==='carry') {
                        const me=canCarry(settings,'user'),bot=canCarry(settings,'char');
                        settings.carrierMode=me&&bot?'both':me?'user':bot?'char':'none';
                    }
                    refreshAll();
                });
            }
            for(const [field,setting] of [['mode','heatMode'],['frequency','heatFrequency'],['duration','heatDuration'],['anchor','heatAnchor'],['fertility','heatFertility']]){
                $(`#repro-heat-${field}-${who}`).on('change',function(){
                    let value=this.value;
                    if(field==='frequency'||field==='duration') value=Math.max(1,Math.min(365,parseInt(value,10)||28));
                    getSettings()[setting+suf]=value;
                    if(field==='mode' && value==='independent' && !getSettings()['heatAnchor'+suf]){
                        const date=getPregnancyData().rpDate?.slice(0,10);if(date)getSettings()['heatAnchor'+suf]=date;
                    }
                    refreshAll();
                });
            }
            $(`#repro-postpartum-feeding-${who}`).on('change',function(){setPostpartumFeeding(who,this.value);refreshAll();});
            $(`#repro-postpartum-mode-${who}`).on('change',function(){getSettings()['postpartumReturnMode'+suf]=this.value;refreshAll();});
            $(`#repro-postpartum-days-${who}`).on('change',function(){getSettings()['postpartumReturnDays'+suf]=Math.max(1,Math.min(3650,parseInt(this.value,10)||90));refreshAll();});
            $(`#repro-postpartum-resume-${who}`).on('click',()=>{if(resumePostpartumCycle(who))refreshAll();});
            $(`#repro-postpartum-clear-${who}`).on('click',()=>{if(confirm('Clear this character’s postpartum recovery without deleting baby or birth history?')){clearPostpartum(who);refreshAll();}});
            const saveProfile=()=>{
                const profile={};
                for(const field of PROFILE_FIELDS)profile[field]=String($(`#repro-parent-${who}-${field}`).val()||'');
                if(setParentProfile(who,normalizeParentProfile(profile)))refreshAll();
            };
            for(const field of PROFILE_FIELDS)$(`#repro-parent-${who}-${field}`).on('change',saveProfile);
            $(`#repro-parent-extract-${who}`).on('click',function(){
                const seed=getParentProfile(who),parsed=parseParentDescription($(`#repro-parent-import-${who}`).val(),seed);
                if(setParentProfile(who,parsed)){refreshAll();showNotification('Parent profile: labeled traits imported','success');}
            });
            $(`#repro-fetus-set-${who}`).on('click',function(){
                const raw=String($(`#repro-fetus-${who}`).val()||'').toUpperCase().split(/[\s,;]+/).filter(Boolean);
                if(setFetusSexes(who,raw,raw.every(x=>x!=='?')))refreshAll();
                else showNotification('Enter one M, F or ? for each fetus.','warning');
            });
        }
        $('#repro-pregnancy-dating').on('change',function(){getSettings().pregnancyDatingMode=this.value;refreshAll();});
        $('#repro-baby-graduation-basis').on('change',function(){getSettings().babyGraduationBasis=this.value;refreshAll();});
        $('#repro-baby-genetics-select').on('change',function(){syncUI();});
        $('#repro-baby-genetics-save').on('click',function(){
           const idx=Number($('#repro-baby-genetics-select').val());
           const patch={};
           for(const key of ['sex','species','hair','eyes','skin','face','height','traits','abilities','developmentRate'])patch[key]=String($(`#repro-baby-edit-${key}`).val()||'');
           if(editBabyDetails(idx,patch))showNotification('Baby traits saved permanently','success');
           else showNotification('Select a saved baby first','warning');
        });
        for (const who of ['user','char']) {
            $(`#repro-${who}-desig`).on('change', function() {
                getSettings()[who === 'char' ? 'charDesignation' : 'userDesignation'] = this.value;
                (who === 'char' ? getPartnerData() : getPregnancyData())._dynamic = {};
                refreshAll();
            });
        }
        for (const who of ['user','char']) {
            $(`#repro-hygiene-${who}-kit`).on('change', function() {
                const kit = this.value;
                if (!Object.prototype.hasOwnProperty.call(HYGIENE, kit)) return;
                const root = getPregnancyData(), target = who === 'char' ? getPartnerData() : root;
                target.hygieneType = kit;
                target.hygieneChangedRpDate = root.rpDate || null;
                refreshAll();
                if (getSettings().showNotifications) showNotification(`Menstrual supplies: ${HYGIENE[kit].labelEn}`, 'info');
            });
        }
        $('#repro-trackfor').on('change', function() { getSettings().trackFor = this.value; refreshAll(); });
        $('#repro-menstruation-enabled').on('change', function() {
            getSettings().menstruationEnabled = this.checked;
            getPregnancyData()._dynamic = {}; getPartnerData()._dynamic = {};
            refreshAll();
        });
        $('#repro-carrier-mode').on('change', function() {
            getSettings().carrierMode = this.value;
            getSettings().carryUser = this.value==='user'||this.value==='both';
            getSettings().carryChar = this.value==='char'||this.value==='both';
            getPregnancyData(); getPartnerData(); refreshAll();
        });
        $('#repro-universe').on('change', function() { getSettings().universe = this.value; refreshAll(); });
        const applyPartnerCycle = () => {
            setManualCycleDay('char', $('#repro-partner-cycle-day').val());
            refreshAll();
        };
        $('#repro-partner-cycle-set').on('click', applyPartnerCycle);
        $('#repro-partner-cycle-day').on('change', applyPartnerCycle).on('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); applyPartnerCycle(); }
        });
        $('#repro-hidden-preg').on('change', function() { getSettings().hiddenPregnancy = this.checked; refreshAll(); });
        const notifyManualContraception = (who, field, value) => {
            const notice = manualContraceptionNotice(carrierName(who), field, value);
            if (notice) showNotification(notice.message, notice.type);
        };
        for (const who of ['user','char']) {
            $(`#repro-contraception-${who}`).on('change', function() {
                const previous = getContraception(who);
                if (setContraception(who, this.value)) {
                    if (previous !== this.value) setContraceptionDetails(who, { methodDue: '', pillLastConfirmed: '' });
                    recordManualContraception(who);
                    if (previous !== this.value) notifyManualContraception(who, 'method', this.value);
                }
                updatePromptInjection(); syncUI();
            });
        }
        for (const who of ['user', 'char']) {
            const hook = (id, field) => $(`#${id}-${who}`).on('change', function() {
                const primary = getContraception(who);
                if (field === 'backup' && (
                    (primary === 'condom' && this.value === 'internal_condom') ||
                    (primary === 'internal_condom' && this.value === 'condom') ||
                    (primary === 'historical_condom' && this.value === 'internal_condom')
                )) { showNotification('Do not use internal and external condoms together.', 'warning'); syncUI(); return; }
                const before = getContraceptionDetails(who)[field];
                if (setContraceptionDetails(who, { [field]: this.value })) {
                    recordManualContraception(who);
                    if (before !== this.value) notifyManualContraception(who, field, this.value);
                }
                updatePromptInjection(); syncUI();
            });
            hook('repro-backup', 'backup');
            hook('repro-missed', 'missedPills');
            hook('repro-implant-status', 'implantStatus');
            hook('repro-implant-expiry', 'implantExpires');
            hook('repro-method-due', 'methodDue');
        }


        for (const who of ['user','char']) {
            $(`#repro-cycle-length-${who}`).on('change', function() {
                const n = Math.max(7, Math.min(365, parseInt(this.value,10) || 28));
                getSettings()[who === 'char' ? 'cycleLengthChar' : 'cycleLengthUser'] = n;
                const data = who === 'char' ? getPartnerData() : getPregnancyData();
                data.cycleDay = Math.max(1, Math.min(n, data.cycleDay || 1));
                data._cycleShift = 0;
                refreshAll();
            });
            $(`#repro-bleeding-days-${who}`).on('change', function() {
                const n = Math.max(0, Math.min(30, parseInt(this.value,10) || 0));
                getSettings()[who === 'char' ? 'bleedingDaysChar' : 'bleedingDaysUser'] = n;
                refreshAll();
            });
        }
        $('#repro-duration-char').on('change', function() {
            getSettings().pregnancyDurationChar = Math.max(1, Math.min(999, parseInt(this.value,10) || 40));
            refreshAll();
        });
        $('#repro-baby-rate').on('change', function() {
            const n = Number(this.value);
            getSettings().babyDevelopmentRate = Number.isFinite(n) ? Math.max(0.25, Math.min(10, n)) : 1;
            refreshAll();
        });
        $('#repro-duration').on('change', function() {
            const value=Math.max(1,Math.min(999,parseInt(this.value,10)||40));
            this.value=value;getSettings().pregnancyDuration=value;refreshAll();
        });

        // Internal implementation note.
        // Internal implementation note.
        const warnIfNoChat = () => {
            if (!getCurrentChatId()) {
                showNotification('Chat is not identified — open a chat and try again, or the changes will not be saved', 'warning');
                return true;
            }
            return false;
        };

        const applyManualCycle = (v) => {
            if (warnIfNoChat()) return;
            v = Math.max(1, Math.min(cycleLength(getSettings(), 'user'), parseInt(v) || 14));
            $('#repro-cycleday').val(v);
            setManualCycleDay('user', v);

            saveSettingsDebounced();
            setTimeout(() => { updatePromptInjection(); syncUI(); }, 50);
        };
        $('#repro-setcycle').on('click', function() {
            applyManualCycle($('#repro-cycleday').val());
        });
        // Internal implementation note.
        // Internal implementation note.
        $('#repro-cycleday').on('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyManualCycle($(this).val());
            }
        });
        $('#repro-cycleday').on('change blur', function() {
            applyManualCycle($(this).val());
        });

        $('#repro-reset').on('click', function() { if (confirm('Reset pregnancy?')) { resetPregnancy(); showNotification('Reset', 'info'); } });
        $('#repro-reset-baby').on('click', function() { if (confirm('Remove active baby tracking? Postpartum and birth history will remain.')) { resetBaby(); showNotification('Baby tracking removed; recovery preserved', 'info'); } });
        $('#repro-undo-manual-delivery').on('click',function(){if(confirm('Undo the last manual delivery and restore the pregnancy and postpartum state from before it?')){if(undoManualDelivery())showNotification('Manual delivery undone', 'info');else showNotification('No manual-delivery backup', 'warning');}});
        $('#repro-undo').on('click', function() {
            const label = undoLastDestructiveChange();
            showNotification(label ? `Undone: ${label}` : 'Nothing to undo', label ? 'success' : 'info');
        });

        // Internal implementation note.
        $('#repro-manual-toggle').on('click', function() {
            const panel = $('#repro-manual-panel');
            const visible = panel.is(':visible');
            panel.css('display', visible ? 'none' : 'flex');
            $(this).text(visible ? 'Manual pregnancy / baby ▼' : 'Manual pregnancy / baby ▲');
        });

        $('#repro-manual-baby-add').on('click', function() {
            if (warnIfNoChat()) return;
            const name = $('#repro-mb-name').val().trim();
            const sex = $('#repro-mb-sex').val();
            // Internal implementation note.
            const ageUnit = $('#repro-mb-age-unit').val() || 'd';
            const ageRaw = Math.max(0, parseInt($('#repro-mb-age-days').val()) || 0);
            const unitMul = ageUnit === 'y' ? 365 : ageUnit === 'm' ? 30 : 1;
            const ageDays = Math.min(36500, ageRaw * unitMul);
            const father = $('#repro-mb-father').val().trim();
            // Internal implementation note.
            const splitTraits = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 10);
            const personality = splitTraits($('#repro-mb-personality').val());
            const appearance = splitTraits($('#repro-mb-appearance').val());
            startManualBaby([{
                name: name,
                sex: sex,
                ageDays: ageDays,
                personality: personality,
                appearance: appearance,
                fatherName: father,
            }]);
            // Internal implementation note.
            $('#repro-mb-name').val('');
            $('#repro-mb-father').val('');
            $('#repro-mb-age-days').val('0');
            $('#repro-mb-personality').val('');
            $('#repro-mb-appearance').val('');
            syncUI();
            updatePromptInjection();
            setTimeout(() => {
                import('./message-handler.js').then(m => m.renderInfoblock());
            }, 200);
        });

        // Internal implementation note.
        const manualDateInput = $('#repro-manual-conception-date');
        if (manualDateInput.length && !manualDateInput.val()) {
            const p = getPregnancyData();
            let prefill = null;
            if (p.rpDate) {
                // Internal implementation note.
                prefill = new Date(new Date(p.rpDate).getTime() - 4 * 7 * 86400000);
            } else {
                // Internal implementation note.
                prefill = new Date(Date.now() - 4 * 7 * 86400000);
            }
            // Internal implementation note.
            const iso = prefill.toISOString().slice(0, 10);
            manualDateInput.val(iso);
        }

        $('#repro-manual-who').on('change', () => {
            const who = $('#repro-manual-who').val() || 'user';
            $('#repro-manual-second-parent').val((who === 'char' ? getPartnerData() : getPregnancyData()).fatherName || '');
        });
        $('#repro-manual-second-parent').on('change', function() {
            setSecondParent($('#repro-manual-who').val() || 'user', $(this).val());
        });

        // Manual pregnancy start
        $('#repro-manual-start').on('click', function() {
            if (warnIfNoChat()) return;
            const dateStr = $('#repro-manual-conception-date').val();
            if (!dateStr) {
                showNotification('Enter the conception date', 'warning');
                return;
            }
            const conceptionDate = new Date(dateStr + 'T00:00:00');
            if (isNaN(conceptionDate.getTime())) {
                showNotification('Invalid date', 'warning');
                return;
            }
            const fetus = Math.max(1, Math.min(4, parseInt($('#repro-manual-fetus').val()) || 1));
            const sexMode = $('#repro-manual-sex').val();
            let sexArr = null;
            if (sexMode === 'M' || sexMode === 'F') sexArr = new Array(fetus).fill(sexMode);
            else if (sexMode === 'individual') {
                sexArr=String($('#repro-manual-sex-individual').val()||'').toUpperCase().split(/[\s,;]+/).filter(Boolean);
                if (sexArr.length!==fetus || !sexArr.every(v=>['M','F','?'].includes(v))) {
                    showNotification('Individual sex: enter one M, F or ? for each fetus','warning');return;
                }
            }
            // Internal implementation note.
            const who = $('#repro-manual-who').val() || 'user';
            const secondParent = String($('#repro-manual-second-parent').val() || '').trim();
            if (who === 'char') startPartnerPregnancy(conceptionDate.toISOString(), fetus, sexArr, secondParent);
            else startManualPregnancy(conceptionDate.toISOString(), fetus, sexArr, secondParent);
            syncUI();
            updatePromptInjection();
            setTimeout(() => { import('./message-handler.js').then(m => m.renderInfoblock()); }, 100);
        });

        // Infoblock
        $('#repro-infoblock').on('change', function() { getSettings().infoblockPosition = this.value; saveSettingsDebounced(); });

        // Internal implementation note.
        $('#repro-purge-tags').on('click', function() {
            if (!confirm("Remove technical tags from this chat's messages? They will be moved to a service field: the extension will still read them, but the model will not. Visible text will not change.")) return;
            // Internal implementation note.
            import('./message-handler.js').then(m => {
                const n = m.purgeChatTags();
                showNotification(n ? `Tags removed from ${n} messages.` : 'No tags in this chat', n ? 'success' : 'info');
            });
        });

        // Cycle realism
        $('#repro-realism').on('change', async function() {
            if (cycleRealismSaving) return;
            const checked = this.checked;
            cycleRealismSaving = true;
            this.disabled = true;
            try {
                if (!await setCycleRealism(checked)) {
                    showNotification('Cycle Realism could not be saved for this chat. Try again.', 'warning');
                }
            } finally {
                cycleRealismSaving = false;
                updatePromptInjection();
                syncUI(); // Restore the saved value, even when metadata finishes loading later.
            }
        });

        // Internal implementation note.
        $('#repro-light-mode').prop('checked', !!s.lightMode).on('change', function() {
            getSettings().lightMode = this.checked;
            applyTheme(getSettings().theme, this.checked);
            saveSettingsDebounced();
        });

        // CSS editor
        $('#repro-css-toggle').on('click', function() {
            const panel = $('#repro-css-panel');
            const visible = panel.is(':visible');
            panel.css('display', visible ? 'none' : 'flex');
            $(this).text(visible ? 'Infoblock CSS ▼' : 'Infoblock CSS ▲');
            if (!visible) {
                const ta = $('#repro-custom-css');
                if (!ta.val()) {
                    ta.val(getSettings().customInfoblockCss || DEFAULT_INFOBLOCK_CSS);
                }
            }
        });
        $('#repro-css-apply').on('click', function() {
            const css = $('#repro-custom-css').val() || '';
            const skeleton = isSkeletonCss(css);
            getSettings().customInfoblockCss = skeleton ? '' : css;
            saveSettingsDebounced();
            applyCustomCss(css);
            showNotification(skeleton ? 'Unmodified template — extension style kept' : 'CSS applied', skeleton ? 'info' : 'success');
        });
        $('#repro-css-reset').on('click', function() {
            if (!confirm('Reset custom CSS?')) return;
            getSettings().customInfoblockCss = '';
            $('#repro-custom-css').val(DEFAULT_INFOBLOCK_CSS);
            saveSettingsDebounced();
            applyCustomCss('');
            showNotification('CSS reset (default style)', 'info');
        });

        // Internal implementation note.
        $('#repro-theme-btn').on('click', showThemePicker);

        // Internal implementation note.
        // Internal implementation note.
        if (s.customInfoblockCss && isSkeletonCss(s.customInfoblockCss)) {
            s.customInfoblockCss = '';
            saveSettingsDebounced();
        }
        if (s.customInfoblockCss) {
            applyCustomCss(s.customInfoblockCss);
        }
        s.theme = normalizeTheme(s.theme);
        applyTheme(s.theme);

        syncUI();
    } catch (error) {
        reportError('[Reproductive] setupUI error:', error);
    }
}
