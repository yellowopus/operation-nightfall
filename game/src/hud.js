import { ROUND_TIME } from './rounds.js';
import { PALETTE } from './palette.js';

const SHOP = [
  { id: 'rifle', label: 'Vand Rifle', price: 2700 },
  { id: 'smgAmmo', label: 'SMG Ammo', price: 500 },
  { id: 'armor', label: 'Kevlar (100)', price: 1000 },
  { id: 'grenade', label: 'Frag Grenade', price: 800 },
  { id: 'knife', label: 'Field Knife', price: 300 },
];

const COPY = {
  start: { title: 'Operation Nightfall', copy: 'Clear both hostile teams. Use lanes and corners, then survive the round clock.', action: 'Deploy' },
  buy: { title: 'Re-arm', copy: 'Buy equipment now. Deployment begins when you click Deploy.', action: 'Deploy' },
  paused: { title: 'Paused', copy: 'Click to resume the operation.', action: 'Resume' },
  death: { title: 'KIA', copy: 'Your team lost the round. Re-arm before redeployment.', action: 'Redeploy' },
  timeout: { title: 'Round Lost', copy: 'The clock expired with hostiles still active.', action: 'Redeploy' },
  victory: { title: 'Round Won', copy: 'Every hostile is down and the site is secure. Collect your bonus and prepare for the next deployment.', action: 'Continue' },
};

