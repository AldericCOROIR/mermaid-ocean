// Bundled French lines give each character an offline voice. Browser speech
// remains the fallback, including English and devices without MP3 playback.
import { getLang } from './i18n.js';
import { VOICE_INDEX } from './voice-index.js';

let enabled = true;
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let clipEnabled = false;
let voiceMode = 'device';
let currentClip = null;
let currentUtterance = null;
let playing = false;
let generation = 0;
const queue = [];

// Each character gets its own pitch and pace.
const VOICES = {
  marina: { pitch: 1.35, rate: 0.94 }, coral: { pitch: 1.48, rate: 1.0 }, pearl: { pitch: 1.27, rate: 0.98 },
  mama: { pitch: 1.2, rate: 0.82 }, tailor: { pitch: 1.38, rate: 0.91 }, baker: { pitch: 1.43, rate: 1.02 },
  keeper: { pitch: 0.92, rate: 0.86 }, bard: { pitch: 1.13, rate: 0.86 }, librarian: { pitch: 0.83, rate: 0.8 },
  fairy: { pitch: 1.68, rate: 1.0 }, dolphin: { pitch: 1.58, rate: 1.05 }, turtle: { pitch: 0.8, rate: 0.79 },
  queen: { pitch: 1.0, rate: 0.85 }, whale: { pitch: 0.5, rate: 0.75 }, guard: { pitch: 0.8, rate: 0.9 },
  shelly: { pitch: 1.6, rate: 0.95 }, baby: { pitch: 1.8, rate: 1.0 }, narrator: { pitch: 1.2, rate: 0.9 },
  tico: { pitch: 1.9, rate: 0.95 }, pip: { pitch: 2.0, rate: 1.05 }, splash: { pitch: 1.8, rate: 1.1 }, momo: { pitch: 1.1, rate: 0.8 },
  ambientSeahorse: { pitch: 1.7, rate: 1.0 }, pinch: { pitch: 0.75, rate: 0.95 }, rosa: { pitch: 1.3, rate: 1.0 }, shellby: { pitch: 1.6, rate: 1.05 },
  whelk: { pitch: 0.9, rate: 0.75 }, clawsworth: { pitch: 0.85, rate: 0.9 }, selkie: { pitch: 1.5, rate: 0.95 }, madamePearl: { pitch: 1.1, rate: 0.8 }, citizen: { pitch: 1.25, rate: 0.95 }, activity: { pitch: 1.45, rate: 0.95 },
  granny: { pitch: 1.05, rate: 0.8 }, inky: { pitch: 1.7, rate: 1.05 }, sandy: { pitch: 1.4, rate: 1.05 }, puffy: { pitch: 1.9, rate: 1.0 },
  glim: { pitch: 0.95, rate: 0.9 }, luna: { pitch: 1.5, rate: 0.8 }, bubbles: { pitch: 1.85, rate: 1.1 }, ottie: { pitch: 1.6, rate: 1.0 },
  polly: { pitch: 1.5, rate: 1.1 }, coco: { pitch: 1.3, rate: 1.05 }, gully: { pitch: 1.7, rate: 1.1 }, pelly: { pitch: 0.95, rate: 0.9 },
  billy: { pitch: 1.2, rate: 1.0 }, batty: { pitch: 1.9, rate: 1.1 }, boo: { pitch: 1.8, rate: 0.9 }, shelldon: { pitch: 0.7, rate: 0.75 },
  zip: { pitch: 2.0, rate: 1.2 }, piggy: { pitch: 1.4, rate: 1.0 }, leo: { pitch: 1.1, rate: 1.0 }, kitty: { pitch: 1.75, rate: 1.0 }, snappy: { pitch: 0.8, rate: 0.95 },
  mayor: { pitch: 1.0, rate: 0.85 }, bun: { pitch: 1.6, rate: 1.0 }, bolt: { pitch: 1.2, rate: 1.05 }, rio: { pitch: 1.55, rate: 1.1 },
  tuki: { pitch: 1.65, rate: 1.05 }, flora: { pitch: 1.3, rate: 0.85 }, hum: { pitch: 2.0, rate: 1.2 }, pavo: { pitch: 1.05, rate: 0.9 },
  banjo: { pitch: 1.7, rate: 1.15 }, slo: { pitch: 0.85, rate: 0.6 }, ribbit: { pitch: 1.25, rate: 1.0 }, kami: { pitch: 1.85, rate: 1.05 }, zaza: { pitch: 1.9, rate: 1.1 },
};
function fallbackProfile(who) {
  if (VOICES[who]) return VOICES[who];
  const n = [...who].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 7);
  return { pitch: 0.8 + (n % 85) / 100, rate: 0.78 + ((n >>> 8) % 30) / 100 };
}

