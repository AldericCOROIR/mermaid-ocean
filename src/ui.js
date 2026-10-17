// DOM HUD: quest pill, counters, speech bubble, toasts, album, settings.
import { t } from './i18n.js';
import { ALBUM } from './quests.js';
import { say } from './audio.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.thumbs = {};
    this.onBubbleOk = null;
    this.wardrobeOpen = false;
    this.onWardrobeSelect = null;
    this.onWardrobeOpen = null;
    this.onWardrobeClose = null;
    $('bubbleOk').addEventListener('click', () => this.onBubbleOk?.());
    $('bubble').addEventListener('click', (e) => { if (e.target.id !== 'bubbleOk') this.onBubbleOk?.(); });
    $('btnAlbum').addEventListener('click', () => this.openAlbum());
    $('albumClose').addEventListener('click', () => $('album').classList.add('hidden'));
    $('btnWardrobe').addEventListener('click', () => this.openWardrobe());
    $('wardrobeClose').addEventListener('click', () => this.closeWardrobe());
    $('wardrobeChoices').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-category]');
      if (b && !b.disabled) this.onWardrobeSelect?.(b.dataset.category, b.dataset.item);
    });
    $('btnMenu').addEventListener('click', () => { this.renderMenu(); $('menu').classList.remove('hidden'); });
    $('menuClose').addEventListener('click', () => $('menu').classList.add('hidden'));
    // tap a quest to follow its sparkle trail and hear it again
    $('quest').addEventListener('click', () => { this.onTrack?.('main'); say($('questText').textContent); });
    $('sideQuest').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      e.stopPropagation();
      this.onTrack?.(b.dataset.id);
      say(this._sideTexts?.[b.dataset.id]);
    });
  }

  setQuest(text, pulse) {
    $('questText').textContent = text;
    if (pulse) say(text, 'narrator', false); // a new goal is read out after the current line
    if (pulse) { const q = $('quest'); q.classList.remove('pulse'); void q.offsetWidth; q.classList.add('pulse'); }
  }
  setCounts(pearls, friends) { $('pearlCount').textContent = pearls; $('friendCount').textContent = friends; }

  bubble(face, name, text, who) {
    const b = $('bubble');
    if (!face) { b.classList.add('hidden'); return; }
    say(text, who);
    $('bubbleFace').textContent = face; $('bubbleName').textContent = name; $('bubbleText').textContent = text;
    b.classList.remove('hidden');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  }

  toast(text) {
    const el = $('toast');
    el.textContent = text; el.classList.remove('hidden');
    say(text, 'narrator', false);
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  friendPop(kind) {
    const el = $('friendPop');
    const img = this.thumbs[kind];
    $('friendEmoji').innerHTML = img ? `<img src="${img}" width="96" height="96" alt="">` : '💖';
    $('friendName').textContent = `${t('newFriend')} ${t('names.' + kind)}`;
    say($('friendName').textContent, 'narrator', false);
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(this._ft); this._ft = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  actionReady(on) { $('btnAct').classList.toggle('ready', on); $('btnAct').textContent = on ? '💬' : '✨'; }

  // One tappable pill per side quest; the tracked quest (main or side) is highlighted
  // and its sparkle trail is the one shown in the world.
  setSideQuests(list, tracked) {
    const box = $('sideQuest');
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    box.innerHTML = list.map((q) => `<button class="pill side${q.id === tracked ? ' tracked' : ''}" data-id="${q.id}">`
      + `<span class="dot" style="background:${hex(q.color)}"></span><span class="ico">${q.icon}</span><span class="txt"></span></button>`).join('');
    box.querySelectorAll('button').forEach((b, i) => { b.querySelector('.txt').textContent = list[i].text; });
    box.classList.toggle('hidden', !list.length);
    $('quest').classList.toggle('tracked', tracked === 'main' && list.length > 0);
    this._sideTexts = Object.fromEntries(list.map((q) => [q.id, q.text]));
  }

  openWardrobe() {
    $('album').classList.add('hidden'); $('menu').classList.add('hidden');
    this.wardrobeOpen = true;
    $('hud').classList.add('wardrobeMode');
    $('wardrobe').classList.remove('hidden');
    this.renderWardrobe();
    this.onWardrobeOpen?.();
  }
  closeWardrobe() {
    this.wardrobeOpen = false;
    $('wardrobe').classList.add('hidden');
    $('hud').classList.remove('wardrobeMode');
    this.onWardrobeClose?.();
  }
  renderWardrobe() {
    const state = this.getWardrobe?.() || { unlocked: [], outfit: {} };
    $('wardrobeTitle').textContent = t('wardrobe.title');
    $('wardrobeHint').textContent = t('wardrobe.hint');
    const groups = {
      tail: ['teal', 'rose', 'sapphire', 'rainbow'],
      top: ['lavender', 'seaGlass', 'coral', 'gold'],
      head: ['none', 'coralClip', 'pearlTiara', 'crown'],
    };
    $('wardrobeChoices').innerHTML = Object.entries(groups).map(([category, items]) =>
      `<section class="dressGroup"><h3>${t('wardrobe.' + category)}</h3><div class="dressChoices">${items.map((item) => {
        const unlocked = state.unlocked.includes(item);
        return `<button class="dressChoice ${state.outfit[category] === item ? 'selected' : ''}" data-category="${category}" data-item="${item}" ${unlocked ? '' : 'disabled'}>${unlocked ? '' : '🔒 '}${t('wardrobe.' + item)}</button>`;
      }).join('')}</div></section>`).join('');
  }

  openAlbum() {
    const friends = this.getFriends?.() || [];
    $('albumTitle').textContent = `${t('album')} ${friends.length}/${ALBUM.length}`;
    $('albumGrid').innerHTML = ALBUM.map((k) => {
      const has = friends.includes(k);
      const img = this.thumbs[k];
      return `<div class="card ${has ? '' : 'locked'}">${img ? `<img src="${img}" width="80" height="80" alt="">` : '<span class="e">❓</span>'}<div>${has ? t('names.' + k) : '?'}</div></div>`;
    }).join('');
    $('album').classList.remove('hidden');
  }

  renderMenu() {
    const s = this.settings;
    $('menuTitle').textContent = t('settings');
    $('optPaint').textContent = s.paint ? t('paintOn') : t('paintOff');
    $('optSound').textContent = s.sound ? t('soundOn') : t('soundOff');
    $('optLang').textContent = t('lang');
    $('optQuality').textContent = t({ high: 'qHigh', medium: 'qMed', low: 'qLow' }[s.quality]);
    $('optReset').textContent = t('reset');
  }

  applyTitle() {
    $('tagline').textContent = t('tagline');
    $('startLabel').textContent = t('start');
    $('hintRotate').textContent = t('rotate');
  }
}

// Progress & settings, kept in this browser only.
export class Save {
  constructor() {
    const def = { stage: 'meet', pearls: [], crystals: [], friends: [], crown: false, rainbow: false,
      sideQuests: {}, unlocked: ['teal', 'lavender', 'none'],
      outfit: { tail: 'teal', top: 'lavender', head: 'none' } };
    const lang = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
    const defS = { paint: true, sound: true, lang, quality: 'auto' };
    let data = null;
    try { data = JSON.parse(localStorage.getItem('mermaid-ocean-v1') || 'null'); } catch { data = null; }
    this.state = { ...def, ...(data?.state || {}) };
    this.state.sideQuests ||= {};
    this.state.unlocked = Array.isArray(this.state.unlocked) ? this.state.unlocked : [...def.unlocked];
    this.state.outfit = { ...def.outfit, ...(this.state.outfit || {}) };
    this.settings = { ...defS, ...(data?.settings || {}) };
  }
  write() {
    try { localStorage.setItem('mermaid-ocean-v1', JSON.stringify({ state: this.state, settings: this.settings })); } catch { /* private mode */ }
  }
  reset() {
    try { localStorage.removeItem('mermaid-ocean-v1'); } catch { /* ignore */ }
    location.reload();
  }
}
