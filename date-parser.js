// ═══════════════════════════════════════════
// Internal implementation note.
// ═══════════════════════════════════════════

import { getSettings } from './state.js';
import { pregnancyLength } from './cycle-model.js';

export function calculateConceptionDate(rpDate, weeksPregnant) {
    if (!rpDate || weeksPregnant <= 0) return null;
    const conceptionTime = rpDate.getTime() - (weeksPregnant * 7 * 24 * 60 * 60 * 1000);
    return new Date(conceptionTime);
}

export function calculateDueDate(conceptionDate, who = 'user', datingMode = 'conception') {
    if (conceptionDate) {
        const s = getSettings();
        const duration = Math.max(1,pregnancyLength(s,who) - (datingMode==='obstetric'?2:0));
        const conception = new Date(conceptionDate);
        const dueDate = new Date(conception.getTime() + (duration * 7 * 24 * 60 * 60 * 1000));
        return dueDate;
    }
    return null;
}
