import * as THREE from 'three';
import { PALETTE } from './palette.js';

const RADIUS = 0.32;
const HEIGHT = 1.68;
const HEALTH = 100;
const VIEW_RANGE = 32;
const VIEW_DOT = 0.5;
const AWARE_VIEW_DOT = 0.12;
const SPOT_DELAY = 0.24;
const SIGHT_MEMORY = 3;
const LEG_DAMAGE_SCALE = 0.72;
const PATROL_SPEED = 2.35;
const COMBAT_SPEED = 3.5;
const STRAFE_SPEED = 2.55;
const PREFERRED_RANGE = 10;
const AIM_ERROR_BASE = 0.24;
const AIM_ERROR_DISTANCE = 0.013;
const AIM_ERROR_SKILL = 0.14;

const SITES = [
  {
    id: 'A',
    color: '#8fb7e5',
    spawn: [[-12, -12], [-9, -8]],
    patrol: [[-12, -12], [-8, -10], [-12, -7], [-15, -10], [-7, -12]],
  },
  {
    id: 'B',
    color: '#f4c98a',
    spawn: [[12, 12], [9, 8]],
    patrol: [[12, 12], [8, 10], [12, 7], [15, 10], [7, 12]],
  },
];

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const signedAngle = (value) => Math.atan2(Math.sin(value), Math.cos(value));

function createBotMesh(siteIndex, materials, geometries) {
  const group = new THREE.Group();
  const legs = new THREE.Mesh(geometries.legs, materials[siteIndex]);
  legs.position.y = 0.33;
  legs.userData.part = 'legs';
  const torso = new THREE.Mesh(geometries.torso, materials[siteIndex]);
  torso.position.y = 1.03;
  torso.userData.part = 'torso';
  const head = new THREE.Mesh(geometries.head, materials.head);
  head.position.y = 1.5;
  head.userData.part = 'head';
  group.add(legs, torso, head);
  group.traverse((mesh) => { if (mesh.isMesh) mesh.castShadow = true; });
  return { group, legs, torso, head };
}