export function initAudio() {
  // phones only allow speech after a tap: say nothing once to unlock it
  if (synth && enabled && typeof SpeechSynthesisUtterance !== 'undefined') {
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch { /* no browser voice */ }
  }
  try { clipEnabled = typeof Audio !== 'undefined' && !!new Audio().canPlayType('audio/mpeg'); }
  catch { clipEnabled = false; }
}

export function stopAudio() {
  generation++;
  queue.length = 0;
  try { synth?.cancel(); } catch { /* browser speech unavailable */ }
  if (currentClip) { try { currentClip.pause(); currentClip.currentTime = 0; } catch { /* playback already ended */ } currentClip = null; }
  currentUtterance = null;
  playing = false;
}

export function setSound(on) {
  enabled = on;
  if (!on) stopAudio();
}

export function setVoiceMode(mode) {
  voiceMode = mode === 'characters' ? 'characters' : 'device';
  stopAudio();
}

function pickVoice(code, who) {
  let list;
  try { list = synth.getVoices().filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(code)); }
  catch { return null; }
  if (!list.length) return null;
  const ids = Object.keys(VOICES);
  const i = ids.indexOf(who);
  const n = i >= 0 ? i : [...who].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 7);
  return list[n % list.length];
}

const clean = (text) => text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
const withoutCounter = (text) => text.replace(/\s+\d+\/\d+(?=\s|$)/g, '');

function browserSay(line, finish) {
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { finish(); return; }
  let u;
  try { u = new SpeechSynthesisUtterance(line.text); } catch { finish(); return; }
  const fr = getLang() === 'fr';
  u.lang = fr ? 'fr-FR' : 'en-US';
  const v = pickVoice(fr ? 'fr' : 'en', line.who); if (v) u.voice = v;
  const p = fallbackProfile(line.who);
  u.pitch = p.pitch; u.rate = p.rate;
  u.onend = finish;
  u.onerror = finish;
  currentUtterance = u;
  try { synth.speak(u); } catch { finish(); }
}

function playNext() {
  if (playing || !enabled) return;
  const line = queue.shift();
  if (!line) return;
  playing = true;
  const turn = generation;
  let done = false;
  const finish = () => {
    if (done || turn !== generation) return;
    done = true;
    currentClip = null;
    currentUtterance = null;
    playing = false;
    playNext();
  };
  const exact = VOICE_INDEX[`${line.who}|${line.text}`];
  const clipPath = exact || VOICE_INDEX[`${line.who}|${withoutCounter(line.text)}`];
  if (voiceMode === 'characters' && clipEnabled && getLang() === 'fr' && clipPath) {
    let clip;
    try { clip = new Audio(clipPath); } catch { browserSay(line, finish); return; }
    currentClip = clip;
    clip.onended = finish;
    const fallback = () => {
      if (turn !== generation || currentClip !== clip) return;
      currentClip = null;
      browserSay(line, finish);
    };
    clip.onerror = fallback;
    try { clip.play().catch(fallback); } catch { fallback(); }
  } else browserSay(line, finish);
}

// interrupt=false queues goal and reward lines behind the current dialogue.
export function say(text, who = 'narrator', interrupt = true) {
  if (!enabled || !text) return;
  const spoken = clean(text);
  if (!spoken) return;
  if (interrupt) stopAudio();
  queue.push({ text: spoken, who });
  playNext();
}

export function sfx() { /* sound effects are off on purpose: voice only */ }
