import { reportError } from './diagnostics.js';
// ═══════════════════════════════════════════
// Internal implementation note.
// ═══════════════════════════════════════════

import { canCarry } from './omegaverse.js';
import { cycleLength } from './cycle-model.js';
import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced as saveGlobalSettingsDebounced } from '../../../../script.js';
import { extensionName, defaultPregnancyData, defaultPartnerData, LANG, CHANCES } from './config.js';
import { normalizedDetails } from './contraception-rules.js';

// These settings belong to the *open chat*, never to the global extension
// settings.  Use the same native SillyTavern chatMetadata persistence that
// already fixed contraception.  In particular, do NOT key these by chatId:
// chatId/integrity can be stale or duplicated during chat switching.
const CHAT_OPTIONS_KEY = 'reproductiveSystem_chatOptions_v1';
const CHAT_OPTION_DEFAULTS = Object.freeze({
    pregnancyDuration: 40,
    pregnancyDurationChar: 40,
    cycleLengthUser: 28,
    cycleLengthChar: 28,
    bleedingDaysUser: 5,
    bleedingDaysChar: 5,
    babyDevelopmentRate: 1,
    carrierMode: 'user',
    trackFor: 'user',
    hiddenPregnancy: true,
    menstruationEnabled: true,
    universe: 'normal',
    userDesignation: 'omega',
    charDesignation: 'alpha',
    babyMaxAgeDays: 730,
    realism: false,
    tryingToConceive: false,
    twinsChance: 3,
    tripletsChance: 0.1,
    obviousAtWeek: 12,
    // null inherits the old carrier/menstruation settings (safe for old saves).
    carryUser: null, carryChar: null,
    bleedUser: null, bleedChar: null,
    ovulateUser: null, ovulateChar: null,
    heatModeUser: 'linked', heatModeChar: 'linked',
    heatFrequencyUser: 28, heatFrequencyChar: 28,
    heatDurationUser: 5, heatDurationChar: 5,
    heatAnchorUser: '', heatAnchorChar: '',
    heatFertilityUser: 'none', heatFertilityChar: 'none',
    babyGraduationBasis: 'developmental',
    pregnancyDatingMode: 'conception',
    sexUser: 'unspecified', sexChar: 'unspecified',
    _birthBlockedUntilUser: null,
    _birthBlockedUntilChar: null,
    _conceptionBlockedUntilUser: null,
    _conceptionBlockedUntilChar: null,
});
const CHAT_OPTION_NAMES = new Set(Object.keys(CHAT_OPTION_DEFAULTS));
const validTrackingMode = value => ['user', 'char', 'both', 'none'].includes(value);

function normalizeChatOption(key, value) {
    if (key === 'pregnancyDuration' || key === 'pregnancyDurationChar') {
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed >= 1 && parsed <= 999 ? parsed : CHAT_OPTION_DEFAULTS[key];
    }
    if (key === 'cycleLengthUser' || key === 'cycleLengthChar') {
        const v = Number(value);
        return Number.isInteger(v) && v >= 7 && v <= 365 ? v : CHAT_OPTION_DEFAULTS[key];
    }
    if (key === 'bleedingDaysUser' || key === 'bleedingDaysChar') {
        const v = Number(value);
        return Number.isInteger(v) && v >= 0 && v <= 30 ? v : CHAT_OPTION_DEFAULTS[key];
    }
    if (/^(carry|bleed|ovulate)(User|Char)$/.test(key)) return value === null || typeof value === 'boolean' ? value : null;
    if (/^heatMode(User|Char)$/.test(key)) return ['linked','independent','off'].includes(value) ? value : 'linked';
    if (/^heatFrequency(User|Char)$/.test(key)) return Number.isInteger(value) && value >= 1 && value <= 365 ? value : 28;
    if (/^heatDuration(User|Char)$/.test(key)) return Number.isInteger(value) && value >= 1 && value <= 365 ? value : 5;
    if (/^heatAnchor(User|Char)$/.test(key)) return typeof value === 'string' && (value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value)) ? value : '';
    if (/^heatFertility(User|Char)$/.test(key)) return ['none','boost','required'].includes(value) ? value : 'none';
    if (key === 'babyGraduationBasis') return ['chronological','developmental'].includes(value) ? value : 'developmental';
    if (key === 'sexUser' || key === 'sexChar') return ['female','male','other','unspecified'].includes(value) ? value : 'unspecified';
    if (key === 'pregnancyDatingMode') return ['conception','obstetric'].includes(value) ? value : 'conception';
    if (key === 'babyDevelopmentRate') {
        const v = Number(value);
        return Number.isFinite(v) && v >= 0.25 && v <= 10 ? v : 1;
    }
    if (key === 'carrierMode' || key === 'trackFor') {
        return validTrackingMode(value) ? value : CHAT_OPTION_DEFAULTS[key];
    }
    if (['hiddenPregnancy', 'menstruationEnabled', 'realism', 'tryingToConceive'].includes(key)) {
        return typeof value === 'boolean' ? value : CHAT_OPTION_DEFAULTS[key];
    }
    if (key === 'universe') return ['normal', 'omegaverse'].includes(value) ? value : 'normal';
    if (key === 'userDesignation' || key === 'charDesignation') {
        return ['alpha', 'beta', 'omega'].includes(value) ? value : CHAT_OPTION_DEFAULTS[key];
    }
    if (key === 'babyMaxAgeDays') {
        return Number.isInteger(value) && value >= 0 && value <= 36500 ? value : 730;
    }
    if (key === 'twinsChance' || key === 'tripletsChance') {
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : CHAT_OPTION_DEFAULTS[key];
    }
    if (key === 'obviousAtWeek') return Number.isInteger(value) && value >= 1 && value <= 999 ? value : 12;
    if (key.startsWith('_') && key.includes('BlockedUntil')) {
        return value === null || Number.isSafeInteger(value) && value >= 0 ? value : null;
    }
    return undefined;
}