const WEAPON_ICONS = {
  smg: '[SMG]',
  rifle: '[RFL]',
  knife: '[KNF]',
  grenade: '[GRN]',
  explosion: '[EXPL]',
};

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function clampRatio(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function count(value) {
  return value === Infinity ? '∞' : String(Math.max(0, Math.floor(value)));
}

function timerText(value) {
  const seconds = Math.max(0, Math.ceil(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function scoreParts(value) {
  const [us = '0', them = '0'] = String(value ?? '0-0').split('-');
  return { us: us.trim(), them: them.trim() };
}

function buildShell() {
  const root = el('div', 'night-hud');
  root.id = 'hud';
  root.setAttribute('aria-hidden', 'true');

  const style = el('style');
  style.textContent = `
    .night-hud {
      --hud-accent: ${PALETTE.accent};
      --hud-ink: ${PALETTE.ink};
      --hud-muted: ${PALETTE.muted};
      --hud-line: rgba(124, 143, 171, .35);
      --hud-card: rgba(10, 17, 28, .74);
      position: fixed;
      inset: 0;
      z-index: 20;
      pointer-events: none;
      color: var(--hud-ink);
      font-family: Inter, system-ui, sans-serif;
    }
    .night-hud * { box-sizing: border-box; }
    .night-card {
      padding: 10px 14px;
      border: 1px solid var(--hud-line);
      border-radius: 10px;
      background: var(--hud-card);
      backdrop-filter: blur(8px);
      box-shadow: 0 12px 38px rgba(0, 0, 0, .26);
    }
    .night-label {
      display: block;
      color: var(--hud-muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    .night-readout { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    .night-center {
      position: fixed;
      left: 50%;
      top: 18px;
      transform: translateX(-50%);
      display: grid;
      justify-items: center;
      gap: 9px;
      min-width: 270px;
    }
    .night-timer {
      font-size: 30px;
      font-weight: 650;
      line-height: 1;
      transition: color 180ms ease;
    }
    .night-timer[data-warning="true"] {
      color: #ff6f6f;
      animation: night-timer-pulse 1s ease-in-out infinite;
    }
    @keyframes night-timer-pulse {
      50% { transform: scale(1.07); opacity: .72; }
    }
    .night-score {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 12px;
      width: 100%;
      text-align: center;
    }
    .night-score-value { font-size: 23px; font-weight: 700; }
    .night-score-us .night-score-value { color: #7ed494; }
    .night-score-them .night-score-value { color: #ff8b8b; }
    .night-score-round {
      color: var(--hud-accent);
      font-size: 12px;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .night-vitals {
      position: fixed;
      left: 28px;
      bottom: 26px;
      width: min(240px, 42vw);
      display: grid;
      gap: 5px;
    }
    .night-bar-row { display: grid; gap: 5px; }
    .night-bar-label { display: flex; justify-content: space-between; align-items: end; }
    .night-bar-value { font-size: 20px; font-weight: 650; }
    .night-bar {
      height: 7px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(96, 113, 139, .26);
      border: 1px solid var(--hud-line);
    }
    .night-bar i {
      display: block;
      width: 100%;
      height: 100%;
      transform: scaleX(0);
      transform-origin: left center;
      background: var(--bar-color);
      box-shadow: 0 0 10px color-mix(in srgb, var(--bar-color) 48%, transparent);
      transition: transform 180ms ease, background-color 220ms ease;
    }

    .night-money {
      margin-top: 7px;
      position: relative;
      display: inline-flex;
      align-items: baseline;
      color: #8ee7a4;
      font-size: 29px;
      font-weight: 700;
      text-shadow: 0 0 14px rgba(96, 214, 132, .25);
    }
    .night-money-pop {
      position: absolute;
      right: 2px;
      bottom: 100%;
      color: #baffcf;
      font-size: 16px;
      text-shadow: 0 2px 10px rgba(0, 0, 0, .65);
      animation: night-money-rise 900ms ease forwards;
    }
    @keyframes night-money-rise {
      from { opacity: 0; transform: translateY(8px); }
      20% { opacity: 1; }
      to { opacity: 0; transform: translateY(-28px); }
    }

    .night-weapon {
      position: fixed;
      right: 28px;
      bottom: 26px;
      text-align: right;
      display: grid;
      gap: 6px;
      min-width: 180px;
    }
    .night-ammo {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 9px;
      font-size: 44px;
      font-weight: 700;
      line-height: 1;
    }
    .night-ammo[data-empty="true"] .night-ammo-mag { color: #ff6f6f; }
    .night-ammo-reserve { font-size: 16px; color: var(--hud-muted); }
    .night-reload {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: conic-gradient(var(--hud-accent) calc(var(--reload-progress, 1) * 360deg), rgba(255, 255, 255, .14) 0);
      animation: night-spin 850ms linear infinite;
      opacity: 0;
      visibility: hidden;
      transition: opacity 120ms ease, visibility 120ms;
    }
    .night-reload::after {
      content: '';
      display: block;
      width: 12px;
      height: 12px;
      margin: 5px;
      border-radius: 50%;
      background: #0d1521;
    }
    .night-weapon[data-reloading="true"] .night-reload { opacity: 1; visibility: visible; }
    @keyframes night-spin { to { transform: rotate(1turn); } }
    .night-grenades { color: var(--hud-muted); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }

    .night-feed {
      position: fixed;
      right: 28px;
      top: 18px;
      display: grid;
      justify-items: end;
      gap: 5px;
      max-width: min(360px, 46vw);
    }
    .night-feed-row {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 7px 10px;
      border: 1px solid var(--hud-line);
      border-radius: 6px;
      background: rgba(10, 17, 28, .8);
      font-size: 12px;
      animation: night-feed-in 150ms ease-out;
    }
    .night-feed-icon { color: var(--hud-accent); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    @keyframes night-feed-in {
      from { opacity: 0; transform: translateX(12px); }
      to { opacity: 1; transform: none; }
    }

    .night-crosshair { position: fixed; left: 50%; top: 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); }
    .night-crosshair i { position: absolute; background: var(--hud-ink); opacity: .85; }
    .night-crosshair i:nth-child(1) { left: 21px; top: calc(50% - var(--crosshair-gap) - 7px); width: 2px; height: 7px; }
    .night-crosshair i:nth-child(2) { left: 21px; bottom: calc(50% - var(--crosshair-gap) - 7px); width: 2px; height: 7px; }
    .night-crosshair i:nth-child(3) { top: 21px; left: calc(50% - var(--crosshair-gap) - 7px); height: 2px; width: 7px; }
    .night-crosshair i:nth-child(4) { top: 21px; right: calc(50% - var(--crosshair-gap) - 7px); height: 2px; width: 7px; }
    .night-hit { position: fixed; left: 50%; top: 50%; width: 26px; height: 26px; transform: translate(-50%, -50%) rotate(45deg); opacity: 0; transition: opacity 90ms linear; }
    .night-hit.on { opacity: 1; }
    .night-hit i { position: absolute; background: var(--hud-accent); }
    .night-hit i:nth-child(1) { left: 12px; top: 0; width: 2px; height: 8px; }
    .night-hit i:nth-child(2) { left: 12px; bottom: 0; width: 2px; height: 8px; }
    .night-hit i:nth-child(3) { top: 12px; left: 0; height: 2px; width: 8px; }
    .night-hit i:nth-child(4) { top: 12px; right: 0; height: 2px; width: 8px; }
    .night-damage { position: fixed; inset: 0; background: radial-gradient(circle, transparent 52%, rgba(216, 84, 84, .45)); opacity: 0; transition: opacity 190ms ease; }
    .night-damage.on { opacity: 1; transition: opacity 0ms; }

    .night-overlay {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 20px;
      pointer-events: auto;
      background: rgba(8, 14, 23, .9);
    }
    .night-overlay[hidden] { display: none; }
    .night-panel {
      width: min(520px, 100%);
      padding: 26px;
      border: 1px solid var(--hud-line);
      border-radius: 12px;
      background: rgba(18, 31, 48, .98);
      box-shadow: 0 24px 80px rgba(0, 0, 0, .38);
    }
    .night-panel h1 { margin: 0; font-size: 30px; letter-spacing: -.02em; }
    .night-sub { margin-top: 6px; color: var(--hud-accent); font-size: 13px; }
    .night-copy { margin: 14px 0 20px; color: var(--hud-muted); font-size: 15px; line-height: 1.55; }
    .night-action {
      width: 100%;
      padding: 12px;
      font: inherit;
      font-weight: 650;
      border: 1px solid var(--hud-accent);
      border-radius: 7px;
      background: var(--hud-accent);
      color: #101826;
      cursor: pointer;
    }
    .night-action:hover { background: #ffbb5d; }
    .night-shop { display: grid; gap: 8px; margin-top: 18px; }
    .night-shop[hidden] { display: none; }
    .night-shop-item {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      padding: 11px 13px;
      font: inherit;
      text-align: left;
      border: 1px solid var(--hud-line);
      border-radius: 7px;
      background: rgba(10, 17, 28, .62);
      color: var(--hud-ink);
      cursor: pointer;
    }
    .night-shop-item:hover:not(:disabled) { border-color: var(--hud-accent); color: var(--hud-accent); }
    .night-shop-item:disabled { cursor: not-allowed; }
    .night-shop-item[data-state="owned"] { border-color: rgba(242, 168, 56, .5); background: rgba(242, 168, 56, .1); color: var(--hud-accent); }
    .night-shop-item[data-state="locked"] { opacity: .4; }
    .night-shop-item[data-state="locked"] .night-price { color: #ff9292; }
  `;

  const center = el('div', 'night-center night-card');
  const timer = el('div', 'night-timer night-readout', '1:55');
  const score = el('div', 'night-score');
  const scoreUs = el('div', 'night-score-us');
  const scoreThem = el('div', 'night-score-them');
  const scoreRound = el('div', 'night-score-round night-readout');
  scoreUs.append(el('span', 'night-label', 'Us'), el('span', 'night-score-value', '0'));
  scoreThem.append(el('span', 'night-label', 'Them'), el('span', 'night-score-value', '0'));
  score.append(scoreUs, scoreRound, scoreThem);
  center.append(timer, score);

  const vitals = el('div', 'night-vitals night-card');
  const money = el('div', 'night-money night-readout', '$800');
  const healthValue = el('span', 'night-bar-value', '100');
  const healthBar = el('div', 'night-bar');
  const armorValue = el('span', 'night-bar-value', '0');
  const armorBar = el('div', 'night-bar');
  const healthRow = el('div', 'night-bar-row');
  const armorRow = el('div', 'night-bar-row');
  const healthLabel = el('span', 'night-bar-label');
  const armorLabel = el('span', 'night-bar-label');
  healthLabel.append(el('span', 'night-label', 'Health'));
  armorLabel.append(el('span', 'night-label', 'Armor'));
  healthRow.append(healthLabel, healthValue, healthBar);
  armorRow.append(armorLabel, armorValue, armorBar);
  vitals.append(healthRow, armorRow, money);

  const weapon = el('div', 'night-weapon night-card');
  const weaponName = el('div', 'night-label', 'Kestrel SMG');
  const ammo = el('div', 'night-ammo night-readout');
  const ammoMag = el('span', 'night-ammo-mag', '28');
  const ammoReserve = el('span', 'night-ammo-reserve', '/ 112');
  const reloadRing = el('span', 'night-reload');
  ammo.append(ammoMag, ammoReserve, reloadRing);
  const grenades = el('div', 'night-grenades');
  grenades.append(el('span', 'night-label', 'Frag'), el('b', '', '0'));
  weapon.append(weaponName, ammo, grenades);

  const feed = el('div', 'night-feed');
  const crosshair = el('div', 'night-crosshair');
  const hitmarker = el('div', 'night-hit');
  const damage = el('div', 'night-damage');
  crosshair.append(el('i'), el('i'), el('i'), el('i'));
  hitmarker.append(el('i'), el('i'), el('i'), el('i'));

  const overlay = el('div', 'night-overlay');
  const panel = el('section', 'night-panel');
  const title = el('h1', '', 'Operation Nightfall');
  const subtitle = el('div', 'night-sub');
  const copy = el('p', 'night-copy', COPY.start.copy);
  const action = el('button', 'night-action', COPY.start.action);
  const buyGrid = el('div', 'night-shop');
  panel.append(title, subtitle, copy, action, buyGrid);
  overlay.append(panel);

  root.append(style, damage, crosshair, hitmarker, center, feed, vitals, weapon, overlay);
  return { root, timer, scoreUs, scoreThem, scoreRound, healthValue, healthBar, armorValue, armorBar, money, weapon, weaponName, ammo, ammoMag, ammoReserve, reloadRing, grenades, feed, crosshair, hitmarker, damage, overlay, title, subtitle, copy, action, buyGrid };
}

function setBar(bar, ratio, color) {
  const value = clampRatio(ratio);
  bar.style.transform = `scaleX(${value})`;
  bar.style.setProperty('--bar-color', color);
}

export function createHud() {
  const nodes = buildShell();
  document.getElementById('hud')?.remove();
  document.body.append(nodes.root);

  let lastMoney = 800;
  let lastKills = 0;
  let hitTimer = 0;

  function showMoneyGain(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const popup = el('span', 'night-money-pop', `+$${Math.round(amount)}`);
    nodes.money.append(popup);
    setTimeout(() => popup.remove(), 900);
  }

  function renderBuy(money, owned) {
    nodes.buyGrid.replaceChildren(...SHOP.map((item) => {
      const button = el('button', 'night-shop-item');
      button.type = 'button';
      button.dataset.buy = item.id;
      const isOwned = Boolean(owned[item.id]);
      const label = el('span', 'night-item-label', isOwned ? `${item.label} — Owned` : item.label);
      const price = el('span', 'night-price', isOwned ? 'Owned' : `$${item.price}`);
      button.dataset.state = isOwned ? 'owned' : money < item.price ? 'locked' : 'available';
      button.append(label, price);
      button.disabled = isOwned || money < item.price;
      return button;
    }));
  }

  return {
    setHealth(value) {
      const ratio = clampRatio(value / 100);
      nodes.healthValue.textContent = String(Math.max(0, Math.round(value)));
      nodes.healthValue.style.color = `hsl(${ratio * 88}deg 74% 55%)`;
      setBar(nodes.healthBar, ratio, `hsl(${ratio * 88}deg 74% 45%)`);
    },
    setArmor(value) {
      const ratio = clampRatio(value / 100);
      nodes.armorValue.textContent = String(Math.max(0, Math.round(value)));
      nodes.armorValue.style.color = `hsl(${180 + ratio * 58}deg 76% 62%)`;
      setBar(nodes.armorBar, ratio, `hsl(${180 + ratio * 58}deg 76% 52%)`);
    },
    setMoney(value) {
      const gain = value - lastMoney;
      lastMoney = value;
      nodes.money.textContent = `$${count(value)}`;
      showMoneyGain(gain);
    },
    setAmmo(mag, reserve, reloadProgress = null) {
      nodes.ammoMag.textContent = count(mag);
      nodes.ammoReserve.textContent = `/ ${count(reserve)}`;
      nodes.ammo.dataset.empty = mag === 0 ? 'true' : 'false';
      const progress = reloadProgress === null ? (mag === 0 && reserve > 0 ? 0 : null) : clampRatio(reloadProgress);
      nodes.weapon.dataset.reloading = progress === null ? 'false' : 'true';
      if (progress !== null) nodes.reloadRing.style.setProperty('--reload-progress', String(progress));
    },
    setReload(active, progress = 0) {
      nodes.weapon.dataset.reloading = active ? 'true' : 'false';
      if (active) nodes.reloadRing.style.setProperty('--reload-progress', String(clampRatio(progress)));
    },
    setWeapon(name) { nodes.weaponName.textContent = name; },
    setGrenades(value) {
      nodes.grenades.replaceChildren(el('span', 'night-label', 'Frag'), el('b', '', String(value)));
    },
    setRound(value) { nodes.scoreRound.textContent = `Round ${value}`; },
    setKills(value) {
      lastKills = value;
    },
    setEnemies(value) { nodes.ammo.dataset.enemies = String(value); },
    setScore(value) {
      const parts = scoreParts(value);
      nodes.scoreUs.querySelector('.night-score-value').textContent = parts.us;
      nodes.scoreThem.querySelector('.night-score-value').textContent = parts.them;
    },
    setTimer(value) {
      nodes.timer.textContent = timerText(value);
      nodes.timer.dataset.warning = value > 0 && value <= 15 ? 'true' : 'false';
      nodes.timer.style.setProperty('--time-ratio', String(clampRatio(value / ROUND_TIME)));
    },
    setSpread(value) { nodes.crosshair.style.setProperty('--crosshair-gap', `${4 + clampRatio(value / 0.08) * 28}px`); },
    hitMarker(killed, holdMs = 90) {
      nodes.hitmarker.classList.add('on');
      nodes.hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : 'translate(-50%, -50%) rotate(45deg)';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => nodes.hitmarker.classList.remove('on'), holdMs);
    },
    killFeed(text, weapon = 'smg') {
      const row = el('div', 'night-feed-row');
      row.append(el('span', 'night-feed-icon', WEAPON_ICONS[weapon] ?? '[ARM]'), el('span', '', text));
      nodes.feed.prepend(row);
      setTimeout(() => row.remove(), 4200);
      while (nodes.feed.children.length > 5) nodes.feed.lastElementChild?.remove();
    },
    damageFlash() {
      nodes.damage.classList.add('on');
      setTimeout(() => nodes.damage.classList.remove('on'), 80);
    },
    setState(next) {
      this.setHealth(next.health);
      this.setArmor(next.armor);
      this.setMoney(next.money);
      this.setRound(next.round);
      this.setKills(next.kills);
      this.setScore(next.score);
      this.setEnemies(next.enemies);
      this.setTimer(next.timer);
      if ('reload' in next) this.setReload(next.reload.active, next.reload.progress);
    },
    purchasePrice(itemId) { return SHOP.find((item) => item.id === itemId)?.price ?? 0; },
    showOverlay(mode, extras = {}) {
      const content = COPY[mode] ?? { title: mode, copy: '', action: 'Continue' };
      nodes.title.textContent = content.title;
      nodes.subtitle.textContent = extras.subtitle ?? '';
      nodes.copy.textContent = extras.copy ?? content.copy;
      nodes.action.textContent = content.action;
      nodes.buyGrid.hidden = !extras.showBuy;
      if (extras.showBuy) renderBuy(extras.money ?? 0, extras.owned ?? {});
      nodes.overlay.hidden = false;
      nodes.action.focus();
    },
    hideOverlay() { nodes.overlay.hidden = true; },
    onPlay(handler) { nodes.action.addEventListener('click', handler); },
    onBuy(handler) {
      nodes.buyGrid.addEventListener('click', (event) => {
        const button = event.target.closest('[data-buy]');
        if (button) handler(button.dataset.buy);
      });
    },
  };
}
