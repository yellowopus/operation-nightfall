import * as THREE from 'three';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createWeapon } from './weapon.js';
import { createBots } from './bots.js';
import { createGrenades } from './grenades.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createRounds } from './rounds.js';

const PLAYER_DAMAGE = { min: 8, max: 17 };
const BOT_MAX_RANGE = 34;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#070d16');
scene.fog = new THREE.FogExp2('#070d16', 0.026);

const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.08, 160);
scene.add(camera);

const world = createWorld(scene);
const player = createPlayer(world.colliders);
const weapon = createWeapon(camera, { scene });
const bots = createBots(scene, world.shootables, world.colliders);
const grenades = createGrenades(scene, world.colliders);
const input = createInput(renderer.domElement, (locked) => {
  if (!locked && game.rounds.state.phase === 'live') setOverlay('paused');
});
const game = { rounds: createRounds(), botFire: [], deathTimer: 0, triggerReady: true };
const hud = createHud();

const shotRay = new THREE.Raycaster();
const botRay = new THREE.Raycaster();
const shotDirection = new THREE.Vector3();
const shootables = [...bots.hitMeshes, ...world.shootables];

function playerEye() {
  return new THREE.Vector3(player.state.position.x, player.state.position.y + player.state.eye, player.state.position.z);
}

function setOverlay(mode, extras = {}) {
  hud.showOverlay(mode, extras);
  if (mode === 'buy' || mode === 'start') refreshBuy();
}

function refreshBuy() {
  hud.showOverlay('buy', {
    subtitle: `Round ${game.rounds.state.round} • Wins ${game.rounds.state.wins} • Losses ${game.rounds.state.losses}`,
    showBuy: true,
    money: game.rounds.state.money,
    owned: {
      rifle: weapon.hasWeapon('rifle'),
      knife: weapon.hasWeapon('knife'),
      smgAmmo: weapon.reserveFor('smg') >= weapon.specFor('smg').reserve * 2,
      armor: player.state.armor >= 100,
      grenade: weapon.state.grenades >= 2,
    },
  });
}

function beginBuy() {
  game.botFire.length = 0;
  game.deathTimer = 0;
  player.resetRound();
  weapon.resetRound();
  bots.resetRound();
  grenades.clear();
  input.state.firing = false;
  setOverlay('buy');
}

function deploy() {
  if (game.rounds.state.phase === 'complete') game.rounds.nextRound();
  game.rounds.startRound();
  hud.hideOverlay();
  input.requestLock();
}

function completeRound(result) {
  if (game.rounds.state.phase !== 'live') return;
  game.rounds.completeRound(result);
  document.exitPointerLock();
  const mode = result === 'win' ? 'victory' : result === 'death' ? 'death' : 'timeout';
  setOverlay(mode, {
    subtitle: result === 'win'
      ? `Reward $${game.rounds.state.lastReward} • Round ${game.rounds.state.round}`
      : `Loss streak ${game.rounds.state.lossStreak} • Round ${game.rounds.state.round}`,
  });
  setTimeout(() => {
    game.rounds.nextRound();
    beginBuy();
  }, 1600);
}

function awardBotKill(victim) {
  game.rounds.awardKill();
  hud.killFeed(`You eliminated ${victim.id.replace('bot-', 'Hostile ')}`);
}

