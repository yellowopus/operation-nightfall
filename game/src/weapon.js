// Selectable view weapons. Each owns fire rate, recoil, spread, reserve ammo and reload;
// main.js resolves hits and applies damage from weapon data.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const WEAPONS = {
  knife: {
    name: 'Field Knife', mag: Infinity, reserve: Infinity, fireGap: 0.42, reloadTime: 0,
    damage: 55, headDamage: 130, recoilPitch: 0.006, recoilYaw: 0.002, spread: () => 0,
  },
  smg: {
    name: 'Kestrel SMG', mag: 28, reserve: 112, fireGap: 0.072, reloadTime: 1.55, automatic: true,
    damage: 22, headDamage: 62, recoilPitch: 0.008, recoilYaw: 0.0035,
    spread: (speed, movement = {}, heat = 0) => 0.004 + Math.min(1, speed / 7.6) * 0.028
      + (movement.crouching ? -0.0015 : 0) + (movement.onGround ? 0 : 0.022),
  },
  rifle: {
    name: 'Vand Rifle', mag: 24, reserve: 96, fireGap: 0.103, reloadTime: 2.05, automatic: true,
    damage: 34, headDamage: 105, recoilPitch: 0.013, recoilYaw: 0.005,
    spread: (speed, movement = {}, heat = 0) => 0.002 + Math.min(1, speed / 7.6) * 0.03
      + (movement.crouching ? -0.001 : 0) + (movement.onGround ? 0 : 0.028),
  },
};

export const WEAPON_KEYS = Object.keys(WEAPONS);

export function createWeapon(camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.25 });
  const shell = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.45, metalness: 0.4 });
  const blade = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.25, metalness: 0.8 });

  const model = new THREE.Group();
  const rifle = new THREE.Group();
  const smg = new THREE.Group();
  const knife = new THREE.Group();

  const rifleReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.44), shell);
  const rifleBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.38), grip);
  rifleBarrel.position.set(0, 0.03, -0.4);
  const rifleStock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.24), grip);
  rifleStock.position.set(0, -0.02, 0.32);
  rifle.add(rifleReceiver, rifleBarrel, rifleStock);

  const smgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.12, 0.31), shell);
  const smgBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.22), grip);
  smgBarrel.position.set(0, 0.02, -0.26);
  const smgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.07), grip);
  smgGrip.position.set(0, -0.12, 0.07);
  smg.add(smgReceiver, smgBarrel, smgGrip);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.06), grip);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.4), blade);
  edge.position.set(0, -0.02, -0.18);
  knife.add(handle, edge);

  model.add(rifle, smg, knife);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.85);
  flash.visible = false;
  camera.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.55);
  camera.add(flashLight);

  const ammo = {
    knife: { mag: Infinity, reserve: Infinity },
    smg: { mag: WEAPONS.smg.mag, reserve: WEAPONS.smg.reserve },
    rifle: { mag: 0, reserve: 0 },
  };
  const state = { current: 'smg', cooldown: 0, reloadLeft: 0, flash: 0, kick: 0, heat: 0, ownsKnife: false, grenades: 0 };

  function setVisible() {
    rifle.visible = state.current === 'rifle';
    smg.visible = state.current === 'smg';
    knife.visible = state.current === 'knife';
  }
  setVisible();

  function spec() {
    return WEAPONS[state.current];
  }

  function step(time, dt = 0.016) {
    if (state.reloadLeft > 0) {
      state.reloadLeft -= dt;
      if (state.reloadLeft <= 0) {
        state.reloadLeft = 0;
        const clip = ammo[state.current];
        const needed = Math.min(clip.reserve, WEAPONS[state.current].mag - clip.mag);
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
    flash.visible = state.flash > 0;
    flashLight.intensity = state.flash > 0 ? 2.2 : 0;
    model.position.set(0.24, -0.2 + Math.sin(time * 1.7) * 0.004 - state.kick * 0.5, -0.42 + state.kick);
  }

  return {
    state,
    spec,
    addHeat(amount = 0.1) { state.heat = Math.min(1, state.heat + amount); },
    clip() { return ammo[state.current]; },
    reserveFor(id) { return ammo[id].reserve; },
    step,
    select(id) {
      if (!WEAPONS[id] || id === state.current) return;
      state.current = id;
      state.cooldown = Math.max(state.cooldown, 0.28);
      state.reloadLeft = 0;
      setVisible();
    },
    hasWeapon(id) {
      if (id === 'knife') return state.ownsKnife;
      return Boolean(WEAPONS[id] && (ammo[id].mag > 0 || ammo[id].reserve > 0));
    },
    buyWeapon(id) {
      ammo[id].mag = WEAPONS[id].mag;
      ammo[id].reserve = WEAPONS[id].reserve;
      state.current = id;
      state.cooldown = 0;
      state.reloadLeft = 0;
      if (id === 'knife') state.ownsKnife = true;
      setVisible();
    },
    addReserve(id, amount) {
      ammo[id].reserve = Math.min(WEAPONS[id].reserve * 2, ammo[id].reserve + amount);
    },
    specFor(id) { return WEAPONS[id]; },
    hasGrenade() { return state.grenades > 0; },
    buyGrenade() { state.grenades = Math.min(2, state.grenades + 1); },
    useGrenade() { state.grenades = Math.max(0, state.grenades - 1); },
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
      state.current = ammo.rifle.mag > 0 || ammo.rifle.reserve > 0 ? 'rifle' : 'smg';
      setVisible();
    },
    ready() {
      return state.cooldown === 0 && state.reloadLeft === 0 && ammo[state.current].mag > 0;
    },
    canReload() {
      const clip = ammo[state.current];
      return state.reloadLeft === 0 && spec().mag > clip.mag && clip.reserve > 0;
    },
    pullTrigger() {
      state.cooldown = spec().fireGap;
      state.flash = state.current === 'knife' ? 0 : 0.055;
      state.kick = state.current === 'knife' ? 0.02 : 0.05;
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
    spread(speed) { return spec().spread(speed); },
  };
}
