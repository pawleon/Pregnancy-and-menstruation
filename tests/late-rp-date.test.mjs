import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const index = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const start = index.indexOf('        const processFinalMessage = (messageIndex) => {');
const end = index.indexOf('\n        // Fallback: render the infoblock', start);
assert.ok(start >= 0 && end > start);
const code = index.slice(start, end);
function scenario() {
  const chat = [
    {is_user: false, mes: '<!-- [RP_DATE:15.11.2026 03:18] -->'},
    {is_user: false, mes: 'Gwen remains unaware. <!-- [RP_DATE:16.11.2026 08:24] -->'}
  ];
  const calls = [], errors = [];
  let current = '15.11.2026', advances = 0;
  const scanDate = text => {
    const found = ['16.11.2026', '15.11.2026'].find(d => text.includes('[RP_DATE:' + d));
    if (!found) return false;
    calls.push(found);
    if (found !== current) { current = found; advances++; return true; }
    return false;
  };
  const maker = new Function('SillyTavern', 'rawTextOf', 'rescanStatusOnly',
    'processDateTag', 'prepareTrackerOutput', 'reportError', 'document',
    'stripHiddenTags', 'renderInfoblock', 'getSettings', 'setTimeout',
    'finalStatusSeen', code + '\nreturn processFinalMessage;');
  const run = maker({getContext: () => ({chat, saveChat: () => {}})},
    m => m.mes, () => {}, scanDate, () => false,
    e => errors.push(String(e)), {querySelector: () => null},
    s => s, () => {}, () => ({}), () => {}, new WeakMap());
  return {run, calls, errors, chat, get: () => ({current, advances})};
}
test('late RP_DATE caught on final message render', () => {
  const t = scenario(); t.run(1);
  assert.equal(t.get().current, '16.11.2026');
  assert.equal(t.get().advances, 1);
});
test('duplicate final events do not double-advance date', () => {
  const t = scenario(); t.run(1); t.run(1);
  assert.equal(t.get().advances, 1);
});
test('old message rerender never rewinds RP date', () => {
  const t = scenario(); t.run(1); t.run(0);
  assert.equal(t.get().current, '16.11.2026');
  assert.equal(t.get().advances, 1);
});
test('pregnancy awareness is not modified', () => {
  const t = scenario(); t.run(1);
  assert.ok(t.chat[1].mes.includes('Gwen remains unaware'));
  assert.deepEqual(t.errors, []);
});