function readChatOption(key) {
    // Missing metadata deliberately uses clean defaults, not the old shared
    // values, so a legacy global value cannot spread into every other OC.
    const context = contraceptionChatContext();
    const record = context?.chatMetadata?.[CHAT_OPTIONS_KEY];
    const saved = record && typeof record === 'object' && !Array.isArray(record)
        ? record[key] : undefined;
    return normalizeChatOption(key, saved);
}

export function canSetChatOptions() { return contraceptionChatContext() !== null; }

export function setChatOption(key, value) {
    if (!CHAT_OPTION_NAMES.has(key)) return false;
    const normalized = normalizeChatOption(key, value);
    if (normalized !== value) return false;
    const context = contraceptionChatContext();
    if (!context) return false;
    const old = context.chatMetadata[CHAT_OPTIONS_KEY];
    const record = old && typeof old === 'object' && !Array.isArray(old) ? { ...old } : {};
    if (record[key] === normalized) return true;
    record[key] = normalized;
    context.chatMetadata[CHAT_OPTIONS_KEY] = record;
    try {
        const saving = context.saveMetadata();
        if (saving && typeof saving.catch === 'function') {
            saving.catch(error => reportError('[Reproductive] Could not save chat-specific options:', error));
        }
    } catch (error) {
        reportError('[Reproductive] Could not save chat-specific options:', error);
        return false;
    }
    return true;
}

// All existing business logic gets current-chat values transparently through
// getSettings(), while unrelated global settings keep their original behavior.
// The proxy is NEVER stored in extension_settings or serialized as global data.
const scopedSettingsProxies = new WeakMap();
export function getSettings() {
    const globalSettings = extension_settings[extensionName];
    if (!globalSettings) return globalSettings;
    globalSettings.debugKeepTags = false;
    if (!validTrackingMode(globalSettings.trackFor)) globalSettings.trackFor = 'user';
    let scoped = scopedSettingsProxies.get(globalSettings);
    if (!scoped) {
        scoped = new Proxy(globalSettings, {
            get(target, key, receiver) {
                if (CHAT_OPTION_NAMES.has(key)) return readChatOption(key);
                return Reflect.get(target, key, receiver);
            },
            set(target, key, value, receiver) {
                if (CHAT_OPTION_NAMES.has(key)) {
                    // Never fall back to a global write if the chat is missing.
                    setChatOption(key, value);
                    return true;
                }
                return Reflect.set(target, key, value, receiver);
            },
        });
        scopedSettingsProxies.set(globalSettings, scoped);
    }
    return scoped;
}


function cloneDefault(value) {
    return (value && typeof value === 'object') ? structuredClone(value) : value;
}

function fillMissing(target, defaults) {
    if (!target || typeof target !== 'object') return;
    for (const key in defaults) {
        if (target[key] === undefined) target[key] = cloneDefault(defaults[key]);
    }
}