function shoot() {
  if (!weapon.ready() || !weapon.takeRound()) return;
  const fireTime = performance.now() / 1000;
  weapon.pullTrigger({ time: fireTime });
  const kick = weapon.recoil();
  const recoilScale = 1
    + Math.min(0.45, player.groundSpeed() / 7.6 * 0.3)
    + (player.state.onGround ? 0 : 0.35)
    - (player.state.crouching ? 0.15 : 0);
  player.recoil(kick.vertical * recoilScale, kick.horizontal * recoilScale);
  weapon.addHeat(weapon.spec().automatic ? 0.075 : 0.18);
  const spread = weapon.spread(player.groundSpeed(), player.state, weapon.state.heat);
  shotDirection.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, -1).normalize().applyQuaternion(camera.quaternion);
  shotRay.set(camera.getWorldPosition(new THREE.Vector3()), shotDirection);
  shotRay.far = 120;
  const hit = shotRay.intersectObjects(shootables, false)[0];
  const traceEnd = hit?.point ?? camera.getWorldPosition(new THREE.Vector3()).addScaledVector(shotDirection, shotRay.far);
  weapon.spawnTracer(weapon.muzzleWorld(), traceEnd, { hit: Boolean(hit) });
  bots.alertAt(traceEnd);
  if (!hit) return;
  const victim = hit.object.userData.target;
  const isHead = hit.object.userData.part === 'head';
  const damageFall = 1 - Math.min(0.38, Math.max(0, (hit.distance - 16) / 90));
  const weaponSpec = weapon.spec();
  const damage = Math.round(
    weaponSpec.damage * (isHead ? weaponSpec.headshotMultiplier : 1) * damageFall,
  );
  if (victim?.alive) {
    if (victim.id?.startsWith('bot-')) {
      const killed = bots.damage(hit.object, damage);
      if (killed) awardBotKill(victim);
    }
    hud.hitMarker(Boolean(victim.alive === false));
  }
}

function botCanHit(bot) {
  const distance = Math.hypot(bot.position.x - player.state.position.x, bot.position.z - player.state.position.z);
  if (distance > BOT_MAX_RANGE) return false;
  const movement = player.groundSpeed() / 7.6;
  const movementPenalty = Math.min(0.14, movement * 0.11)
    + (player.state.crouching ? 0.07 : 0)
    + (player.state.onGround ? 0 : 0.09);
  return Math.random() < Math.max(0.03, 0.46 - bot.aimError) * (1 - movementPenalty);
}

function botFire(bot) {
  if (!player.state.alive || game.rounds.state.phase !== 'live') return;
  game.botFire.push(0.07);
  if (!botCanHit(bot)) return;
  const target = playerEye();
  target.x += (Math.random() - 0.5) * 0.2;
  target.y += (Math.random() - 0.5) * 0.18;
  target.z += (Math.random() - 0.5) * 0.2;
  const origin = new THREE.Vector3(bot.position.x, 1.42, bot.position.z);
  const direction = target.sub(origin).normalize();
  botRay.set(origin, direction);
  botRay.far = 40;
  const wall = botRay.intersectObjects(world.shootables, false)[0];
  const distance = origin.distanceTo(playerEye());
  if (wall && wall.distance < distance) return;
  const damage = Math.random() < 0.18 ? 29 : PLAYER_DAMAGE.min + Math.random() * (PLAYER_DAMAGE.max - PLAYER_DAMAGE.min);
  const killed = player.takeDamage(damage);
  hud.damageFlash();
  if (killed) {
    hud.killFeed(`${bot.id.replace('bot-', 'Hostile ')} eliminated you`);
    player.state.alive = false;
    completeRound('death');
  }
}

function grenadeExplode(position) {
  const grenadeSpec = weapon.specFor('grenade');
  const radius = grenadeSpec.blastRadius;
  const victims = [
    ...bots.items.map((bot) => ({ bot, position: bot.position, alive: bot.alive, height: 1.5 })),
    { player: true, position: player.state.position, alive: player.state.alive, height: player.state.eye },
  ];
  for (const victim of victims) {
    if (!victim.alive) continue;
    const dx = victim.position.x - position.x;
    const dz = victim.position.z - position.z;
    const dy = victim.height - position.y;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > radius) continue;
    const damage = Math.round(grenadeSpec.damage * (1 - distance / radius));
    const direction = new THREE.Vector3().subVectors(
      new THREE.Vector3(victim.position.x, victim.height, victim.position.z),
      position,
    ).normalize();
    const explosionRay = new THREE.Raycaster(position, direction, 0.1, Math.max(0.1, distance - 0.2));
    if (explosionRay.intersectObjects(world.shootables, false).length) continue;
    if (victim.player) {
      const killed = player.takeDamage(damage);
      hud.damageFlash();
      if (killed) {
        player.state.alive = false;
        completeRound('death');
      }
    } else if (bots.damage(victim.bot.torso, damage)) {
      awardBotKill(victim.bot);
    }
  }
}

