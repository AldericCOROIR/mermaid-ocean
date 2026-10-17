// Voice only: the characters read their lines aloud (Web Speech API) so a child
// who can't read yet can follow the quest. No music and no sound effects.
import { getLang } from './i18n.js';

let enabled = true;
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

// Each character gets its own pitch and pace.
const VOICES = {
  queen: { pitch: 1.0, rate: 0.85 }, whale: { pitch: 0.5, rate: 0.75 }, guard: { pitch: 0.8, rate: 0.9 },
  shelly: { pitch: 1.6, rate: 0.95 }, baby: { pitch: 1.8, rate: 1.0 }, narrator: { pitch: 1.2, rate: 0.9 },
  tico: { pitch: 1.9, rate: 0.95 }, pip: { pitch: 2.0, rate: 1.05 }, splash: { pitch: 1.8, rate: 1.1 }, momo: { pitch: 1.1, rate: 0.8 },
  ambientSeahorse: { pitch: 1.7, rate: 1.0 }, pinch: { pitch: 0.75, rate: 0.95 }, rosa: { pitch: 1.3, rate: 1.0 }, shellby: { pitch: 1.6, rate: 1.05 },
  whelk: { pitch: 0.9, rate: 0.75 }, clawsworth: { pitch: 0.85, rate: 0.9 }, selkie: { pitch: 1.5, rate: 0.95 }, madamePearl: { pitch: 1.1, rate: 0.8 }, citizen: { pitch: 1.25, rate: 0.95 }, activity: { pitch: 1.45, rate: 0.95 },
};
const DEFAULT = { pitch: 1.35, rate: 0.9 };

export function initAudio() {
  // phones only allow speech after a tap: say nothing once to unlock it
  if (synth && enabled) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); }
}

export function setSound(on) {
  enabled = on;
  if (!on) synth?.cancel();
}

function pickVoice(code) {
  const list = synth.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(code));
  return list.find((v) => /female|femme|amelie|amélie|audrey|marie|samantha|google/i.test(v.name)) || list[0] || null;
}

// Read a line aloud. interrupt=true replaces whatever is being said.
export function say(text, who = 'narrator', interrupt = true) {
  if (!enabled || !synth || !text) return;
  const clean = text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  if (interrupt) synth.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  const fr = getLang() === 'fr';
  u.lang = fr ? 'fr-FR' : 'en-US';
  const v = pickVoice(fr ? 'fr' : 'en'); if (v) u.voice = v;
  const p = VOICES[who] || DEFAULT;
  u.pitch = p.pitch; u.rate = p.rate;
  synth.speak(u);
}

export function sfx() { /* sound effects are off on purpose: voice only */ }
