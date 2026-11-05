// User-visible summaries for confirmed contraception changes. Keeping this
// separate from the event replay avoids changing pregnancy/protection logic.
const METHOD_NAMES = Object.freeze({
    none: 'None', condom: 'External condom', pill: 'Birth control pill', iud: 'IUD',
    implant: 'Contraceptive implant', injection: 'Contraceptive injection',
    patch: 'Contraceptive patch', ring: 'Vaginal ring', internal_condom: 'Internal condom',
    diaphragm: 'Diaphragm', cervical_cap: 'Cervical cap', spermicide: 'Spermicide',
    withdrawal: 'Withdrawal', fertility_awareness: 'Fertility awareness / rhythm',
    historical_condom: 'Historical membrane condom', historical_sponge: 'Historical sponge / barrier',
});

export const contraceptionMethodName = method => METHOD_NAMES[method] || 'Contraception';
const htmlSafe = value => String(value || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

/** A single notice about an actual event, not about pregnancy probability. */
export function contraceptionEventNotice(event, name = 'Character') {
    if (!event || !event.action) return null;
    const method = contraceptionMethodName(event.method);
    const subject = htmlSafe(name);
    const messages = {
        start: { text: `${method} started`, type: 'success', icon: 'fa-shield-heart' },
        stop: { text: `${method} stopped / removed`, type: 'info', icon: 'fa-shield-halved' },
        add: { text: `${method} added as a second method`, type: 'success', icon: 'fa-shield-heart' },
        remove_backup: { text: 'Second contraceptive method removed', type: 'info', icon: 'fa-shield-halved' },
        miss_one: { text: 'One active birth control pill missed', type: 'warning', icon: 'fa-triangle-exclamation' },
        miss_multiple: { text: 'Two or more active birth control pills missed', type: 'warning', icon: 'fa-triangle-exclamation' },
        resume_pills: { text: 'Birth control pills back on schedule', type: 'success', icon: 'fa-calendar-check' },
        expire_implant: { text: 'Contraceptive implant marked expired', type: 'warning', icon: 'fa-triangle-exclamation' },
        use: { text: `${method} used for this encounter only`, type: 'info', icon: 'fa-shield-heart' },
    };
    const msg = messages[event.action];
    if (!msg) return null;
    return {
        message: `<i class="fa-solid ${msg.icon}"></i> Contraception · ${subject}: ${msg.text}`,
        type: msg.type,
    };
}

/** Show a manual change in the same notification style as RP changes. */
export function manualContraceptionNotice(name, field, value) {
    const subject = htmlSafe(name);
    let event = null;
    if (field === 'method') {
        event = { action: value === 'none' ? 'stop' : 'start', method: value };
    } else if (field === 'backup') {
        event = value === 'none' ? { action: 'remove_backup' } : { action: 'add', method: value };
    } else if (field === 'missedPills') {
        event = { action: ({ normal:'resume_pills', one:'miss_one', multiple:'miss_multiple' })[value] };
    } else if (field === 'implantStatus') {
        const status = ({ active:'Implant marked active', not_inserted:'Implant not inserted', removed:'Implant removed', expired:'Implant expired' })[value];
        if (status) return { message:`<i class="fa-solid fa-shield-heart"></i> Contraception · ${subject}: ${status}`, type: value === 'active' ? 'success' : 'warning' };
    } else if (field === 'methodDue') {
        return { message:`<i class="fa-solid fa-calendar-check"></i> Contraception · ${subject}: Renewal due ${htmlSafe(value || 'not set')}`, type:'info' };
    } else if (field === 'implantExpires') {
        return { message:`<i class="fa-solid fa-calendar-check"></i> Contraception · ${subject}: Implant replacement date ${htmlSafe(value || 'cleared')}`, type:'info' };
    }
    // Manual 'None' means deselected, not a particular method removed.
    if (field === 'method' && value === 'none') return { message:`<i class="fa-solid fa-shield-halved"></i> Contraception · ${subject}: Set to None`, type:'info' };
    return event?.action ? contraceptionEventNotice(event, name) : null;
}
