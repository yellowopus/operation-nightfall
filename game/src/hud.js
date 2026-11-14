// The DOM HUD and overlay buy menu. It never advances the simulation; main.js pushes
// authoritative game state into it and receives play/purchase intents.
const COPY = {
  start: { title: 'Operation Nightfall', copy: 'Clear both hostile teams. Use lanes and corners, then survive the round clock.', action: 'Deploy' },
  buy: { title: 'Re-arm', copy: 'Buy equipment now. Deployment begins when you click Deploy.', action: 'Deploy' },
  paused: { title: 'Paused', copy: 'Click to resume the operation.', action: 'Resume' },
  death: { title: 'KIA', copy: 'Your team lost the round. Re-arm before redeployment.', action: 'Redeploy' },
  timeout: { title: 'Round Lost', copy: 'The clock expired with hostiles still active.', action: 'Redeploy' },
  victory: { title: 'Round Won', copy: 'Every hostile is down and the site is secure. Collect your bonus and prepare for the next deployment.', action: 'Continue' },
};

const SHOP = [
  { id: 'rifle', label: 'Vand Rifle', price: 2700 },
  { id: 'smgAmmo', label: 'SMG Ammo', price: 500 },
  { id: 'armor', label: 'Kevlar (100)', price: 1000 },
  { id: 'grenade', label: 'Frag Grenade', price: 800 },
  { id: 'knife', label: 'Field Knife', price: 300 },
];

export function createHud() {
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const copy = document.getElementById('overlay-copy');
  const action = document.getElementById('play');
  const buyGrid = document.getElementById('buy-grid');
  const health = document.getElementById('health-value');
  const armor = document.getElementById('armor-value');
  const money = document.getElementById('money-value');
  const timer = document.getElementById('timer');
  const round = document.getElementById('round-value');
  const score = document.getElementById('score-value');
  const enemy = document.getElementById('enemy-value');
  const ammoMag = document.getElementById('ammo-mag');
  const ammoReserve = document.getElementById('ammo-reserve');
  const weaponName = document.getElementById('weapon-name');
  const hitmarker = document.getElementById('hitmarker');
  const feed = document.getElementById('kill-feed');
  let hitTimer = 0;
  const crosshair = document.getElementById('crosshair');

  function formatTimer(value) {
    return value <= 0 ? '0:00' : `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  }

  function renderBuy(money, owned) {
    buyGrid.replaceChildren(...SHOP.map((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.buy = item.id;
      const isOwned = Boolean(owned[item.id]);
      button.textContent = isOwned ? `${item.label} — Owned` : `${item.label} — $${item.price}`;
      button.dataset.state = isOwned ? 'owned' : money < item.price ? 'locked' : 'available';
      button.disabled = isOwned || money < item.price;
      return button;
    }));
  }

  return {
    setAmmo(mag, reserve) {
      ammoMag.textContent = mag === Infinity ? '∞' : String(mag);
      ammoReserve.textContent = `/ ${reserve === Infinity ? '∞' : reserve}`;
      document.getElementById('ammo').classList.toggle('empty', mag === 0);
    },
    setGrenades(value) {
      document.getElementById('grenade-value').textContent = String(value);
    },
    setWeapon(name) { weaponName.textContent = name; },
    setScore(value) { score.textContent = String(value); },
    setRound(value) { round.textContent = String(value); },
    setKills(value) { document.getElementById('kills-value').textContent = String(value); },
    setEnemies(value) { enemy.textContent = String(value); },
    setTimer(value) {
      timer.textContent = formatTimer(value);
      timer.dataset.low = value <= 15 ? 'true' : 'false';
    },
    setHealth(value) {
      health.textContent = String(Math.max(0, Math.round(value)));
      document.getElementById('vitals').dataset.low = value <= 30 ? 'true' : 'false';
      document.querySelector('#health-bar i').style.transform = `scaleX(${Math.max(0, value) / 100})`;
    },
    setArmor(value) {
      armor.textContent = String(Math.max(0, Math.round(value)));
      document.querySelector('#armor-bar i').style.transform = `scaleX(${Math.max(0, value) / 100})`;
    },
    setMoney(value) { money.textContent = `$${value}`; },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on'), holdMs);
    },
    killFeed(text) {
      const row = document.createElement('div');
      row.textContent = text;
      feed.prepend(row);
      setTimeout(() => row.remove(), 4200);
      while (feed.children.length > 5) feed.lastChild.remove();
    },
    setSpread(value) {
      crosshair.style.setProperty('--gap', `${4 + Math.min(0.08, value) * 300}px`);
    },
    damageFlash() {
      const damage = document.getElementById('damage');
      damage.classList.add('on');
      setTimeout(() => damage.classList.remove('on'), 80);
    },
    setState(next) {
      this.setHealth(next.health);
      this.setArmor(next.armor);
      this.setMoney(next.money);
      this.setRound(next.round);
      this.setScore(next.score);
      this.setEnemies(next.enemies);
      this.setKills(next.kills);
      this.setTimer(next.timer);
    },
    purchasePrice(itemId) {
      return SHOP.find((item) => item.id === itemId)?.price ?? 0;
    },
    showOverlay(mode, extras = {}) {
      const text = COPY[mode] ?? { title: mode, copy: '', action: 'Continue' };
      title.textContent = text.title;
      copy.textContent = extras.copy ?? text.copy;
      action.textContent = text.action;
      document.getElementById('overlay-sub').textContent = extras.subtitle ?? '';
      buyGrid.hidden = !extras.showBuy;
      if (extras.showBuy) renderBuy(extras.money ?? 0, extras.owned ?? {});
      overlay.hidden = false;
      action.focus();
    },
    hideOverlay() { overlay.hidden = true; },
    onPlay(handler) { action.addEventListener('click', handler); },
    onBuy(handler) {
      buyGrid.addEventListener('click', (event) => {
        const button = event.target.closest('[data-buy]');
        if (button) handler(button.dataset.buy);
      });
    },
  };
}
