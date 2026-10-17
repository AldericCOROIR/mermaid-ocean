// Development-time voice generation. Only the resulting MP3s ship to phones.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { voiceStrings } from '../src/i18n.js';
import { CHAINS } from '../src/chains.js';
import { VOICE_REPLY } from '../src/voice-dialogue.js';

const root = process.cwd();
const model = join(root, '.local/piper/fr_FR-mls-medium.onnx');
const piper = join(root, '.local/piper/piper/piper.exe');
const wavRoot = join(root, '.local/voice-wav');
const outRoot = join(root, 'assets/voice/fr');
if (!existsSync(model) || !existsSync(piper)) throw new Error('Piper and its French MLS model are required in .local/piper.');

const s = voiceStrings('fr');
const speakerNames = [...new Set([...Object.keys(s.npc), ...Object.keys(VOICE_REPLY), 'narrator'])].sort();
const preferred = { marina: 3, queen: 11, guard: 21, coral: 27, pearl: 35, mama: 43,
  baby: 51, shelly: 62, whale: 70, tailor: 78, baker: 86, keeper: 94,
  bard: 102, librarian: 111, fairy: 123, dolphin: 6, turtle: 56, narrator: 116 };
const used = new Set(Object.values(preferred));
for (const who of speakerNames) {
  if (who in preferred) continue;
  // Distinct speaker ID for every character, stable across rebuilds.
  let id = createHash('sha256').update(who).digest().readUInt16LE(0) % 125;
  while (used.has(id)) id = (id + 1) % 125;
  preferred[who] = id;
  used.add(id);
}

const clean = (text) => text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
const lines = new Map();
function add(who, text) {
  const spoken = clean(text);
  if (!spoken || spoken.includes('{')) throw new Error(`Unresolved voice line: ${who}: ${text}`);
  if (!(who in preferred)) throw new Error(`No speaker for ${who}: ${text}`);
  const id = createHash('sha256').update(`${who}\n${spoken}`).digest('hex').slice(0, 16);
  const path = `${who}/${id}.mp3`;
  lines.set(`${who}|${spoken}`, { who, text: spoken, path });
}

const npcIds = [...new Set([...Object.keys(s.npc), ...Object.keys(VOICE_REPLY)])].sort((a, b) => b.length - a.length);
function talkSpeaker(key) {
  for (const [id, chain] of Object.entries(CHAINS)) {
    if (!key.startsWith(id)) continue;
    const match = key.slice(id.length).match(/^([1-9])(Quest|Done|Deliver)$/);
    if (match) return match[2] === 'Deliver' ? chain.steps[Number(match[1]) - 1].to : chain.giver;
    if (key === `${id}After`) return chain.giver;
  }
  if (key === 'free' || key === 'tailGift') return 'queen';
  if (/^seahorse/.test(key)) return 'ambientSeahorse';
  if (/^citizen/.test(key)) return 'citizen';
  if (/^(market|garden|court|music)/.test(key) || key === 'library') return 'activity';
  return npcIds.find((id) => key.startsWith(id)) || null;
}
for (const [key, text] of Object.entries(s.talk)) {
  if (key === 'chainHint') continue;
  const who = talkSpeaker(key);
  if (!who) throw new Error(`Talk line has no speaker: ${key}`);
  add(who, text);
}
for (const [who, replies] of Object.entries(VOICE_REPLY)) for (const text of Object.values(replies)) add(who, text);

// A chain hint displays its changing collection count. The spoken instruction
// uses the same goal without a count; audio.js strips only that counter when
// matching a clip, so every district still has a character-specific hint.
for (const [id, chain] of Object.entries(CHAINS)) for (let k = 0; k < chain.steps.length; k++) {
  const goal = s.side[`${id}${k + 1}`];
  if (!goal) throw new Error(`Missing side goal ${id}${k + 1}`);
  add(chain.giver, s.talk.chainHint.replace('{goal}', goal));
}

const allNames = [...new Set([...Object.values(s.names), ...Object.values(s.npc)])];
function variants(value) {
  if (value.includes('{name}')) return allNames.map((name) => value.replace('{name}', name));
  if (value.includes('{n}')) return Array.from({ length: 11 }, (_, n) => value.replace('{n}', n));
  return [value];
}
for (const group of [s.q, s.side]) for (const value of Object.values(group)) for (const text of variants(value)) add('narrator', text);
for (const text of Object.values(s.names)) add('narrator', `${s.newFriend} ${text}`);
for (const value of Object.values(s.wardrobe)) if (typeof value === 'string') add('narrator', `${value} ✨`);
for (const [key, value] of Object.entries(s)) {
  if (typeof value !== 'string') continue;
  if (['tagline', 'start', 'rotate', 'album', 'settings', 'paintOn', 'paintOff', 'soundOn', 'soundOff', 'lang', 'qHigh', 'qMed', 'qLow', 'reset'].includes(key)) continue;
  for (const text of variants(value)) add('narrator', text);
}
add('narrator', 'Le micro est indisponible. Tu peux jouer sans parler.');
add('narrator', 'Je n’ai pas entendu. Essaie encore ou continue sans parler.');

function run(bin, args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}: ${err.slice(-1000)}`)));
    child.stdin.end(input);
  });
}

for (const who of speakerNames) { await mkdir(join(wavRoot, who), { recursive: true }); await mkdir(join(outRoot, who), { recursive: true }); }
const entries = [...lines.values()];
const pending = entries.filter((line) => !existsSync(join(outRoot, line.path)));
const needsWav = pending.filter((line) => {
  const wav = join(wavRoot, line.path.replace(/\.mp3$/, '.wav'));
  return !existsSync(wav) || statSync(wav).size < 100;
});
console.log(`${entries.length} distinct French lines, ${speakerNames.length} voices; ${needsWav.length} to synthesize, ${pending.length} to encode.`);
if (needsWav.length) {
  const batches = [[], []];
  needsWav.forEach((line, i) => batches[i % batches.length].push(line));
  await Promise.all(batches.filter(b => b.length).map((batch) => {
    const input = batch.map(({ who, text, path }) => JSON.stringify({
      text, speaker_id: preferred[who], output_file: join(wavRoot, path.replace(/\.mp3$/, '.wav')),
    })).join('\n') + '\n';
    return run(piper, ['--model', model, '--config', model + '.json', '--json-input', '--quiet'], input);
  }));
}
if (pending.length) {
  let done = 0;
  let cursor = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < pending.length) {
      const line = pending[cursor++];
      const wav = join(wavRoot, line.path.replace(/\.mp3$/, '.wav'));
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
        '-af', 'loudnorm=I=-20:TP=-2:LRA=9', '-codec:a', 'libmp3lame', '-b:a', '48k', join(outRoot, line.path)]);
      await rm(wav);
      if (++done % 100 === 0) console.log(`${done}/${pending.length} MP3s encoded`);
    }
  }));
}

// Delete stale recordings, including names from the first implementation.
const keep = new Set(entries.map(({ path }) => path.replaceAll('\\', '/')));
for (const who of await readdir(outRoot)) {
  const dir = join(outRoot, who);
  for (const file of await readdir(dir)) if (!keep.has(`${who}/${file}`)) await rm(join(dir, file));
}
const index = Object.fromEntries([...lines.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, line]) => [key, `./assets/voice/fr/${line.path}`]));
await writeFile(join(root, 'src/voice-index.js'), `// Generated by tools/generate-voices.mjs.\nexport const VOICE_INDEX = ${JSON.stringify(index)};\n`);
console.log(`Wrote src/voice-index.js with ${Object.keys(index).length} offline lines.`);
