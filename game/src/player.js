import * as THREE from 'three';

const RADIUS = 0.34;
const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;
const STAND_EYE = 1.6;
const CROUCH_EYE = 1.02;
const WALK_SPEED = 5.2;
const SPRINT_SPEED = 7.6;
const CROUCH_SPEED = 2.4;
const GROUND_ACCELERATION = 44;
const AIR_ACCELERATION = 10;
const FRICTION = 10;
const GRAVITY = 21;
const MAX_FALL_SPEED = 30;
const JUMP_SPEED = 6.2;
const COLLISION_SKIN = 0.001;
const BODY_LIFT = 0.04;
const BOB_FREQUENCY = 10.5;
const BOB_AMPLITUDE = 0.045;
const BOB_SIDE_AMPLITUDE = 0.035;
const FOOTSTEP_STRIDE = 2.1;

const SPAWN = Object.freeze({ x: 0, y: 0, z: 9.5 });

function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

function isDown(keys, ...codes) {
  return codes.some((code) => keys.has(code));
}

export function createPlayer(colliders) {
  const player = {
    position: new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    baseEye: STAND_EYE,
    eye: STAND_EYE,
    onGround: true,
    crouching: false,
    height: STAND_HEIGHT,
    sprinting: false,
    health: 100,
    armor: 0,
    alive: true,
    bob: { time: 0, vertical: 0, side: 0 },
    footstep: { phase: 0, distance: 0, stride: FOOTSTEP_STRIDE, count: 0 },
  };
  const probe = new THREE.Box3();
  const wish = new THREE.Vector3();

  function bodyBox(x, y, z, height, lift = BODY_LIFT) {
    probe.min.set(x - RADIUS, y + lift, z - RADIUS);
    probe.max.set(x + RADIUS, y + Math.max(lift + COLLISION_SKIN, height - lift), z + RADIUS);
    return probe;
  }

  function colliderAt(x, y, z, height, lift = BODY_LIFT) {
    const box = bodyBox(x, y, z, height, lift);
    return colliders.find((collider) => collider.intersectsBox(box)) || null;
  }

  function moveAxis(axis, distance, height) {
    if (!distance) return;
    const next = player.position.clone();
    next[axis] += distance;
    const blocker = colliderAt(next.x, next.y, next.z, height);
    if (!blocker) {
      player.position[axis] = next[axis];
      return;
    }

    if (distance > 0) player.position[axis] = blocker.min[axis] - RADIUS - COLLISION_SKIN;
    else player.position[axis] = blocker.max[axis] + RADIUS + COLLISION_SKIN;
    player.velocity[axis] = 0;
  }

  function moveVertically(height) {
    player.position.y += player.velocity.y * player.dt;
    player.onGround = false;
    const blocker = colliderAt(player.position.x, player.position.y, player.position.z, height, 0);

    if (blocker && player.velocity.y <= 0) {
      player.position.y = blocker.max.y + COLLISION_SKIN;
      player.velocity.y = 0;
      player.onGround = true;
    } else if (blocker) {
      player.position.y = blocker.min.y - height - COLLISION_SKIN;
      player.velocity.y = 0;
    }

    if (player.position.y < 0) {
      player.position.y = 0;
      player.velocity.y = 0;
      player.onGround = true;
    }
  }

  function updateCrouch(keys, dt) {
    const wantsCrouch = isDown(keys, 'ControlLeft', 'ControlRight', 'KeyC');
    if (wantsCrouch && !player.crouching) {
      player.crouching = true;
      player.height = CROUCH_HEIGHT;
    } else if (!wantsCrouch && player.crouching && !colliderAt(player.position.x, player.position.y, player.position.z, STAND_HEIGHT, 0.01)) {
      player.crouching = false;
      player.height = STAND_HEIGHT;
    }
    player.baseEye = damp(player.baseEye, player.crouching ? CROUCH_EYE : STAND_EYE, 13, dt);
    player.eye = player.baseEye;
  }

  function updateWishDirection(keys) {
    const forward = (isDown(keys, 'KeyW') ? 1 : 0) - (isDown(keys, 'KeyS') ? 1 : 0);
    const strafe = (isDown(keys, 'KeyD') ? 1 : 0) - (isDown(keys, 'KeyA') ? 1 : 0);
    wish.set(0, 0, 0);
    if (forward || strafe) {
      const sinYaw = Math.sin(player.yaw);
      const cosYaw = Math.cos(player.yaw);
      wish.set(cosYaw * strafe - sinYaw * forward, 0, -sinYaw * strafe - cosYaw * forward).normalize();
    }
    return forward;
  }

  function updateFootsteps(travelled, dt) {
    const bob = player.bob;
    const step = player.footstep;
    if (!player.onGround) {
      bob.time = damp(bob.time, Math.round(bob.time / Math.PI) * Math.PI, 9, dt);
      return;
    }

    bob.time += travelled * BOB_FREQUENCY;
    step.distance += travelled;
    if (step.distance >= step.stride) {
      step.distance %= step.stride;
      step.phase = step.phase === 0 ? 1 : 0;
      step.count += 1;
    }
  }

  function updateBob(dt) {
    const intensity = player.onGround
      ? Math.min(1, player.groundSpeed() / SPRINT_SPEED)
      : 0;
    player.bob.vertical = Math.sin(player.bob.time) * BOB_AMPLITUDE * intensity;
    player.bob.side = Math.cos(player.bob.time * 0.5) * BOB_SIDE_AMPLITUDE * intensity;
    player.eye += player.bob.vertical;
  }

  function step(dt, keys) {
    player.dt = Math.max(0, dt);
    const timeStep = player.dt;
    updateCrouch(keys, timeStep);
    const forwardInput = updateWishDirection(keys);

    player.sprinting = !player.crouching && player.onGround && forwardInput > 0
      && isDown(keys, 'ShiftLeft', 'ShiftRight');
    const targetSpeed = player.crouching ? CROUCH_SPEED : player.sprinting ? SPRINT_SPEED : WALK_SPEED;
    const acceleration = player.onGround ? GROUND_ACCELERATION : AIR_ACCELERATION;
    player.velocity.x = damp(player.velocity.x, wish.x * targetSpeed, acceleration / targetSpeed, timeStep);
    player.velocity.z = damp(player.velocity.z, wish.z * targetSpeed, acceleration / targetSpeed, timeStep);

    if (player.onGround && !wish.lengthSq()) {
      const damping = Math.exp(-FRICTION * timeStep);
      player.velocity.x *= damping;
      player.velocity.z *= damping;
    }

    const horizontalDistance = Math.hypot(player.velocity.x, player.velocity.z) * timeStep;
    if (isDown(keys, 'Space') && player.onGround) {
      player.velocity.y = JUMP_SPEED;
      player.onGround = false;
    }
    player.velocity.y = Math.max(-MAX_FALL_SPEED, player.velocity.y - GRAVITY * timeStep);

    moveAxis('x', player.velocity.x * timeStep, player.height);
    moveAxis('z', player.velocity.z * timeStep, player.height);
    moveVertically(player.height);
    updateFootsteps(horizontalDistance, timeStep);
    player.eye = player.baseEye;
    updateBob(timeStep);
  }

  function look(dx, dy, sensitivity = 0.0022) {
    player.yaw -= dx * sensitivity;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - dy * sensitivity));
  }

  function recoil(pitchKick, yawKick) {
    player.pitch = Math.min(1.45, player.pitch + pitchKick);
    player.yaw += yawKick;
  }

  return {
    state: player,
    step,
    look,
    recoil,
    groundSpeed() {
      return Math.hypot(player.velocity.x, player.velocity.z);
    },
    takeDamage(amount) {
      if (!player.alive || !(amount > 0)) return false;
      const armorDamage = Math.min(player.armor, amount * 0.5);
      const healthDamage = amount - armorDamage;
      player.armor -= armorDamage;
      player.health -= healthDamage;
      if (player.health > 0) return false;
      player.health = 0;
      player.alive = false;
      return true;
    },
    buyArmor() {
      player.armor = 100;
    },
    resetRound() {
      player.health = 100;
      player.alive = true;
      player.armor = 0;
      player.position.set(SPAWN.x, SPAWN.y, SPAWN.z);
      player.velocity.set(0, 0, 0);
      player.yaw = 0;
      player.pitch = 0;
      player.height = STAND_HEIGHT;
      player.crouching = false;
      player.onGround = true;
      player.baseEye = STAND_EYE;
      player.eye = STAND_EYE;
      player.bob.time = 0;
      player.bob.vertical = 0;
      player.bob.side = 0;
      player.footstep.phase = 0;
      player.footstep.distance = 0;
      player.footstep.count = 0;
    },
  };
}