function legacyBabyFromRoot(p, index, count) {
    const sexList = Array.isArray(p.babySex) ? p.babySex : [];
    return {
        name: index === 0 ? (p.babyName || '') : '',
        sex: sexList[index] || sexList[0] || '?',
        health: p.babyHealth || 'normal',
        mood: p.babyMood || 'calm',
        sleep: p.babySleep || 'Sleeping',
        diaperClean: p.babyDiaperClean !== false,
        teething: !!p.babyTeething,
        colicky: !!p.babyColicky,
        feedingType: p.babyFeedingType || '',
        milestones: index === 0 && Array.isArray(p.babyMilestones) ? structuredClone(p.babyMilestones) : [],
        personality: [],
        appearance: [],
        birthRpDate: p.babyBirthRpDate || p.rpDate || null,
        age: p.babyAge || 'newborn',
    };
}

// babies[] is the canonical active-child state. Legacy singular fields remain as
// compatibility mirrors for old UI/prompts/saves and are rebuilt from babies[].
export function syncBabyLegacyFields(p = getPregnancyData()) {
    if (!p || typeof p !== 'object') return p;
    if (!Array.isArray(p.babies)) p.babies = [];
    if (!Array.isArray(p.grownChildren)) p.grownChildren = [];

    // Upgrade old saves that only had babyName/babyCount/etc.
    if (p.babies.length === 0 && p.hasBaby) {
        const legacyCount = Math.max(1, parseInt(p.babyCount) || (Array.isArray(p.babySex) ? p.babySex.length : 0) || 1);
        for (let i = 0; i < legacyCount; i++) p.babies.push(legacyBabyFromRoot(p, i, legacyCount));
    }

    p.babies = p.babies.filter(b => b && typeof b === 'object');
    if (p.babies.length === 0) {
        p.hasBaby = false;
        p.babyCount = 0;
        p.babyName = '';
        p.babySex = [];
        p.babyBirthRpDate = null;
        return p;
    }

    p.hasBaby = true;
    p.babyCount = p.babies.length;
    p.babySex = p.babies.map(b => b.sex || '?');
    const primary = p.babies[0];
    p.babyName = primary.name || '';
    p.babyHealth = primary.health || 'normal';
    p.babyMood = primary.mood || '';
    p.babySleep = primary.sleep || '';
    p.babyDiaperClean = primary.diaperClean !== false;
    p.babyTeething = !!primary.teething;
    p.babyColicky = !!primary.colicky;
    p.babyFeedingType = primary.feedingType || '';
    p.babyMilestones = Array.isArray(primary.milestones) ? primary.milestones : [];
    p.babyAge = primary.age || p.babyAge || '';
    p.babyBirthRpDate = primary.birthRpDate || null;
    return p;
}

export function migratePregnancyData(p, s = getSettings()) {
    if (!p || typeof p !== 'object') return p;
    fillMissing(p, defaultPregnancyData);
    if (!p.partner || typeof p.partner !== 'object') p.partner = structuredClone(defaultPartnerData);
    fillMissing(p.partner, defaultPartnerData);
    syncBabyLegacyFields(p);
    return p;
}

// Chat-local contraception. Do not store these choices in extension_settings:
// those settings are shared by every chat and by every active persona.
// SillyTavern gives each opened chat its own chatMetadata object. Read the
// current object each time; NEVER cache it across CHAT_CHANGED events.
const CONTRACEPTION_CHAT_KEY = 'reproductiveSystem_contraception_v2';

function validContraception(method) {
    return typeof method === 'string' &&
        Object.prototype.hasOwnProperty.call(CHANCES.contraception, method);
}

function normalizedContraception(method) {
    return validContraception(method) ? method : 'none';
}

function contraceptionChatContext() {
    try {
        const context = typeof SillyTavern?.getContext === 'function'
            ? SillyTavern.getContext()
            : null;
        // A missing metadata/save API means there isn't a writable chat scope.
        // Never fall back to the global settings object in that case.
        if (!context || !context.chatMetadata ||
            typeof context.chatMetadata !== 'object' ||
            Array.isArray(context.chatMetadata) ||
            typeof context.saveMetadata !== 'function') return null;
        return context;
    } catch (error) {
        reportError('[Reproductive] chat contraception context error:', error);
        return null;
    }
}

export function canSetContraception() {
    return contraceptionChatContext() !== null;
}