export function createBots(scene, worldShootables, colliders) {
  const materials = {
    head: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.35 }),
  };
  materials[0] = new THREE.MeshStandardMaterial({ color: new THREE.Color(SITES[0].color), roughness: 0.55 });
  materials[1] = new THREE.MeshStandardMaterial({ color: new THREE.Color(SITES[1].color), roughness: 0.55 });

  const geometries = {
    torso: new THREE.BoxGeometry(0.48, 0.74, 0.28),
    legs: new THREE.BoxGeometry(0.42, 0.66, 0.26),
    head: new THREE.SphereGeometry(0.15, 14, 10),
  };

  const items = [];
  const hitMeshes = [];
  const sightRay = new THREE.Raycaster();
  const coverRay = new THREE.Raycaster();
  const bodyBox = new THREE.Box3();
  const rayOrigin = new THREE.Vector3();
  const rayTarget = new THREE.Vector3();

  let botId = 0;
  for (const [siteIndex, site] of SITES.entries()) {
    site.spawn.forEach(([x, z], spawnIndex) => {
      const mesh = createBotMesh(siteIndex, materials, geometries);
      mesh.group.position.set(x, 0, z);
      scene.add(mesh.group);
      const item = {
        id: `bot-${botId += 1}`,
        site: site.id,
        teamIndex: siteIndex,
        spawnIndex,
        group: mesh.group,
        legs: mesh.legs,
        torso: mesh.torso,
        head: mesh.head,
        position: mesh.group.position,
        velocity: new THREE.Vector3(),
        health: HEALTH,
        alive: true,
        yaw: spawnIndex ? Math.PI : 0,
        state: 'patrol',
        patrolWaypoint: spawnIndex,
        patrolWait: 0,
        recentWaypoints: [],
        spotTimer: 0,
        sightMemory: 0,
        lastKnown: new THREE.Vector3(),
        awareTimer: 0,
        aiming: false,
        skill: 0.45 + Math.random() * 0.5,
        aimError: 0.3,
        burstLeft: 0,
        shotCooldown: 0.5 + spawnIndex * 0.22,
        strafeDirection: spawnIndex ? 1 : -1,
        strafeTimer: 0.6 + Math.random() * 0.9,
        coverPoint: null,
        coverTimer: 0,
        coverCooldown: 1.5 + Math.random() * 1.5,
        investigationPoint: new THREE.Vector3(),
        investigationTimer: 0,
        blockedTimer: 0,
        detourTimer: 0,
        detourSign: 1,
        walkPhase: botId * 0.8,
      };
      for (const part of [mesh.legs, mesh.torso, mesh.head]) {
        part.userData.target = item;
        hitMeshes.push(part);
      }
      items.push(item);
    });
  }

  function occupies(x, z, y = 0.06) {
    bodyBox.min.set(x - RADIUS, y, z - RADIUS);
    bodyBox.max.set(x + RADIUS, y + HEIGHT, z + RADIUS);
    return colliders.some((collider) => bodyBox.intersectsBox(collider));
  }

  function blockedByWall(from, to) {
    rayOrigin.copy(from);
    rayTarget.copy(to).sub(from).normalize();
    coverRay.set(rayOrigin, rayTarget);
    coverRay.far = from.distanceTo(to);
    return coverRay.intersectObjects(worldShootables, false)[0] ?? null;
  }

  function canSee(item, player) {
    if (!player.alive) return false;
    rayOrigin.set(item.position.x, 1.45, item.position.z);
    rayTarget.set(player.position.x, player.position.y + player.eye, player.position.z);
    const offsetX = rayTarget.x - rayOrigin.x;
    const offsetZ = rayTarget.z - rayOrigin.z;
    const distance = Math.hypot(offsetX, rayTarget.y - rayOrigin.y, offsetZ);
    if (distance > VIEW_RANGE) return false;
    const forwardX = -Math.sin(item.yaw);
    const forwardZ = -Math.cos(item.yaw);
    const facingDot = (forwardX * offsetX + forwardZ * offsetZ) / Math.hypot(offsetX, offsetZ);
    const minimumFacing = item.sightMemory > 0 || item.awareTimer > 0 ? AWARE_VIEW_DOT : VIEW_DOT;
    if (facingDot < minimumFacing) return false;
    const blocker = blockedByWall(rayOrigin, rayTarget);
    return !blocker || blocker.distance > distance - 0.35;
  }

  function pickPatrolWaypoint(item) {
    const site = SITES.find((candidate) => candidate.id === item.site);
    const choices = site.patrol
      .map((waypoint, index) => ({ index, waypoint }))
      .filter((choice) => choice.index !== item.patrolWaypoint && !item.recentWaypoints.includes(choice.index));
    const available = choices.length ? choices : site.patrol.map((waypoint, index) => ({ index, waypoint }));
    const current = item.position;
    available.sort((a, b) => Math.hypot(a.waypoint[0] - current.x, a.waypoint[1] - current.z)
      - Math.hypot(b.waypoint[0] - current.x, b.waypoint[1] - current.z));
    const selected = available[Math.floor(Math.random() * Math.min(3, available.length))];
    item.patrolWaypoint = selected.index;
    item.recentWaypoints.push(selected.index);
    if (item.recentWaypoints.length > 2) item.recentWaypoints.shift();
    return selected.waypoint;
  }

  function coverCandidate(collider, item, player) {
    if (collider.max.y - collider.min.y < 0.8) return null;
    const threatX = player.position.x;
    const threatZ = player.position.z;
    const awayX = item.position.x - threatX;
    const awayZ = item.position.z - threatZ;
    const threatDistance = Math.hypot(awayX, awayZ) || 1;
    const centerX = (collider.min.x + collider.max.x) * 0.5;
    const centerZ = (collider.min.z + collider.max.z) * 0.5;
    const toCenterX = centerX - item.position.x;
    const toCenterZ = centerZ - item.position.z;
    if (toCenterX * awayX / threatDistance + toCenterZ * awayZ / threatDistance < 0) return null;
    const halfX = (collider.max.x - collider.min.x) * 0.5;
    const halfZ = (collider.max.z - collider.min.z) * 0.5;
    const offset = (Math.abs(awayX) * halfX + Math.abs(awayZ) * halfZ) / threatDistance;
    const x = centerX + (awayX / threatDistance) * (offset + RADIUS + 0.14);
    const z = centerZ + (awayZ / threatDistance) * (offset + RADIUS + 0.14);
    if (occupies(x, z)) return null;
    return { x, z };
  }

  function findCover(item, player) {
    rayOrigin.set(player.position.x, player.position.y + player.eye, player.position.z);
    const scored = [];
    for (const collider of colliders) {
      const candidate = coverCandidate(collider, item, player);
      if (!candidate) continue;
      rayTarget.set(candidate.x, 1.2, candidate.z);
      const blocker = blockedByWall(rayOrigin, rayTarget);
      if (!blocker) continue;
      scored.push({
        candidate,
        score: Math.hypot(candidate.x - item.position.x, candidate.z - item.position.z)
          + Math.random() * 0.8,
      });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored[0]?.candidate ?? null;
  }

  function moveDirection(item, directionX, directionZ, speed, dt) {
    const length = Math.hypot(directionX, directionZ);
    if (!length) return;
    const normalX = directionX / length;
    const normalZ = directionZ / length;
    let moveX = normalX;
    let moveZ = normalZ;
    if (item.detourTimer > 0) {
      const angle = item.detourSign * 1.12;
      moveX = normalX * Math.cos(angle) - normalZ * Math.sin(angle);
      moveZ = normalX * Math.sin(angle) + normalZ * Math.cos(angle);
    }
    const distance = speed * dt;
    const nextX = item.position.x + moveX * distance;
    const nextZ = item.position.z + moveZ * distance;
    const previousX = item.position.x;
    const previousZ = item.position.z;
    if (!occupies(nextX, item.position.z)) item.position.x = nextX;
    if (!occupies(item.position.x, nextZ)) item.position.z = nextZ;
    const progress = Math.hypot(item.position.x - previousX, item.position.z - previousZ);
    item.velocity.set(moveX * speed, 0, moveZ * speed);
    if (progress < distance * 0.35) {
      item.blockedTimer += dt;
      if (item.blockedTimer > 0.16) {
        item.blockedTimer = 0;
        item.detourTimer = 0.45 + Math.random() * 0.2;
        item.detourSign = Math.random() < 0.5 ? -1 : 1;
      }
    } else {
      item.blockedTimer = Math.max(0, item.blockedTimer - dt * 2);
    }
    item.detourTimer = Math.max(0, item.detourTimer - dt);
  }

  function moveTo(item, target, speed, dt) {
    const targetX = target.x ?? target[0];
    const targetZ = target.z ?? target[1];
    const offsetX = targetX - item.position.x;
    const offsetZ = targetZ - item.position.z;
    const distance = Math.hypot(offsetX, offsetZ);
    moveDirection(item, offsetX, offsetZ, distance < speed * dt ? distance / dt : speed, dt);
    item.yaw = Math.atan2(-offsetX, -offsetZ);
    return distance;
  }

  function isAimedAt(item, target, tolerance = 0.15) {
    const offsetX = (target.x ?? target[0]) - item.position.x;
    const offsetZ = (target.z ?? target[1]) - item.position.z;
    const targetYaw = Math.atan2(-offsetX, -offsetZ);
    return Math.abs(signedAngle(targetYaw - item.yaw)) < tolerance;
  }

  function updateAim(item, player) {
    const offsetX = player.position.x - item.position.x;
    const offsetZ = player.position.z - item.position.z;
    const distance = Math.hypot(offsetX, offsetZ);
    const playerMovement = Math.hypot(player.velocity.x, player.velocity.z);
    item.aimError = clamp(
      AIM_ERROR_BASE + distance * AIM_ERROR_DISTANCE - item.skill * AIM_ERROR_SKILL + playerMovement * 0.008,
      0.04,
      0.55,
    );
  }

  function patrol(item, dt) {
    item.aiming = item.awareTimer > 0;
    if (item.patrolWait > 0) {
      item.patrolWait -= dt;
      item.velocity.set(0, 0, 0);
      return;
    }
    const site = SITES.find((candidate) => candidate.id === item.site);
    const waypoint = site.patrol[item.patrolWaypoint];
    const distance = moveTo(item, waypoint, PATROL_SPEED, dt);
    if (distance < 0.5) {
      pickPatrolWaypoint(item);
      item.patrolWait = 0.35 + Math.random() * 0.9;
    }
  }

  function investigate(item, dt) {
    item.aiming = item.awareTimer > 0 || item.sightMemory > 0;
    const distance = moveTo(item, item.investigationPoint, COMBAT_SPEED * 0.78, dt);
    if (distance < 0.55) {
      item.investigationTimer -= dt;
      item.velocity.set(0, 0, 0);
      if (item.investigationTimer <= 0) {
        item.state = 'patrol';
        pickPatrolWaypoint(item);
      } else {
        item.yaw += dt * 2.1 * (Math.sin(item.investigationTimer * 2.3) > 0 ? 1 : -1);
      }
    }
  }

  function combat(item, player, dt, onFire) {
    const offsetX = player.position.x - item.position.x;
    const offsetZ = player.position.z - item.position.z;
    const distance = Math.hypot(offsetX, offsetZ);
    const targetYaw = Math.atan2(-offsetX, -offsetZ);
    item.yaw += signedAngle(targetYaw - item.yaw) * Math.min(1, dt * 9);
    item.aiming = true;
    updateAim(item, player);

    item.strafeTimer -= dt;
    if (item.strafeTimer <= 0) {
      item.strafeTimer = 0.55 + Math.random() * 1.1;
      item.strafeDirection *= -1;
    }

    if (item.coverPoint) {
      const coverDistance = moveTo(item, item.coverPoint, COMBAT_SPEED, dt);
      if (coverDistance < 0.55) {
        item.coverPoint = null;
        item.coverTimer = 0.8 + Math.random() * 0.8;
      }
    } else if (item.coverTimer > 0) {
      item.coverTimer -= dt;
      item.velocity.set(0, 0, 0);
      item.yaw = targetYaw;
    } else {
      const sidewaysX = -offsetZ / (distance || 1) * item.strafeDirection;
      const sidewaysZ = offsetX / (distance || 1) * item.strafeDirection;
      let approach = 0;
      if (distance > PREFERRED_RANGE + 2.5) approach = 0.65;
      else if (distance < PREFERRED_RANGE - 3) approach = -0.45;
      moveDirection(
        item,
        sidewaysX + (offsetX / (distance || 1)) * approach,
        sidewaysZ + (offsetZ / (distance || 1)) * approach,
        STRAFE_SPEED,
        dt,
      );
      item.coverCooldown -= dt;
      if (item.coverCooldown <= 0 || item.health < 68) {
        item.coverPoint = findCover(item, player);
        item.coverCooldown = 2.4 + Math.random() * 2.1;
        if (!item.coverPoint) item.coverCooldown = 1.2;
      }
    }

    item.shotCooldown -= dt;
    if (item.shotCooldown > 0 || !isAimedAt(item, player.position, 0.2)) return;
    if (!item.burstLeft) item.burstLeft = item.skill > 0.72 ? 3 + Math.floor(Math.random() * 2) : 2;
    onFire(item);
    item.burstLeft -= 1;
    item.shotCooldown = item.burstLeft
      ? 0.12
      : 0.82 + (1 - item.skill) * 0.35 + Math.random() * 0.25;
  }

  function damage(mesh, amount) {
    const item = mesh.userData.target;
    if (!item?.alive) return false;
    item.health -= amount * (mesh.userData.part === 'legs' ? LEG_DAMAGE_SCALE : 1);
    item.awareTimer = Math.max(item.awareTimer, 6);
    if (item.health > 0) return false;
    item.alive = false;
    item.health = 0;
    item.group.rotation.x = -Math.PI * 0.5;
    item.group.position.y = 0.1;
    return true;
  }

  function alertAt(position, radius = 16) {
    for (const item of items) {
      if (!item.alive) continue;
      const distance = Math.hypot(item.position.x - position.x, item.position.z - position.z);
      if (distance > radius) continue;
      item.awareTimer = Math.max(item.awareTimer, 2.6);
      item.sightMemory = Math.max(item.sightMemory, Math.min(SIGHT_MEMORY, 1.7));
      item.investigationPoint.set(position.x, 0, position.z);
      item.investigationTimer = 2 + Math.random() * 1.3;
      if (item.state !== 'combat') item.state = 'search';
      item.coverPoint = null;
    }
  }

  function resetRound() {
    for (const item of items) {
      const site = SITES.find((candidate) => candidate.id === item.site);
      const [x, z] = site.spawn[item.spawnIndex];
      item.alive = true;
      item.health = HEALTH;
      item.group.rotation.x = 0;
      item.position.set(x, 0, z);
      item.velocity.set(0, 0, 0);
      item.yaw = item.spawnIndex ? Math.PI : 0;
      item.state = 'patrol';
      item.patrolWaypoint = item.spawnIndex;
      item.recentWaypoints.length = 0;
      item.spotTimer = 0;
      item.sightMemory = 0;
      item.lastKnown.set(0, 0, 0);
      item.awareTimer = 0;
      item.aiming = false;
      item.burstLeft = 0;
      item.shotCooldown = 0.5 + item.spawnIndex * 0.22;
      item.coverPoint = null;
      item.coverTimer = 0;
      item.coverCooldown = 1.5 + Math.random() * 1.5;
      item.investigationTimer = 0;
      item.blockedTimer = 0;
      item.detourTimer = 0;
    }
  }

  function step(dt, _elapsed, player, playerAlive, onFire) {
    const timeStep = Math.min(0.05, Math.max(0, dt));
    for (const item of items) {
      if (!item.alive) continue;
      const sees = playerAlive && canSee(item, player);
      item.awareTimer = Math.max(0, item.awareTimer - timeStep);
      if (sees) {
        item.spotTimer += timeStep;
        item.sightMemory = SIGHT_MEMORY;
        item.lastKnown.set(player.position.x, 0, player.position.z);
        item.investigationPoint.copy(item.lastKnown);
        if (item.state !== 'combat' && item.spotTimer >= SPOT_DELAY) item.state = 'combat';
      } else {
        item.spotTimer = 0;
        item.sightMemory = Math.max(0, item.sightMemory - timeStep);
        if (item.state === 'combat') {
          item.state = 'search';
          item.investigationTimer = 1.5 + Math.random();
          item.coverPoint = null;
          item.coverTimer = 0;
        }
      }

      if (item.state === 'combat' && sees) combat(item, player, timeStep, onFire);
      else if (item.state === 'search' && item.sightMemory > 0) investigate(item, timeStep);
      else patrol(item, timeStep);

      item.group.rotation.y = item.yaw;
      item.walkPhase += timeStep * (item.aiming ? 4 : Math.hypot(item.velocity.x, item.velocity.z) * 3.8);
      item.legs.position.y = 0.33 + Math.abs(Math.sin(item.walkPhase)) * 0.03;
      item.head.position.y = 1.5 + Math.sin(item.walkPhase * 0.5) * 0.012;
    }
  }

  return {
    items,
    hitMeshes,
    damage,
    alertAt,
    step,
    resetRound,
    remaining() { return items.filter((item) => item.alive).length; },
    total() { return items.length; },
  };
}
