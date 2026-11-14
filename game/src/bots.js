// Two hostile squads patrol A-side and B-side routes. They collide with map geometry,
// spot the player through raycast line-of-sight, and fire in short tactical bursts.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const RADIUS = 0.32;
const HEIGHT = 1.68;
const HEALTH = 100;
const VIEW_RANGE = 32;
const VIEW_DOT = 0.45;
const SPOT_DELAY = 0.32;
const LEG_DAMAGE_SCALE = 0.72;
const FORWARD_SPEED = 2.7;
const SPRINT_SPEED = 3.7;

const TEAMS = [
  {
    name: 'Team Wolf',
    color: '#8fb7e5',
    routes: [
      [[-14, -12], [-8, -13], [-7, -8], [-14, -8]],
      [[-4, 12], [-8, 9], [-14, 6], [-11, -8], [-12, -12]],
    ],
    spawns: [[-14, -12], [-8, -13], [-7, -8], [-14, -8]],
    cover: [[-7.2, -3.6], [-11.5, -1.4], [-3.5, -12.0], [-5.0, 5.0], [0.5, -7.5], [-15.0, -5.0], [-4.5, -10.0], [-1.5, -11.0], [-9.0, 3.5], [-4.0, 1.0]],
  },
  {
    name: 'Team Ember',
    color: '#f4c98a',
    routes: [
      [[14, 12], [8, 13], [7, 8], [14, 8]],
      [[4, -12], [8, -9], [14, -6], [11, 8], [12, 12]],
    ],
    spawns: [[14, 12], [8, 13], [7, 8], [14, 8]],
    cover: [[7.2, 3.6], [11.5, 1.4], [3.5, 12.0], [5.0, -5.0], [-0.5, 7.5], [15.0, 5.0], [4.5, 10.0], [1.5, 11.0], [9.0, -3.5], [4.0, -1.0]],
  },
];