export function getContraception(who = 'user') {
    const context = contraceptionChatContext();
    const record = context?.chatMetadata?.[CONTRACEPTION_CHAT_KEY];
    if (!record || typeof record !== 'object' || Array.isArray(record)) return 'none';
    return normalizedContraception(record[who === 'char' ? 'char' : 'user']);
}

// Return false if no writable chat is loaded. Do not update obsolete globals.
export function setContraception(who, method) {
    if (!validContraception(method)) return false;
    const context = contraceptionChatContext();
    if (!context) return false;
    const previous = context.chatMetadata[CONTRACEPTION_CHAT_KEY];
    const record = previous && typeof previous === 'object' && !Array.isArray(previous)
        ? { user: normalizedContraception(previous.user), char: normalizedContraception(previous.char) }
        : { user: 'none', char: 'none' };
    const carrier = who === 'char' ? 'char' : 'user';
    if (record[carrier] === method && previous) return true;
    record[carrier] = method;
    context.chatMetadata[CONTRACEPTION_CHAT_KEY] = record;
    // Official per-chat persistence API. Handle async save failures without
    // turning any method selection into a global setting.
    try {
        const saving = context.saveMetadata();
        if (saving && typeof saving.catch === 'function') {
            saving.catch(error => reportError('[Reproductive] Could not save chat contraception:', error));
        }
    } catch (error) {
        reportError('[Reproductive] Could not save chat contraception:', error);
        return false;
    }
    return true;
}

// Canon profiles belong to the currently open chat, not to global preferences.
const PARENT_PROFILES_KEY = 'reproductiveSystem_parentProfiles_v1';
export function getParentProfile(who='user') {
    const context=contraceptionChatContext();
    const raw=context?.chatMetadata?.[PARENT_PROFILES_KEY]?.[who==='char'?'char':'user'];
    return raw && typeof raw==='object' && !Array.isArray(raw) ? structuredClone(raw) : {};
}
export function setParentProfile(who, profile) {
    const context=contraceptionChatContext();
    if(!context || !profile || typeof profile!=='object' || Array.isArray(profile))return false;
    const old=context.chatMetadata[PARENT_PROFILES_KEY]||{};
    const field=who==='char'?'char':'user';
    context.chatMetadata[PARENT_PROFILES_KEY]={...old,[field]:structuredClone(profile)};
    savePregnancyMetadata(context);
    return true;
}

// Independently saved details, never added to pregnancy snapshots or old
// global extension_settings. Existing primary selections are unchanged.
const CONTRACEPTION_DETAILS_KEY = 'reproductiveSystem_contraceptionDetails_v1';
export function getContraceptionDetails(who = 'user') {
    const context = contraceptionChatContext();
    const record = context?.chatMetadata?.[CONTRACEPTION_DETAILS_KEY];
    return normalizedDetails(record?.[who === 'char' ? 'char' : 'user']);
}
export function setContraceptionDetails(who, patch) {
    const context = contraceptionChatContext();
    if (!context || !patch || typeof patch !== 'object' || Array.isArray(patch)) return false;
    const field = who === 'char' ? 'char' : 'user';
    const old = context.chatMetadata[CONTRACEPTION_DETAILS_KEY];
    const record = old && typeof old === 'object' && !Array.isArray(old) ? { ...old } : {};
    const before = normalizedDetails(record[field]);
    const next = normalizedDetails({ ...before, ...patch });
    if (Object.keys(patch).some(key => !(key in before) || next[key] !== patch[key])) return false;
    record[field] = next;
    context.chatMetadata[CONTRACEPTION_DETAILS_KEY] = record;
    try {
        const saving = context.saveMetadata();
        if (saving && typeof saving.catch === 'function') saving.catch(error => reportError('[Reproductive] Could not save contraception details:', error));
    } catch (error) {
        reportError('[Reproductive] Could not save contraception details:', error);
        return false;
    }
    return true;
}

// ──────────────────────────────────────────────────────────────────────
// Internal implementation note.
// ──────────────────────────────────────────────────────────────────────
let _cachedChatId = null;

export function resetChatIdCache() {
    _cachedChatId = null;
}

