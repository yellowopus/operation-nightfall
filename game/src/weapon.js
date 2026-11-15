// View weapons and throwables. Combat data stays declarative here; the caller
// resolves hits and decides how to apply damage and headshot bonuses.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const HEADSHOT_MULTIPLIER = 4;
const AMMO_CAP_MULTIPLIER = 2;
const EQUIPMENT_KEYS = new Set(['grenade']);

const WEAPONS = {
  knife: {
    name: 'Field Knife',
    fireRate: 2.4,
    fireGap: 1 / 2.4,
    mag: Infinity,
    reserve: Infinity,
    reloadTime: 0,
    damage: 55,
    headshotMultiplier: HEADSHOT_MULTIPLIER,
    recoilPattern: [[0.007, 0.002], [0.009, -0.001]],
    recoilPitch: 0.007,
    recoilYaw: 0.002,
    spread: () => 0,
  },
  smg: {
    name: 'Kestrel SMG',
    automatic: true,
    fireRate: 13.9,
    fireGap: 1 / 13.9,
    mag: 28,
    reserve: 112,
    reloadTime: 1.55,
    damage: 22,
    headshotMultiplier: HEADSHOT_MULTIPLIER,
    recoilPattern: [
      [0.008, 0.002],
      [0.009, 0.004],
      [0.01, -0.003],
      [0.011, 0.005],
      [0.01, -0.006],
    ],
    recoilPitch: 0.008,
    recoilYaw: 0.004,
    spread(speed, movement = {}, heat = 0) {
      const movementSpread = Math.min(1, speed / 7.6) * 0.028;
      const stanceSpread = movement.crouching ? -0.0022 : 0;
      const airSpread = movement.onGround ? 0 : 0.022;
      return 0.004 + movementSpread + stanceSpread + airSpread + heat * 0.012;
    },
  },
  rifle: {
    name: 'Vand Rifle',
    automatic: true,
    fireRate: 9.7,
    fireGap: 1 / 9.7,
    mag: 24,
    reserve: 96,
    reloadTime: 2.05,
    damage: 34,
    headshotMultiplier: HEADSHOT_MULTIPLIER,
    recoilPattern: [
      [0.015, 0.001],
      [0.017, 0.004],
      [0.019, -0.005],
      [0.018, 0.008],
      [0.016, -0.008],
    ],
    recoilPitch: 0.015,
    recoilYaw: 0.004,
    spread(speed, movement = {}, heat = 0) {
      const movementSpread = Math.min(1, speed / 7.6) * 0.03;
      const stanceSpread = movement.crouching ? -0.0015 : 0;
      const airSpread = movement.onGround ? 0 : 0.028;
      return 0.002 + movementSpread + stanceSpread + airSpread + heat * 0.018;
    },
  },
  grenade: {
    name: 'Frag Grenade',
    equipment: true,
    fireRate: 1.25,
    fireGap: 1 / 1.25,
    mag: 2,
    reserve: 0,
    reloadTime: 0,
    damage: 92,
    blastRadius: 6.2,
    headshotMultiplier: HEADSHOT_MULTIPLIER,
    recoilPattern: [[0.008, 0.002]],
    recoilPitch: 0.008,
    recoilYaw: 0.002,
    spread: () => 0,
  },
};

export const WEAPON_KEYS = Object.keys(WEAPONS);

function createMaterial(color, roughness, metalness) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness });
}

function createRifle(materials) {
  const group = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.44), materials.shell);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.38), materials.grip);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.24), materials.grip);
  barrel.position.set(0, 0.03, -0.4);
  stock.position.set(0, -0.02, 0.32);
  group.add(receiver, barrel, stock);
  return group;
}

function createSmg(materials) {
  const group = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.12, 0.31), materials.shell);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.22), materials.grip);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.07), materials.grip);
  barrel.position.set(0, 0.02, -0.26);
  grip.position.set(0, -0.12, 0.07);
  group.add(receiver, barrel, grip);
  return group;
}

function createKnife(materials) {
  const group = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.06), materials.grip);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.4), materials.blade);
  edge.position.set(0, -0.02, -0.18);
  group.add(handle, edge);
  return group;
}

