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
    // tap a friend you know: it swims along with you (tap again to send it home)
    $('albumGrid').addEventListener('click', (e) => {
      const c = e.target.closest('.card[data-kind]');
      if (c && !c.classList.contains('locked')) { this.onFollow?.(c.dataset.kind); this.openAlbum(); }
    });
    $('btnWardrobe').addEventListener('click', () => this.openWardrobe());
    $('wardrobeClose').addEventListener('click', () => this.closeWardrobe());
    $('wardrobeChoices').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-category]');
      if (b && !b.disabled) this.onWardrobeSelect?.(b.dataset.category, b.dataset.item);
    });
    $('btnMenu').addEventListener('click', () => { this.renderMenu(); $('menu').classList.remove('hidden'); });
    $('menuClose').addEventListener('click', () => $('menu').classList.add('hidden'));
    // one quest panel: it shows the quest the sparkles follow; tap it to hear it again
    // and open the list of every quest in progress, tap one to follow it instead
    this._mainText = '';
    this._side = { list: [], tracked: 'main' };
    $('quest').addEventListener('click', () => {
      say($('questText').textContent);
      this._sideOpen = !this._sideOpen && this._side.list.length > 0;
      this.renderQuests();
    });
    $('sideQuest').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      e.stopPropagation();
      this._sideOpen = false;
      this.onTrack?.(b.dataset.id);
      say(b.querySelector('.txt').textContent);
    });
    // compass: the sparkles lead to the nearest friend with a quest you have not done yet
    $('btnGiver').addEventListener('click', () => { this._sideOpen = false; this.onFindGiver?.(); });
  }

  setQuest(text, pulse) {
    this._mainText = text;
    this.renderQuests();
    if (pulse) say(text, 'narrator', false); // a new goal is read out after the current line
    if (pulse && this._side.tracked === 'main') { const q = $('quest'); q.classList.remove('pulse'); void q.offsetWidth; q.classList.add('pulse'); }
  }
  setCounts(pearls, friends, stars = 0) { $('pearlCount').textContent = pearls; $('friendCount').textContent = friends; $('starCount').textContent = stars; }

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
    this._side = { list, tracked };
    if (!list.length) this._sideOpen = false;
    this.renderQuests();
  }
  renderQuests() {
    const { list, tracked } = this._side;
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    const all = [{ id: 'main', text: this._mainText, icon: '⭐' }, ...list];
    const cur = all.find((q) => q.id === tracked) || all[0];
    $('questIcon').textContent = cur.icon;
    $('questText').textContent = cur.text;
    $('questDot').classList.toggle('hidden', !cur.color);
    if (cur.color) $('questDot').style.background = hex(cur.color);
    $('questCaret').classList.toggle('hidden', !list.length);
    $('questCaret').textContent = `${this._sideOpen ? '▴' : '▾'} ${all.length}`;
    const rows = this._sideOpen ? all.filter((q) => q !== cur) : [];
    const box = $('sideQuest');
    box.innerHTML = rows.map((q) => `<button class="pill side" data-id="${q.id}">`
      + (q.color ? `<span class="dot" style="background:${hex(q.color)}"></span>` : '') + `<span class="ico">${q.icon}</span><span class="txt"></span></button>`).join('');
    box.querySelectorAll('button').forEach((b, i) => { b.querySelector('.txt').textContent = rows[i].text; });
    box.classList.toggle('hidden', !rows.length);
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
      tail: ['teal', 'rose', 'sapphire', 'rainbow', 'pearl', 'galaxy', 'mint', 'candy', 'sunset', 'lagoon', 'treasure', 'sunshine', 'tropic', 'flamingo'],
      top: ['lavender', 'seaGlass', 'coral', 'gold', 'shellTop', 'berry', 'ocean', 'mintTop', 'sunny', 'palmTop', 'sailor', 'pirateStripe', 'hibiscus', 'peacockTop', 'leafTop'],
      head: ['none', 'coralClip', 'pearlTiara', 'crown', 'pirateHat', 'bow', 'starClip', 'shellCrown', 'flowerCrown', 'bandana', 'sunHat', 'lei', 'leafCrown', 'featherBand', 'sunnies', 'parrotPal'],
      hair: ['long', 'bob', 'buns', 'braids', 'ponytail', 'pigtails', 'flowerBun'],
      hairColor: ['pink', 'golden', 'chestnut', 'midnight', 'seafoam', 'lilac', 'starlight', 'mango', 'coconut', 'jungle', 'sky'],
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
    $('albumHint').textContent = t('followHint');
    const following = this.getFollower?.();
    $('albumGrid').innerHTML = ALBUM.map((k) => {
      const has = friends.includes(k);
      const img = this.thumbs[k];
      return `<div class="card ${has ? '' : 'locked'}${k === following ? ' following' : ''}" data-kind="${k}">${k === following ? '<span class="tag">💕</span>' : ''}${img ? `<img src="${img}" width="80" height="80" alt="">` : '<span class="e">❓</span>'}<div>${has ? t('names.' + k) : '?'}</div></div>`;
    }).join('');
    $('album').classList.remove('hidden');
  }

  renderMenu() {
    const s = this.settings;
    $('menuTitle').textContent = t('settings');
    $('optPaint').textContent = s.paint ? t('paintOn') : t('paintOff');
    $('optSound').textContent = s.sound ? t('soundOn') : t('soundOff');
    $('optVoiceMode').textContent = t(s.voiceMode === 'characters' ? 'voiceCharacters' : 'voiceDevice');
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
      sideQuests: {}, unlocked: ['teal', 'lavender', 'none', 'long', 'pink', 'golden', 'chestnut', 'midnight'],
      outfit: { tail: 'teal', top: 'lavender', head: 'none', hair: 'long', hairColor: 'pink' } };
    const lang = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
    const defS = { paint: true, sound: true, voiceMode: 'device', lang, quality: 'auto' };
    let data = null;
    try { data = JSON.parse(localStorage.getItem('mermaid-ocean-v1') || 'null'); } catch { data = null; }
    this.state = { ...def, ...(data?.state || {}) };
    this.state.sideQuests ||= {};
    this.state.unlocked = Array.isArray(this.state.unlocked) ? this.state.unlocked : [...def.unlocked];
    for (const k of ['long', 'pink', 'golden', 'chestnut', 'midnight']) if (!this.state.unlocked.includes(k)) this.state.unlocked.push(k);
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