// Internal implementation note.
// Internal implementation note.
// Internal implementation note.
export function computeChatIdForms() {
    const forms = [];
    try {
        const ctx = (typeof SillyTavern?.getContext === 'function')
            ? SillyTavern.getContext()
            : null;
        if (!ctx) return forms;

        const meta = ctx.chatMetadata || ctx.chat_metadata
                  || (typeof window !== 'undefined' ? window.chat_metadata : null);
        if (meta) {
            const integrity = meta.integrity;
            if ((typeof integrity === 'string' && integrity.length > 0) || typeof integrity === 'number') {
                forms.push(`uuid:${String(integrity)}`);
            }
            const fname = meta.file_name || meta.fileName;
            if (typeof fname === 'string' && fname.length > 0) {
                forms.push(`file:${fname}`);
            }
            let hash = meta.chat_id_hash;
            if (hash === undefined || hash === null) hash = meta.chatIdHash;
            if (hash !== undefined && hash !== null && hash !== '') {
                forms.push(`hash:${String(hash)}`);
            }
        }

        const directId = ctx.chatId;
        if ((typeof directId === 'string' && directId.trim().length > 0) || typeof directId === 'number') {
            // Normalize common human-readable form like "Name - 2026-05-28@11h08m17s150ms"
            // by trimming only the high-resolution millisecond suffix.
            let s = String(directId).trim();
            s = s.replace(/\s-\s(\d{4}-\d{2}-\d{2}@\d{2}h\d{2}m\d{2}s)\d*ms$/, ' - $1');
            s = s.replace(/\s@(\d{4}-\d{2}-\d{2}@\d{2}h\d{2}m\d{2}s)\d*ms$/, ' @$1');
            forms.push(s);
        }
    } catch (e) { reportError('[Reproductive] chat-id normalization error:', e); }
    return forms;
}

export function getCurrentChatId() {
    if (_cachedChatId) return _cachedChatId;

    try {
        const forms = computeChatIdForms();
        const resolved = forms.length > 0 ? forms[0] : null;

        if (resolved) {
            _cachedChatId = resolved;
            return resolved;
        }

        return null;
    } catch (e) {
        return null;
    }
}

export function getChat() {
    try {
        const context = typeof SillyTavern?.getContext === 'function'
            ? SillyTavern.getContext()
            : window;
        return context?.chat || [];
    } catch (e) {
        return [];
    }
}

// Pregnancy, cycle, and baby records now live in SillyTavern's own per-chat
// metadata, just like contraception. All nested changes stay on the same
// object so the existing pregnancy snapshots and rollback logic remain valid.
// The legacy global record map is read-only migration input; never delete it.
const PREGNANCY_CHAT_KEY = 'reproductiveSystem_pregnancyData_v1';
let _fallback = null;

function getFallback() {
    if (!_fallback) _fallback = structuredClone(defaultPregnancyData);
    return _fallback;
}

export function resetFallback() {
    _fallback = null;
}

function savePregnancyMetadata(context) {
    if (!context || typeof context.saveMetadata !== 'function') return;
    try {
        const saving = context.saveMetadata();
        if (saving && typeof saving.catch === 'function') {
            saving.catch(error => reportError('[Reproductive] Could not save chat pregnancy metadata:', error));
        }
    } catch (error) {
        reportError('[Reproductive] Could not save chat pregnancy metadata:', error);
    }
}

// A common save path for the existing pregnancy/baby/cycle modules. Global
// settings still get saved for UI preferences, while the currently open chat's
// pregnancy record gets saved via the native per-chat API, never via a shared
// chatId-indexed object. Avoid a delayed metadata write that could hit another
// chat after navigation.
export function saveSettingsDebounced() {
    saveGlobalSettingsDebounced();
    const context = contraceptionChatContext();
    if (context && context.chatMetadata[PREGNANCY_CHAT_KEY]) {
        savePregnancyMetadata(context);
    }
}

function newPregnancyRecord(s) {
    const fresh = structuredClone(defaultPregnancyData);
    fresh.cycleDay = 1 + Math.floor(Math.random() * cycleLength(s, 'user'));
    fresh.lastCycleUpdate = Date.now();
    fresh.partner = structuredClone(defaultPartnerData);
    fresh.partner.cycleDay = 1 + Math.floor(Math.random() * cycleLength(s, 'char'));
    return fresh;
}

function legacyPregnancyRecord(s) {
    if (!s?.chatPregnancyData || typeof s.chatPregnancyData !== 'object') return null;
    // Use *current* context identities, not cached IDs that may belong to the
    // previously opened chat. Deep-copy the legacy record: two duplicated chats
    // must never hold the same mutable object by reference.
    const forms = computeChatIdForms();
    for (const form of forms) {
        const item = s.chatPregnancyData[form];
        if (item && typeof item === 'object' && !Array.isArray(item)) return structuredClone(item);
    }
    return null;
}

