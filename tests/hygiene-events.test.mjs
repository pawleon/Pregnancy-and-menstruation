// Run: node --experimental-default-type=module --test tests/hygiene-events.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHygieneEvents } from '../hygiene-events.js';
const cases = [["Scarlett changed her pad.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:pad"],["Scarlett put on a fresh pad.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:pad"],["Scarlett put on her pad.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:pad"],["Scarlett replaced her tampon.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:tampon"],["Scarlett inserted a tampon.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:tampon"],["Scarlett emptied her menstrual cup.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:cup"],["Scarlett rinsed her menstrual cup.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:cup"],["Scarlett changed her reusable menstrual cloth.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:cloth"],["Scarlett changed her sanitary belt.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:belt"],["Scarlett replaces her menstrual sponge.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:sponge"],["Scarlett needs to change her pad.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},""],["Scarlett will change her pad later.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},""],["Scarlett never changed her pad.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},""],["Scarlett did not change her pad.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},""],["Scarlett changed her mouse pad.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},""],["Scarlett bought a box of pads.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},""],["Scarlett used a sea sponge to wash dishes.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},""],["Scarlett changed a pad on the desk.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},""],["Hayes changed his pad.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"char:pad"],["She changed her pad.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},""],["She changed her pad.",{"trackFor":"user","userName":"Scarlett Windsor","charName":"Hayes"},"user:pad"],["Scarlett removed her pad and went without.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:none"],["Scarlett handed Hayes a fresh pad.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},""],["Scarlett changed her pad.\n<!-- [HYGIENE_EVENT:{\"who\":\"user\",\"action\":\"change\",\"type\":\"pad\"}] -->",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:pad"],["Scarlett pulled out her phone.\n<!-- [HYGIENE_EVENT:{\"who\":\"user\",\"action\":\"change\",\"type\":\"pad\"}] -->",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},""],["Scarlett changed her pad.\n<!-- [HYGIENE_EVENT:{\"who\":\"char\",\"action\":\"change\",\"type\":\"pad\"}] -->",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:pad"],["Scarlett put on a fresh pad. Hayes replaced his tampon.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:pad,char:tampon"],["She wears an old pad.",{"trackFor":"user","userName":"Scarlett Windsor","charName":"Hayes"},""],["Scarlett removed her tampon and went without.",{"trackFor":"both","userName":"Scarlett Windsor","charName":"Hayes"},"user:none"]];
for (const [scene, opts, expected] of cases) test('hygiene: '+scene.slice(0,60), () => {
  assert.equal(parseHygieneEvents(scene, opts).map(e=>e.who+':'+e.type).join(','),expected);
});

test('automatic events are integrated with the RP clock and rollback snapshots', () => {
    const handler = readFileSync(new URL('../message-handler.js', import.meta.url), 'utf8');
    assert.match(handler, /parseHygieneEvents\(text/);
    assert.match(handler, /target\.hygieneChangedRpDate = event\.type === 'none' \? null : \(p\.rpDate \|\| null\)/);
    assert.match(handler, /pushStateHistory\(positionId\)/);
    assert.match(handler, /restoreTurnBaseline\(positionId\)/);
});

test('manual hygiene controls are available for both carriers', () => {
    const ui = readFileSync(new URL('../ui.js', import.meta.url), 'utf8');
    assert.match(ui, /id="repro-hygiene-\$\{who\}-changed"/);
    assert.match(ui, /repro-hygiene-\$\{who\}-kit/);
    assert.match(ui, /overlay\.find\('#rp-quick-changed'\)/);
    assert.match(ui, /refreshRegenSnapshot\(\)/);
});

test('hygiene tag is stripped with other internal events', () => {
    assert.match(readFileSync(new URL('../scanner.js', import.meta.url), 'utf8'), /HYGIENE_EVENT/);
    assert.match(readFileSync(new URL('../index.js', import.meta.url), 'utf8'), /\[HYGIENE_EVENT:/);
});