export function createBots(scene, worldShootables, colliders) {
  const teamMaterialA = new THREE.MeshStandardMaterial({ color: new THREE.Color(TEAMS[0].color), roughness: 0.55 });
  const teamMaterialB = new THREE.MeshStandardMaterial({ color: new THREE.Color(TEAMS[1].color), roughness: 0.55 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.35 });
  const deadMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.9 });
  const torsoGeometry = new THREE.BoxGeometry(0.48, 0.74, 0.28);
  const legGeometry = new THREE.BoxGeometry(0.42, 0.66, 0.26);
  const headGeometry = new THREE.SphereGeometry(0.15, 14, 10);
  const items = [];
  const hitMeshes = [];
  const raycaster = new THREE.Raycaster();
  const coverRaycaster = new THREE.Raycaster();
  raycaster.far = VIEW_RANGE + 1;
  const toPlayer = new THREE.Vector3();
  const probe = new THREE.Box3();

  let botId = 0;
  for (const [teamIndex, team] of TEAMS.entries()) {
    team.routes.forEach((route, routeIndex) => {
      const [x, z] = team.spawns[routeIndex];
      const group = new THREE.Group();
      const legs = new THREE.Mesh(legGeometry, teamIndex === 0 ? teamMaterialA : teamMaterialB);
      legs.position.y = 0.33;
      legs.userData.part = 'legs';
      const torso = new THREE.Mesh(torsoGeometry, team === TEAMS[0] ? teamMaterialA : teamMaterialB);
      torso.position.y = 1.03;
      torso.userData.part = 'torso';
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = 1.5;
      head.userData.part = 'head';
      group.add(legs, torso, head);
      group.position.set(x, 0, z);
      group.traverse((mesh) => { if (mesh.isMesh) { mesh.castShadow = true; } });
      scene.add(group);
      const item = {
        id: `bot-${botId += 1}`,
        team: team.name,
        teamIndex,
        group,
        legs,
        torso,
        head,
        health: HEALTH,
        alive: true,
        route,
        waypoint: 1 % route.length,
        position: group.position,
        velocity: new THREE.Vector3(),
        yaw: 0,
        awareTimer: 0,
        aiming: false,
        shotCooldown: 0.4,
        sightTimer: 0,
        lastKnown: new THREE.Vector3(),
        burstLeft: 0,
        walkPhase: botId * 0.8,
        coverPoint: null,
        coverTimer: 0,
        holdingCover: false,
        decisionTimer: 0,
        stuckTimer: 0,
      };
      torso.userData.target = item;
      head.userData.target = item;
      legs.userData.target = item;
      hitMeshes.push(legs, torso, head);
      items.push(item);
    });
  }

  function overlaps(x, z) {
    probe.min.set(x - RADIUS, 0.06, z - RADIUS);
    probe.max.set(x + RADIUS, HEIGHT, z + RADIUS);
    for (const collider of colliders) if (probe.intersectsBox(collider)) return true;
    return false;
  }

  function canSee(item, player) {
    if (!player.alive) return false;
    const origin = new THREE.Vector3(item.position.x, 1.45, item.position.z);
    const target = new THREE.Vector3(player.position.x, player.position.y + player.eye, player.position.z);
    toPlayer.subVectors(target, origin);
    const distance = toPlayer.length();
    if (distance > VIEW_RANGE) return false;
    const forwardX = -Math.sin(item.yaw);
    const forwardZ = -Math.cos(item.yaw);
    const facing = (forwardX * toPlayer.x + forwardZ * toPlayer.z) / distance;
    if (item.awareTimer > 0 || facing > VIEW_DOT) {
      const direction = toPlayer.clone().normalize();
      raycaster.set(origin, direction);
      const wall = raycaster.intersectObjects(worldShootables, false)[0];
      return !wall || wall.distance > distance - 0.35;
    }
    return false;
  }

  function findCover(item, target) {
    let best = null;
    let bestScore = Infinity;
    const focusX = target?.x ?? item.position.x;
    const focusZ = target?.z ?? item.position.z;
    for (const [x, z] of TEAMS[item.teamIndex].cover) {
      if (Math.hypot(x - focusX, z - focusZ) < 2.2) continue;
      const observer = new THREE.Vector3(focusX, 1.38, focusZ);
      const coverPoint = new THREE.Vector3(x, 1.38, z);
      const direction = coverPoint.clone().sub(observer).normalize();
      coverRaycaster.set(observer, direction);
      coverRaycaster.far = observer.distanceTo(coverPoint);
      const blocker = coverRaycaster.intersectObjects(worldShootables, false)[0];
      if (!blocker || blocker.distance > coverRaycaster.far - 0.45) continue;
      const toCover = Math.hypot(x - item.position.x, z - item.position.z);
      const toFocus = Math.hypot(focusX - x, focusZ - z);
      const score = toCover + toFocus * 0.35 + Math.random() * 1.6;
      if (score < bestScore) {
        bestScore = score;
        best = new THREE.Vector3(x, 0, z);
      }
    }
    return best;
  }

  function damage(mesh, amount) {
    const item = mesh.userData.target;
    if (!item?.alive) return false;
    item.health -= amount * (mesh.userData.part === 'legs' ? LEG_DAMAGE_SCALE : 1);
    item.awareTimer = 6;
    if (item.health > 0) return false;
    item.alive = false;
    item.health = 0;
    item.group.rotation.x = -Math.PI * 0.5;
    item.group.position.y = 0.1;
    return true;
  }

  function alertAt(position, radius = 15) {
    for (const item of items) {
      if (!item.alive) continue;
      const distance = Math.hypot(item.position.x - position.x, item.position.z - position.z);
      if (distance <= radius) {
        item.awareTimer = Math.max(item.awareTimer, 2.4);
        item.sightTimer = Math.max(item.sightTimer, SPOT_DELAY - 0.08);
        item.lastKnown.set(position.x, 0, position.z);
      }
    }
  }

  function resetRound() {
    for (const item of items) {
      item.alive = true;
      item.health = HEALTH;
      item.group.rotation.x = 0;
      item.group.position.y = 0;
      const [x, z] = item.route[0];
      item.position.set(x, 0, z);
      item.waypoint = 1 % item.route.length;
      item.awareTimer = 0;
      item.aiming = false;
      item.burstLeft = 0;
      item.shotCooldown = 0.5;
      item.sightTimer = 0;
      item.coverPoint = null;
      item.coverTimer = 0;
      item.holdingCover = false;
      item.decisionTimer = 0;
      item.stuckTimer = 0;
    }
  }

  function step(dt, elapsed, player, playerAlive, onFire) {
    for (const item of items) {
      if (!item.alive) continue;
      const sees = playerAlive && canSee(item, player);
      item.awareTimer = Math.max(0, item.awareTimer - dt);
      item.sightTimer = sees ? item.sightTimer + dt : Math.max(0, item.sightTimer - dt * 2.5);
      if (sees) {
        item.lastKnown.set(player.position.x, 0, player.position.z);
      }
      if (sees && item.sightTimer >= SPOT_DELAY) {
        item.awareTimer = Math.max(item.awareTimer, 1.2);
        const dx = player.position.x - item.position.x;
        const dz = player.position.z - item.position.z;
        const targetYaw = Math.atan2(-dx, -dz);
        let delta = targetYaw - item.yaw;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        item.yaw += delta * Math.min(1, dt * 9);
        item.aiming = true;
        item.decisionTimer -= dt;
        if (!item.coverPoint && (item.health < 65 || item.decisionTimer <= 0) && Math.random() < dt * 1.2) {
          item.coverPoint = findCover(item, player.position);
          item.decisionTimer = 2.5;
          item.holdingCover = false;
        }
        item.shotCooldown -= dt;
        if (item.shotCooldown <= 0) {
          if (item.burstLeft === 0) item.burstLeft = 2 + Math.floor(Math.random() * 2);
          onFire(item);
          item.burstLeft -= 1;
          item.shotCooldown = item.burstLeft ? 0.13 : 0.72 + Math.random() * 0.35;
        }
      } else {
        item.aiming = false;
        if (item.holdingCover && item.coverTimer > 0) {
          item.aiming = item.awareTimer > 0;
        } else if (item.holdingCover) {
          item.holdingCover = false;
        } else {
          const target = item.coverPoint ?? (item.sightTimer > 0 ? item.lastKnown : item.route[item.waypoint]);
          const dx = (target.x ?? target[0]) - item.position.x;
          const dz = (target.z ?? target[1]) - item.position.z;
          const distance = Math.hypot(dx, dz);
          if (distance < 0.45) {
            if (item.coverPoint) {
              item.coverTimer = 1.3;
              item.holdingCover = true;
              item.coverPoint = null;
            } else {
              item.waypoint = (item.waypoint + 1) % item.route.length;
            }
          } else {
            const speed = item.awareTimer > 0 ? SPRINT_SPEED : FORWARD_SPEED;
            const wander = item.stuckTimer > 0 ? Math.sin(item.stuckTimer * 11) * 0.65 : 0;
            const nextX = item.position.x + (dx / distance) * speed * dt - (dz / distance) * wander * speed * dt;
            const nextZ = item.position.z + (dz / distance) * speed * dt + (dx / distance) * wander * speed * dt;
            const previousX = item.position.x;
            const previousZ = item.position.z;
            const moved = Math.hypot(nextX - previousX, nextZ - previousZ);
            if (!overlaps(nextX, item.position.z)) item.position.x = nextX;
            if (!overlaps(item.position.x, nextZ)) item.position.z = nextZ;
            item.yaw = Math.atan2(-dx, -dz);
            const progress = Math.hypot(item.position.x - previousX, item.position.z - previousZ);
            item.stuckTimer = progress < Math.max(0.01, moved * 0.35) ? item.stuckTimer + dt : 0;
            if (item.stuckTimer > 1.0) {
              item.stuckTimer = 0;
              item.waypoint = (item.waypoint + 1) % item.route.length;
              item.coverPoint = null;
              const [resetX, resetZ] = item.route[item.waypoint];
              item.lastKnown.set(resetX, 0, resetZ);
            }
          }
        }
      }
      item.group.rotation.y = item.yaw;
      item.walkPhase += dt * (item.aiming ? 4 : 11);
      item.legs.position.y = 0.33 + Math.abs(Math.sin(item.walkPhase)) * 0.03;
      item.head.position.y = 1.5 + Math.sin(item.walkPhase * 0.5) * 0.012;
      item.coverTimer = Math.max(0, item.coverTimer - dt);
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