function handleActions() {
  if (input.takeAction('Escape')) {
    if (game.rounds.state.phase === 'live') document.exitPointerLock();
    return;
  }
  if (game.rounds.state.phase !== 'live' || !player.state.alive) return;
  for (const [code, weaponId] of [['Digit1', 'knife'], ['Digit2', 'smg'], ['Digit3', 'rifle']]) {
    if (input.takeAction(code) && weapon.hasWeapon(weaponId)) weapon.select(weaponId);
  }
  if (input.takeAction('KeyR')) weapon.reload();
  if (input.takeAction('KeyG') && weapon.hasGrenade()) {
    weapon.useGrenade();
    grenades.throwFrom(playerEye(), camera.getWorldDirection(new THREE.Vector3()), 0.8);
  }
}

function updateVisual(dt) {
  camera.position.copy(playerEye());
  camera.rotation.set(player.state.pitch, player.state.yaw, 0, 'YXZ');
  weapon.step(performance.now() / 1000, dt);
  const clip = weapon.clip();
  hud.setAmmo(clip.mag, clip.reserve);
  hud.setGrenades(weapon.state.grenades);
  hud.setWeapon(weapon.spec().name);
  hud.setSpread(weapon.spread(player.groundSpeed(), player.state, weapon.state.heat));
}

function render() {
  requestAnimationFrame(render);
  const dt = Math.min(0.05, clock.getDelta());
  const rounds = game.rounds;
  const look = input.takeLook();
  player.look(look.x, look.y);
  if (rounds.state.phase === 'live' && bots.remaining() === 0) completeRound('win');
  if (rounds.state.phase === 'live') {
    rounds.step(dt);
    player.step(dt, input.state.keys);
    handleActions();
    const wantsFire = input.state.firing && (weapon.spec().automatic || game.triggerReady);
    if (!weapon.spec().automatic && wantsFire) game.triggerReady = false;
    if (wantsFire) shoot();
    if (!input.state.firing) game.triggerReady = true;
    bots.step(dt, rounds.state.timer, player.state, player.state.alive, botFire);
    grenades.step(dt, grenadeExplode);
    for (let index = game.botFire.length - 1; index >= 0; index -= 1) {
      game.botFire[index] -= dt;
      if (game.botFire[index] <= 0) game.botFire.splice(index, 1);
    }
  }
  updateVisual(dt);
  hud.setState({
    health: player.state.health,
    armor: player.state.armor,
    money: rounds.state.money,
    round: rounds.state.round,
    kills: rounds.state.kills,
    score: `${rounds.state.wins}-${rounds.state.losses}`,
    enemies: bots.remaining(),
    timer: rounds.state.timer,
  });
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
hud.onPlay(() => {
  if (document.pointerLockElement) return;
  if (game.rounds.state.phase === 'buy') deploy();
  else if (game.rounds.state.phase === 'live') input.requestLock();
});
hud.onBuy((itemId) => {
  if (!game.rounds.canBuy()) return;
  const price = hud.purchasePrice(itemId);
  if (!game.rounds.spend(price)) return;
  if (itemId === 'rifle') weapon.buyWeapon('rifle');
  else if (itemId === 'smgAmmo') weapon.addReserve('smg', weapon.specFor('smg').reserve);
  else if (itemId === 'armor') player.buyArmor();
  else if (itemId === 'grenade') weapon.buyGrenade();
  else if (itemId === 'knife') weapon.buyWeapon('knife');
  refreshBuy();
});

beginBuy();
render();

