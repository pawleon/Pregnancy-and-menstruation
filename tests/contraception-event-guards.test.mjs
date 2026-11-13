// Run: node --experimental-default-type=module --test tests/contraception-event-guards.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySpecialContraceptionEvent } from '../contraception-event-guards.js';

const cases = [
  [
    "I pulled out my phone.",
    "withdrawal",
    "use",
    false
  ],
  [
    "You pulled out the chair.",
    "withdrawal",
    "use",
    false
  ],
  [
    "I pulled out my sword. We had sex later.",
    "withdrawal",
    "use",
    false
  ],
  [
    "They had sex. He pulled out his phone afterward.",
    "withdrawal",
    "use",
    false
  ],
  [
    "They had sex. He pulled out before he came.",
    "withdrawal",
    "use",
    true
  ],
  [
    "He pulled out of her.",
    "withdrawal",
    "use",
    true
  ],
  [
    "They had intercourse. He withdrew before climax.",
    "withdrawal",
    "use",
    true
  ],
  [
    "She used the withdrawal method during sex.",
    "withdrawal",
    "use",
    true
  ],
  [
    "He pulled out of the driveway.",
    "withdrawal",
    "use",
    false
  ],
  [
    "They did not have sex. He pulled out a chair.",
    "withdrawal",
    "use",
    false
  ],
  [
    "I started using the withdrawal method.",
    "withdrawal",
    "start",
    true
  ],
  [
    "I stopped using the withdrawal method.",
    "withdrawal",
    "stop",
    true
  ],
  [
    "I started a withdrawal from my bank.",
    "withdrawal",
    "start",
    false
  ],
  [
    "I never started using the withdrawal method.",
    "withdrawal",
    "start",
    false
  ],
  [
    "He used his diaphragm for deep breathing.",
    "diaphragm",
    "use",
    false
  ],
  [
    "They had sex. I used my diaphragm to breathe.",
    "diaphragm",
    "use",
    false
  ],
  [
    "They had sex. She inserted her diaphragm beforehand.",
    "diaphragm",
    "use",
    true
  ],
  [
    "She inserted her contraceptive diaphragm before sex.",
    "diaphragm",
    "use",
    true
  ],
  [
    "She used a diaphragm during intercourse.",
    "diaphragm",
    "use",
    true
  ],
  [
    "We started using diaphragm breathing exercises.",
    "diaphragm",
    "start",
    false
  ],
  [
    "We started using a diaphragm for contraception.",
    "diaphragm",
    "start",
    true
  ],
  [
    "She stopped using her diaphragm as contraception.",
    "diaphragm",
    "stop",
    true
  ],
  [
    "She added a diaphragm as her second method.",
    "diaphragm",
    "add",
    true
  ],
  [
    "She inserted a diaphragm to prevent pregnancy, but there was no sex.",
    "diaphragm",
    "use",
    false
  ],
  [
    "We began using an IUD.",
    "iud",
    "start",
    true
  ],
  [
    "We used a sea sponge to clean.",
    "historical_sponge",
    "use",
    true
  ],
  [
    "<!-- [CONTRACEPTION_EVENT:{\"who\":\"user\",\"action\":\"use\",\"method\":\"withdrawal\"}] -->",
    "withdrawal",
    "use",
    false
  ],
  [
    "They had sex. I pulled out my phone. He pulled out before climax.",
    "withdrawal",
    "use",
    false,
    "I pulled out my phone"
  ],
  [
    "They had sex. I pulled out my phone. He pulled out before climax.",
    "withdrawal",
    "use",
    true,
    "He pulled out before climax"
  ]
];
for (const [scene, method, action, expected, actionLine] of cases) {
  test(`${method} ${action}: ${scene.slice(0, 75)}${actionLine ? ' [specific sentence]' : ''}`, () => {
    assert.equal(verifySpecialContraceptionEvent(scene, method, action, actionLine || null), expected);
  });
}