export function createWeapon(camera, environment = {}) {
  const materials = {
    grip: createMaterial(PALETTE.hairline, 0.7, 0.25),
    shell: createMaterial(PALETTE.ink, 0.45, 0.4),
    blade: createMaterial(PALETTE.accent, 0.25, 0.8),
  };
  const rifle = createRifle(materials);
  const smg = createSmg(materials);
  const knife = createKnife(materials);
  const model = new THREE.Group();

  model.add(rifle, smg, knife);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.accent),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  flash.visible = false;
  model.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.55);
  camera.add(flashLight);

  const muzzlePoints = new Map([
    ['rifle', new THREE.Vector3(0, 0.03, -0.6)],
    ['smg', new THREE.Vector3(0, 0.02, -0.38)],
    ['knife', new THREE.Vector3(0, -0.02, -0.39)],
  ]);
  const ammo = {
    knife: { mag: Infinity, reserve: Infinity },
    smg: { mag: WEAPONS.smg.mag, reserve: WEAPONS.smg.reserve },
    rifle: { mag: 0, reserve: 0 },
    grenade: { mag: 0, reserve: 0 },
  };
  const state = {
    current: 'smg',
    cooldown: 0,
    reloadLeft: 0,
    flash: 0,
    kick: 0,
    heat: 0,
    ownsKnife: false,
    grenades: 0,
    recoilIndex: 0,
    lastShotTime: -Infinity,
  };
  const hooks = { muzzleFlash: [], tracer: [] };
  const tracers = [];

  function spec() {
    return WEAPONS[state.current];
  }

  function setVisible() {
    rifle.visible = state.current === 'rifle';
    smg.visible = state.current === 'smg';
    knife.visible = state.current === 'knife';
    const muzzle = muzzlePoints.get(state.current);
    flash.position.copy(muzzle || new THREE.Vector3());
    flash.rotation.z = Math.random() * Math.PI * 2;
  }

  function subscribe(list, handler) {
    if (typeof handler !== 'function') return () => {};
    list.push(handler);
    return () => {
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    };
  }

  function emitMuzzleFlash(payload = {}) {
    const isGun = state.current === 'rifle' || state.current === 'smg';
    state.flash = isGun ? 0.055 : 0;
    flashLight.intensity = isGun ? 2.2 : 0;
    const event = { weapon: state.current, time: payload.time ?? 0, muzzle: flash.getWorldPosition(new THREE.Vector3()) };
    hooks.muzzleFlash.forEach((handler) => handler(event));
    return event;
  }

  function spawnTracer(from, to, options = {}) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([from.x, from.y, from.z, to.x, to.y, to.z], 3));
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(PALETTE.accent),
      transparent: true,
      opacity: options.opacity ?? 0.7,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    const event = { weapon: state.current, line, from: from.clone(), to: to.clone(), hit: Boolean(options.hit) };
    if (environment.scene) environment.scene.add(line);
    hooks.tracer.forEach((handler) => handler(event));
    tracers.push({ line, life: 0.07, maxLife: 0.07 });
    return event;
  }

  function step(time, dt = 0.016) {
    if (state.reloadLeft > 0) {
      state.reloadLeft -= dt;
      if (state.reloadLeft <= 0) {
        state.reloadLeft = 0;
        const clip = ammo[state.current];
        const capacity = WEAPONS[state.current].mag;
        const needed = Math.min(clip.reserve, capacity - clip.mag);
        if (needed > 0) {
          clip.mag += needed;
          if (clip.reserve !== Infinity) clip.reserve -= needed;
        }
      }
    }

    state.cooldown = Math.max(0, state.cooldown - dt);
    state.heat = Math.max(0, state.heat - dt * 1.7);
    state.flash = Math.max(0, state.flash - dt);
    state.kick = Math.max(0, state.kick - dt * 10);
    if (time - state.lastShotTime > spec().fireGap * 2.5) state.recoilIndex = 0;

    flash.visible = state.flash > 0;
    flash.rotation.z += dt * 12;
    if (state.flash === 0) flashLight.intensity = 0;
    model.position.set(0.24, -0.2 + Math.sin(time * 1.7) * 0.004 - state.kick * 0.5, -0.42 + state.kick);

    for (let index = tracers.length - 1; index >= 0; index -= 1) {
      const tracer = tracers[index];
      tracer.life -= dt;
      tracer.line.material.opacity = Math.max(0, tracer.life / tracer.maxLife) * 0.7;
      if (tracer.life <= 0) {
        if (environment.scene) environment.scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        tracer.line.material.dispose();
        tracers.splice(index, 1);
      }
    }
  }

  function recoil() {
    const pattern = spec().recoilPattern;
    const [vertical, horizontal] = pattern[state.recoilIndex % pattern.length];
    return { vertical, horizontal, pitch: vertical, yaw: horizontal };
  }

  return {
    state,
    spec,
    step,
    recoil,
    addHeat(amount = 0.1) {
      state.heat = Math.min(1, state.heat + amount);
    },
    clip() {
      return ammo[state.current];
    },
    reserveFor(id) {
      return id === 'grenade' ? state.grenades : ammo[id].reserve;
    },
    muzzleWorld(target = new THREE.Vector3()) {
      model.updateWorldMatrix(true, false);
      const muzzle = muzzlePoints.get(state.current) || new THREE.Vector3();
      return target.copy(muzzle).applyMatrix4(model.matrixWorld);
    },
    onMuzzleFlash(handler) {
      return subscribe(hooks.muzzleFlash, handler);
    },
    onTracer(handler) {
      return subscribe(hooks.tracer, handler);
    },
    emitMuzzleFlash,
    spawnTracer,
    select(id) {
      if (!WEAPONS[id] || EQUIPMENT_KEYS.has(id) || id === state.current) return;
      state.current = id;
      state.cooldown = Math.max(state.cooldown, 0.28);
      state.reloadLeft = 0;
      setVisible();
    },
    hasWeapon(id) {
      if (id === 'knife') return state.ownsKnife;
      if (id === 'grenade') return state.grenades > 0;
      return Boolean(WEAPONS[id] && !WEAPONS[id].equipment && (ammo[id].mag > 0 || ammo[id].reserve > 0));
    },
    buyWeapon(id) {
      if (id === 'grenade') {
        state.grenades = Math.min(WEAPONS.grenade.mag, state.grenades + 1);
        return;
      }
      ammo[id].mag = WEAPONS[id].mag;
      ammo[id].reserve = WEAPONS[id].reserve;
      state.current = id;
      state.cooldown = 0;
      state.reloadLeft = 0;
      if (id === 'knife') state.ownsKnife = true;
      setVisible();
    },
    addReserve(id, amount) {
      const capacity = WEAPONS[id].reserve * AMMO_CAP_MULTIPLIER;
      ammo[id].reserve = Math.min(capacity, ammo[id].reserve + amount);
    },
    specFor(id) {
      return WEAPONS[id];
    },
    hasGrenade() {
      return state.grenades > 0;
    },
    buyGrenade() {
      state.grenades = Math.min(WEAPONS.grenade.mag, state.grenades + 1);
    },
    useGrenade() {
      state.grenades = Math.max(0, state.grenades - 1);
    },
    refillRounds() {
      for (const id of ['smg', 'rifle']) {
        ammo[id].mag = WEAPONS[id].mag;
        ammo[id].reserve = Math.max(ammo[id].reserve, WEAPONS[id].reserve);
      }
    },
    resetRound() {
      state.cooldown = 0;
      state.reloadLeft = 0;
      state.flash = 0;
      state.kick = 0;
      state.heat = 0;
      state.recoilIndex = 0;
      state.current = ammo.rifle.mag > 0 || ammo.rifle.reserve > 0 ? 'rifle' : 'smg';
      setVisible();
    },
    ready() {
      return state.cooldown === 0 && state.reloadLeft === 0 && ammo[state.current].mag > 0;
    },
    canReload() {
      const clip = ammo[state.current];
      const capacity = spec().mag;
      return state.reloadLeft === 0 && capacity !== Infinity && capacity > clip.mag && clip.reserve > 0;
    },
    pullTrigger(payload = {}) {
      state.cooldown = spec().fireGap;
      state.kick = state.current === 'knife' ? 0.02 : 0.05;
      state.lastShotTime = payload.time ?? 0;
      state.recoilIndex += 1;
      return emitMuzzleFlash(payload);
    },
    takeRound() {
      const clip = ammo[state.current];
      if (clip.mag <= 0) return false;
      if (clip.mag !== Infinity) clip.mag -= 1;
      return true;
    },
    reload() {
      if (!this.canReload()) return;
      state.reloadLeft = spec().reloadTime;
    },
    spread(speed, movement = {}, heat = state.heat) {
      return spec().spread(speed, movement, heat);
    },
  };
}
