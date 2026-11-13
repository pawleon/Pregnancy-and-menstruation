// Guard only withdrawal and diaphragm against ordinary-language false positives.
// Both tagged AI events and prose fallback must pass the same scene validation.
export function verifySpecialContraceptionEvent(text, method, action, actionLine = null) {
  if (!['withdrawal', 'diaphragm'].includes(method) || !['use', 'start', 'stop', 'add'].includes(action)) return true;
  const scene = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/\[[^\]]*OOC[^\]]*\]/gi, '');
  const lines = (actionLine ? [actionLine] : scene.split(/[.!?\n]+/))
    .map(line => line.trim()).filter(Boolean);
  if (!lines.length) return false;

  const respiratory = /\b(?:breath(?:e|ed|es|ing)?|respirat(?:ion|ory)|lung|ribcage|hiccup|voice|singing|diaphragm muscle|muscular diaphragm)\b/i;
  const methodLine = line => method === 'diaphragm'
    ? /\bdiaphragm\b/i.test(line) && !respiratory.test(line)
    : /\b(?:withdrawal method|pull[- ]?out method)\b/i.test(line)
      || (/\bwithdrawal\b/i.test(line) && /\b(?:contracept(?:ion|ive)|birth control|pregnancy|sex|relying on|as (?:a|our|the) method)\b/i.test(line));

  // Ongoing contraception choices do not require intercourse.
  if (action !== 'use') {
    const verbs = {
      start: /\b(?:started|began|adopted|chose|chosen|selected|switched to|now using|began relying|started relying)\b/i,
      stop: /\b(?:stopped|quit|discontinued|abandoned|no longer|gave up|stopped relying)\b/i,
      add: /\b(?:added|backup|second method|also using|began combining)\b/i,
    };
    const speculative = /\b(?:will|would|may|might|could|planning|plan to|going to|appointment|scheduled|tomorrow|considering|hypothetical|what if|never|didn.t|hadn.t|remembered|recalled|flashback|used to)\b/i;
    return lines.some(line => methodLine(line) && verbs[action].test(line) && !speculative.test(line));
  }

  // An encounter-only use tag must be grounded in sexual activity in the current message.
  if (/\b(?:no sex|didn.t have sex|did not have sex|without (?:sex|intercourse)|no intercourse|sex education|sex ed|classroom|demonstration|hypothetical|flashback|only kissed|not actually having sex|planning to have sex)\b/i.test(scene)) return false;
  const sexualContext = /\b(?:sex|intercourse|penetrat(?:e|ed|es|ing|ion)|thrust(?:ed|ing|s)?\s+(?:into|inside)|fuck(?:ed|ing|s)?|(?:entered|inside)\s+(?:her|him|me|you)|ejaculat(?:ed|ing|ion)|orgasm(?:ed|ing)|climax(?:ed|ing))\b/i;
  const explicitWithdrawal = /\b(?:pulled|pulls|pulling)\s+out\s+(?:of\s+)?(?:her|him|me|you)\b|\bwithdrew\s+from\s+(?:her|him|me|you)\b/i;
  if (!sexualContext.test(scene) && !(method === 'withdrawal' && explicitWithdrawal.test(scene))) return false;

  if (method === 'diaphragm') {
    const application = /\b(?:inserted|placed|put in|fitted|wore|used|applied|slipped in)\b/i;
    return lines.some(line => methodLine(line) && application.test(line));
  }

  const accidentalObject = /\b(?:pulled|pulls|pulling)\s+out\s+(?:a|an|the|his|her|my|your|their|some)\s+[\w-]+/i;
  const withdrawalAct = /\b(?:pulled|pulls|pulling)\s+out\b|\bwithdrew\s+(?:from\s+(?:her|him|me|you)\b|before\b|in time\b)|\b(?:used|practiced|relied on)\s+(?:the\s+)?(?:withdrawal method|pull[- ]?out method)\b/i;
  return lines.some(line => withdrawalAct.test(line) && !accidentalObject.test(line));
}