export function getPregnancyData() {
    const s = getSettings();
    const context = contraceptionChatContext();
    if (!s || !context) return getFallback();

    let p = context.chatMetadata[PREGNANCY_CHAT_KEY];
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
        // Migration is local to the opened chat. Its former global save is
        // deliberately retained as backup for older extension versions.
        p = legacyPregnancyRecord(s) || newPregnancyRecord(s);
        migratePregnancyData(p, s);
        context.chatMetadata[PREGNANCY_CHAT_KEY] = p;
        savePregnancyMetadata(context);
    }
    migratePregnancyData(p, s);
    return p;
}

// ──────────────────────────────────────────────────────────────────────
// Internal implementation note.
// Internal implementation note.
// ──────────────────────────────────────────────────────────────────────
export function getPartnerData() {
    const p = getPregnancyData();
    if (!p.partner || typeof p.partner !== 'object') p.partner = structuredClone(defaultPartnerData);
    fillMissing(p.partner, defaultPartnerData);
    return p.partner;
}

// Internal implementation note.
export function getCarrier(who) {
    return who === 'char' ? getPartnerData() : getPregnancyData();
}

// Internal implementation note.
export function getCarriers() {
    const s = getSettings();
    const mode = s?.trackFor || 'user';
    const list = [];
    if (mode === 'user' || mode === 'both') list.push({ who: 'user', data: getPregnancyData() });
    if (mode === 'char' || mode === 'both') list.push({ who: 'char', data: getPartnerData() });

    return list;
}

// Internal implementation note.
export function carrierName(who) {
    try {
        const ctx = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext() : null;
        if (who === 'char') return ctx?.name2 || 'Character';
        return ctx?.name1 || 'User';
    } catch (e) {
        return who === 'char' ? 'Character' : 'User';
    }
}

// Internal implementation note.
export function isTracked(who) { const mode = getSettings()?.trackFor || 'user'; return mode === 'both' || mode === who; }

export function L(key) {
    try {
        const s = getSettings();
        const lang = s?.language || 'en';
        const keys = key.split('.');
        let result = LANG[lang];
        for (const k of keys) {
            result = result?.[k];
        }
        return result || key;
    } catch (e) {
        reportError('[Reproductive] L() error:', key, e);
        return key;
    }
}

// ─── Cycle day accessors (per-chat) ───
export function getCycleDay() {
    const p = getPregnancyData();
    if (typeof p.cycleDay === 'number' && p.cycleDay >= 1 && p.cycleDay <= cycleLength(getSettings(), 'user') + Math.max(0, parseInt(p._cycleShift) || 0)) {
        return p.cycleDay;
    }
    const s = getSettings();
    const globalCycle = (typeof s.cycleDay === 'number' && s.cycleDay >= 1 && s.cycleDay <= cycleLength(s, 'user')) ? s.cycleDay : 1;
    p.cycleDay = globalCycle;
    if (!p.lastCycleUpdate && s.lastCycleUpdate) p.lastCycleUpdate = s.lastCycleUpdate;
    return p.cycleDay;
}

export function setCycleDay(day, updateTimestamp = true, isUserAction = false) {
    const p = getPregnancyData();
    // Internal implementation note.
    // Internal implementation note.
    const maxDay = cycleLength(getSettings(), 'user') + Math.max(0, parseInt(p._cycleShift) || 0);
    const d = Math.max(1, Math.min(maxDay, parseInt(day) || 1));
    p.cycleDay = d;
    if (updateTimestamp) p.lastCycleUpdate = Date.now();
    if (isUserAction) {
        p._dynamic = {};
        // Internal implementation note.
        // Internal implementation note.
        p._userSetCycleAt = Date.now();
    }
    return d;
}

// A stale CYCLE_DAY tag from the regenerated reply cannot override a manual edit.
export function isManualCycleProtected(who = 'user') {
    const c = who === 'char' ? getPartnerData() : getPregnancyData();
    const position = typeof SillyTavern?.getContext === 'function' ? SillyTavern.getContext().chat?.length || 0 : 0;
    return Number.isInteger(c._manualCyclePosition) && position <= c._manualCyclePosition;
}
