// Optional native, offline push-to-talk. Never invokes browser speech
// recognition, which may use a remote service on Android.
import { getLang, t } from './i18n.js';
import { stopAudio } from './audio.js';
import { voiceReply, VOICE_REPLY } from './voice-dialogue.js';
import { FACES } from './quests.js';
import { Capacitor, registerPlugin } from '../vendor/capacitor-core.js';

export class VoiceInput {
  constructor(story, ui) {
    this.story = story;
    this.ui = ui;
    this.button = document.getElementById('btnMic');
    this.available = false;
    this.held = false;
    this.busy = false;
    this.startTask = null;
    this.plugin = registerPlugin('MermaidSpeech');
    this.button.addEventListener('pointerdown', (event) => this.start(event));
    this.button.addEventListener('pointerup', () => this.stop());
    this.button.addEventListener('pointercancel', () => this.stop());
    window.addEventListener('blur', () => this.stop());
  }

  async init() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const status = await this.plugin.status();
      this.available = status.ready === true;
    } catch { this.available = false; }
    this.update();
  }

  update() {
    const show = this.busy || (this.available && this.ui.settings.sound && getLang() === 'fr' && !!this.story.near && !this.story.dialog && !this.ui.wardrobeOpen);
    this.button.classList.toggle('hidden', !show);
  }

  start(event) {
    if (!this.available || this.busy || !this.ui.settings.sound || !this.story.near || getLang() !== 'fr') return;
    event.preventDefault();
    try { this.button.setPointerCapture?.(event.pointerId); } catch { /* capture is optional */ }
    this.held = true;
    this.busy = true;
    stopAudio();
    this.button.classList.add('listening');
    this.button.setAttribute('aria-pressed', 'true');
    this.speaker = this.story.near.id;
    this.startTask = Promise.resolve().then(() => this.plugin.startListening()).then(() => {
      if (!this.held) this.stop();
    }).catch(() => {
      this.held = false;
      this.busy = false;
      this.available = false;
      this.button.classList.remove('listening');
      this.button.setAttribute('aria-pressed', 'false');
      this.ui.toast('Le micro est indisponible. Tu peux jouer sans parler.');
    });
  }

  async stop() {
    if (!this.held && !this.busy) return;
    this.held = false;
    if (!this.startTask) return;
    const task = this.startTask;
    this.startTask = null;
    try {
      await task;
      if (!this.busy) return;
      const { text = '' } = await this.plugin.stopListening();
      const who = this.speaker;
      if (VOICE_REPLY[who]) {
        const { text: reply } = voiceReply(who, text);
        this.ui.bubble(FACES[who] || '🧜‍♀️',
          ['whale', 'dolphin', 'turtle'].includes(who) ? t('names.' + who) : t('npc.' + who), reply, who);
      }
    } catch {
      this.ui.toast('Je n’ai pas entendu. Essaie encore ou continue sans parler.');
    } finally {
      this.busy = false;
      this.button.classList.remove('listening');
      this.button.setAttribute('aria-pressed', 'false');
    }
  }
}
