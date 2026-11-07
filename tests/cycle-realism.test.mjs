// Run: node --experimental-default-type=module --test tests/cycle-realism.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { persistCycleRealism } from '../cycle-realism-setting.js';

function chat(initial = {}, save = async () => {}) {
    return {
        chatMetadata: structuredClone(initial),
        saveMetadata: save,
    };
}
const KEY = 'reproductiveSystem_chatOptions_v1';

test('Cycle Realism saves true and survives a simulated reload', async () => {
    let persisted = null;
    const a = chat({ [KEY]: { cycleLengthUser: 35, realism: false } });
    a.saveMetadata = async () => { persisted = structuredClone(a.chatMetadata); };
    assert.equal(await persistCycleRealism(a, KEY, true), true);
    const reopened = chat(persisted);
    assert.equal(reopened.chatMetadata[KEY].realism, true);
    assert.equal(reopened.chatMetadata[KEY].cycleLengthUser, 35);
});

test('Cycle Realism is isolated between chats and accepts explicit false', async () => {
    const a = chat(), b = chat();
    assert.equal(await persistCycleRealism(a, KEY, true), true);
    assert.equal(b.chatMetadata[KEY]?.realism, undefined);
    assert.equal(await persistCycleRealism(a, KEY, false), true);
    assert.equal(a.chatMetadata[KEY].realism, false);
});

test('Missing or unwritable chat never saves a global fallback', async () => {
    assert.equal(await persistCycleRealism(null, KEY, true), false);
    assert.equal(await persistCycleRealism({ chatMetadata: {} }, KEY, true), false);
});

test('Failed async metadata save rolls back only Cycle Realism', async () => {
    const a = chat({ [KEY]: { pregnancyDuration: 40, realism: false } },
        async () => { throw Error('disk error'); });
    let errorReported = false;
    assert.equal(await persistCycleRealism(a, KEY, true, () => { errorReported = true; }), false);
    assert.equal(a.chatMetadata[KEY].realism, false);
    assert.equal(a.chatMetadata[KEY].pregnancyDuration, 40);
    assert.equal(errorReported, true);
});

test('Failed async save preserves other chat options changed in flight', async () => {
    const a = chat({ [KEY]: { realism: false, cycleLengthUser: 28 } }, async () => {
        a.chatMetadata[KEY] = { ...a.chatMetadata[KEY], cycleLengthUser: 32 };
        throw Error('save failed');
    });
    assert.equal(await persistCycleRealism(a, KEY, true), false);
    assert.equal(a.chatMetadata[KEY].realism, false);
    assert.equal(a.chatMetadata[KEY].cycleLengthUser, 32);
});
