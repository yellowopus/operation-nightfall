// Fragmentation grenades with lightweight sphere/box physics. Fixed-step collision uses
// the closest point on each map box, followed by reflection and a short fuse.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const RADIUS = 0.08;
const FUSE = 1.75;
const BOUND = 16.7;

export function createGrenades(scene, colliders) {
  const geometry = new THREE.SphereGeometry(RADIUS, 10, 8);
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.45, metalness: 0.5 });
  const flashMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true });
  const grenades = [];
  const closest = new THREE.Vector3();
  const normal = new THREE.Vector3();

  function throwFrom(origin, direction, charge = 0.75) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.copy(origin);
    scene.add(mesh);
    const velocity = direction.clone().normalize().multiplyScalar(11 + charge * 8);
    velocity.y += 2.2 + charge * 1.6;
    grenades.push({ mesh, velocity, fuse: FUSE, restTimer: 0 });
  }

  function step(dt, onExplode) {
    for (let index = grenades.length - 1; index >= 0; index -= 1) {
      const item = grenades[index];
      item.fuse -= dt;
      const steps = Math.min(5, Math.max(1, Math.ceil(dt / 0.008)));
      const stepTime = dt / steps;
      for (let stepIndex = 0; stepIndex < steps; stepIndex += 1) {
        item.velocity.y -= 18.5 * stepTime;
        item.velocity.multiplyScalar(1 - 0.08 * stepTime);
        item.mesh.position.addScaledVector(item.velocity, stepTime);

        const position = item.mesh.position;
        if (position.y < RADIUS) {
          position.y = RADIUS;
          item.velocity.y = Math.abs(item.velocity.y) * 0.38;
          item.velocity.x *= 0.76;
          item.velocity.z *= 0.76;
        }
        if (Math.abs(position.x) > BOUND) {
          position.x = Math.sign(position.x) * BOUND;
          item.velocity.x *= -0.42;
        }
        if (Math.abs(position.z) > BOUND) {
          position.z = Math.sign(position.z) * BOUND;
          item.velocity.z *= -0.42;
        }

        for (const collider of colliders) {
          closest.set(
            Math.max(collider.min.x, Math.min(position.x, collider.max.x)),
            Math.max(collider.min.y, Math.min(position.y, collider.max.y)),
            Math.max(collider.min.z, Math.min(position.z, collider.max.z)),
          );
          normal.subVectors(position, closest);
          const distance = normal.length();
          if (distance < RADIUS && distance > 1e-5) {
            normal.divideScalar(distance);
            const push = RADIUS - distance + 0.002;
            position.addScaledVector(normal, push);
            const into = item.velocity.dot(normal);
            if (into < 0) item.velocity.addScaledVector(normal, -into * 1.42);
          }
        }
      }

      item.mesh.rotation.x += item.velocity.length() * dt * 1.5;
      if (item.fuse <= 0) {
        const flash = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), flashMaterial.clone());
        flash.position.copy(position);
        scene.add(flash);
        const light = new THREE.PointLight(new THREE.Color(PALETTE.accent), 80, 16, 1.8);
        light.position.copy(position);
        scene.add(light);
        const born = performance.now();
        requestAnimationFrame(function fade() {
          const age = (performance.now() - born) / 240;
          flash.material.opacity = Math.max(0, 0.9 - age);
          light.intensity = Math.max(0, 80 * (1 - age));
          if (age < 1) requestAnimationFrame(fade);
          else scene.remove(flash, light);
        });
        onExplode(position);
        scene.remove(item.mesh);
        grenades.splice(index, 1);
      }
    }
  }

  return {
    throwFrom,
    step,
    count: () => grenades.length,
    clear() {
      for (const item of grenades) scene.remove(item.mesh);
      grenades.length = 0;
    },
  };
}
