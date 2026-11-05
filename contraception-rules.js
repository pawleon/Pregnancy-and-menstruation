// Gameplay contraception rules — NOT clinical per-act risk estimates.
// These weights follow the extension's legacy annual-effectiveness-as-roll
// convention. They must never be represented as patient-specific advice.
import { CHANCES } from './config.js';

export const BACKUP_OPTIONS = Object.freeze(['none', 'condom', 'internal_condom', 'diaphragm', 'cervical_cap', 'spermicide', 'withdrawal', 'fertility_awareness', 'historical_condom', 'historical_sponge']);
export const DEFAULT_DETAILS = Object.freeze({ backup: 'none', missedPills: 'normal', implantStatus: 'active', implantExpires: '', methodDue: '', pillLastConfirmed: '' });

export function normalizedDetails(value) {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
        backup: BACKUP_OPTIONS.includes(raw.backup) ? raw.backup : 'none',
        missedPills: ['normal', 'one', 'multiple'].includes(raw.missedPills) ? raw.missedPills : 'normal',
        implantStatus: ['active', 'not_inserted', 'removed', 'expired'].includes(raw.implantStatus) ? raw.implantStatus : 'active',
        implantExpires: typeof raw.implantExpires === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.implantExpires) && !Number.isNaN(Date.parse(raw.implantExpires)) ? raw.implantExpires : '',
        methodDue: typeof raw.methodDue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.methodDue) && !Number.isNaN(Date.parse(raw.methodDue)) ? raw.methodDue : '',
        pillLastConfirmed: typeof raw.pillLastConfirmed === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.pillLastConfirmed) && !Number.isNaN(Date.parse(raw.pillLastConfirmed)) ? raw.pillLastConfirmed : '',
    };
}

function rpDateKey(rpDate) {
    if (!rpDate) return '';
    const d = new Date(rpDate);
    if (Number.isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function contraceptionStatus(method, details, rpDate = null) {
    const d = normalizedDetails(details);
    if (method === 'pill' && d.missedPills === 'multiple') return { active: false, reason: '2+ missed active pills; backup protection advised until 7 active pills have been taken' };
    if (method === 'implant') {
        if (d.implantStatus !== 'active') return { active: false, reason: `implant status: ${d.implantStatus.replace('_', ' ')}` };
        const date = rpDateKey(rpDate);
        if (date && d.implantExpires && date > d.implantExpires) return { active: false, reason: 'implant replacement date passed in story' };
        if (!date && d.implantExpires) return { active: true, reason: 'expiry date set; no valid RP date for automatic comparison' };
    }
    if (['injection','patch','ring'].includes(method) && d.methodDue) {
        const date = rpDateKey(rpDate);
        if (date && date > d.methodDue) return { active: false, reason: `${method} renewal due date passed (RP time)` };
        if (!date) return { active: true, reason: 'RP date unavailable; due date not checked' };
    }
    if (method === 'pill' && d.missedPills === 'normal' && d.pillLastConfirmed) {
        const now = rpDateKey(rpDate);
        if (now && (Date.parse(now) - Date.parse(d.pillLastConfirmed)) / 86400000 > 7)
            return {active:true, reason:'pill adherence not recently confirmed in story; do not infer missed doses'};
    }
    if (method === 'pill' && d.missedPills === 'one') return { active: true, reason: 'one missed combined active pill; gameplay protection retained' };
    return { active: true, reason: '' };
}

export function activeProtectionMethods(primary, details, rpDate = null, encounterMethods = []) {
    const d = normalizedDetails(details);
    const main = typeof primary === 'string' && CHANCES.contraception[primary] !== undefined ? primary : 'none';
    const backup = d.backup;
    const selected = [main];
    if (backup !== 'none' && backup !== main) selected.push(backup);
    // Short-lived barriers recorded for this conception check, not the saved method.
    const encountered = Array.isArray(encounterMethods) ? encounterMethods : [];
    for (const method of encountered) {
        if (BACKUP_OPTIONS.includes(method) && method !== 'none' && !selected.includes(method)) selected.push(method);
    }
    // Internal and external condoms must NOT be combined; keep main method.
    if (selected.includes('internal_condom') && selected.some(m => ['condom','historical_condom'].includes(m))) {
        // Never count internal and external condoms together; retain the primary
        // or, when neither is primary, the first selected barrier.
        const first = selected.find(m => ['internal_condom','condom','historical_condom'].includes(m));
        for (let i=selected.length-1; i>=0; i--) {
            if (['internal_condom','condom','historical_condom'].includes(selected[i]) && selected[i] !== first) selected.splice(i,1);
        }
    }
    return selected.filter(method => method !== 'none' && contraceptionStatus(method, d, rpDate).active)
        .map(method => ({ method, effectiveness: CHANCES.contraception[method] || 0 }));
}

export function protectionRoll(primary, details, rpDate = null, rnd = Math.random, encounterMethods = []) {
    const methods = activeProtectionMethods(primary, details, rpDate, encounterMethods);
    // Each selected method is evaluated separately in this *fictional* model.
    // Never simply add typical-use effectiveness percentages.
    return { protected: methods.some(entry => rnd() * 100 < entry.effectiveness), methods };
}
