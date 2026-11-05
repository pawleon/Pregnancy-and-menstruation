// Chat-local cycle configuration. Game mechanics / RP worldbuilding only.
export function cycleLength(s, who = 'user') {
    const n = Number(who === 'char' ? s?.cycleLengthChar : s?.cycleLengthUser);
    return Number.isInteger(n) && n >= 7 && n <= 365 ? n : 28;
}
export function bleedingDays(s, who = 'user') {
    const n = Number(who === 'char' ? s?.bleedingDaysChar : s?.bleedingDaysUser);
    return Number.isInteger(n) && n >= 0 && n <= 30 ? Math.min(n, cycleLength(s, who)) : 5;
}
export function pregnancyLength(s, who = 'user') {
    const n = Number(who === 'char' ? s?.pregnancyDurationChar : s?.pregnancyDuration);
    return Number.isInteger(n) && n >= 1 && n <= 999 ? n : 40;
}
export function ovulationDay(length = 28, bleeding = 5) {
    const n = Math.max(1, Math.trunc(Number(length)) || 28);
    // Real-world luteal estimates only make sense for longer cycles.
    // Short fantasy cycles use a proportional simulation, not day-one ovulation.
    return bleeding >= n ? 0 : Math.max(Math.min(n,Math.max(0,bleeding)+1), n >= 21 ? Math.max(1, n-14) : Math.max(1,Math.round(n*0.58)));
}
export function fertileDays(length = 28, bleeding = 5) {
    const n = Math.max(1, Math.trunc(Number(length)) || 28);
    const ov = ovulationDay(n,bleeding);
    if (!ov) return {start:0,end:0,ov:0};
    const before = n >= 21 ? 4 : Math.max(1, Math.round(n * 0.19));
    return { start: Math.max(Math.min(n,bleeding+1), ov-before), end: Math.min(n, ov+(n>=21?1:0)), ov };
}
// Count transitions over skipped RP days, including wraparound and complete cycles.
export function crossesCycleDay(oldDay, daysPassed, targetDay, length, shift = 0) {
    const steps = Math.max(0, Math.trunc(Number(daysPassed)) || 0);
    if (!steps) return false;
    const n = Math.max(1, Math.trunc(Number(length)) || 28);
    const target = Math.max(1, Math.trunc(Number(targetDay)) || 1);
    for (let i = 1; i <= Math.min(steps, n + Math.max(0,shift) + 1); i++) {
        if (advanceCycle(oldDay, i, n, shift).day === target) return true;
    }
    return false;
}
export function advanceCycle(day, daysPassed, length, shift = 0) {
    const base = Math.max(7, Number(length) || 28);
    const first = base + Math.max(0, Number(shift) || 0);
    const next = Math.max(1, Number(day) || 1) + Math.max(0, Number(daysPassed) || 0);
    return { day: next <= first ? next : ((next - first - 1) % base) + 1, clearedShift: next > first };
}
export function hormoneCycleHint(method, status) {
    if (status?.active === false) return '';
    if (['implant','injection','pill','patch','ring'].includes(method))
        return 'Hormonal contraception may suppress ovulation and alter bleeding; cycle phases are estimates, not confirmed ovulation.';
    if (method === 'iud') return 'IUD effects depend on type; bleeding patterns may change and ovulation can continue.';
    return '';
}
export function developmentRate(s) {
    const n = Number(s?.babyDevelopmentRate);
    return Number.isFinite(n) && n >= 0.25 && n <= 10 ? n : 1;
}
