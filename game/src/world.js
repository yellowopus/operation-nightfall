import * as THREE from 'three';
import { PALETTE } from './palette.js';

const MAP_WIDTH = 37;
const MAP_DEPTH = 35;
const WALL_HEIGHT = 5;

export function createWorld(scene) {
  const group = new THREE.Group();
  group.name = 'Kestrel District';
  scene.add(group);

  const solids = new THREE.Group();
  solids.name = 'Merged Solids';
  const lamps = new THREE.Group();
  lamps.name = 'Lamp Lights';
  group.add(solids, lamps);

  const materials = Object.fromEntries(Object.entries(PALETTE).map(([name, color]) => [
    name,
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: name === 'accent' || name === 'ink' ? 0.45 : 0.8,
      metalness: name === 'hairline' ? 0.08 : 0.02,
    }),
  ]));
  materials.site = new THREE.MeshBasicMaterial({
    color: new THREE.Color(PALETTE.accent),
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });

  const batches = new Map();
  const colliders = [];
  const shootables = [];

  function batchFor(material) {
    if (!batches.has(material)) batches.set(material, []);
    return batches.get(material);
  }

  function place(geometry, material, x, y, z, collision = true) {
    geometry.translate(x, y, z);
    batchFor(material).push(geometry);
    if (collision) {
      geometry.computeBoundingBox();
      colliders.push(geometry.boundingBox.clone());
    }
  }

  function block(width, height, depth, x, y, z, material, collision = true) {
    place(new THREE.BoxGeometry(width, height, depth), material, x, y, z, collision);
  }

  function column(radius, height, x, base, z, material, collision = true) {
    place(new THREE.CylinderGeometry(radius, radius, height, 12), material, x, base + height / 2, z, collision);
  }

  function mergeGeometries(geometries) {
    const flattened = geometries.map((geometry) => (geometry.index ? geometry.toNonIndexed() : geometry.clone()));
    const count = flattened.reduce((total, geometry) => total + geometry.attributes.position.count, 0);
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    merged.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));

    let vertexOffset = 0;
    for (const geometry of flattened) {
      merged.attributes.position.array.set(geometry.attributes.position.array, vertexOffset * 3);
      merged.attributes.normal.array.set(geometry.attributes.normal.array, vertexOffset * 3);
      merged.attributes.uv.array.set(geometry.attributes.uv.array, vertexOffset * 2);
      vertexOffset += geometry.attributes.position.count;
      geometry.dispose();
    }

    for (const geometry of geometries) geometry.dispose();
    merged.computeBoundingSphere();
    return merged;
  }

  block(MAP_WIDTH, 0.4, MAP_DEPTH, 0, -0.2, 0, 'canvas');
  block(0.6, WALL_HEIGHT, MAP_DEPTH, -MAP_WIDTH / 2 - 0.1, WALL_HEIGHT / 2 - 0.2, 0, 'surface');
  block(0.6, WALL_HEIGHT, MAP_DEPTH, MAP_WIDTH / 2 + 0.1, WALL_HEIGHT / 2 - 0.2, 0, 'surface');
  block(MAP_WIDTH, WALL_HEIGHT, 0.6, 0, WALL_HEIGHT / 2 - 0.2, -MAP_DEPTH / 2 - 0.1, 'surface');
  block(MAP_WIDTH, WALL_HEIGHT, 0.6, 0, WALL_HEIGHT / 2 - 0.2, MAP_DEPTH / 2 + 0.1, 'surface');

  for (let x = -15; x <= 15; x += 6) {
    for (const z of [-MAP_DEPTH / 2 + 0.5, MAP_DEPTH / 2 - 0.5]) {
      block(0.8, 3.4, 1.8, x, 1.5, z, 'muted');
    }
  }

  for (const side of [-1, 1]) {
    block(0.8, 2.8, 7, 3.2 * side, 1.4, -7.5, 'muted');
    block(0.8, 2.8, 7, 3.2 * side, 1.4, 7.5, 'muted');
    block(7, 2.2, 0.8, 9 * side, 1.1, -3.5, 'surface');
    block(7, 2.2, 0.8, 9 * side, 1.1, 3.5, 'surface');
  }

  block(6, 0.02, 6, -11, 0.012, -10, 'site', false);
  block(6, 0.02, 6, 11, 0.012, 10, 'site', false);
  block(1.1, 0.016, 27, -8.5, 0.008, 0, 'muted', false);
  block(1.1, 0.016, 27, 8.5, 0.008, 0, 'muted', false);
  block(23, 0.016, 1.1, 0, 0.008, -6, 'hairline', false);
  block(23, 0.016, 1.1, 0, 0.008, 6, 'hairline', false);

  block(4, 0.8, 4, -15.2, 0.4, -5, 'surface');
  for (let index = 0; index < 4; index += 1) {
    const height = 0.18 + index * 0.18;
    block(1.1, height, 1.2, -16.6, height / 2, -3 + index * -0.9, 'surface');
  }
  block(4, 0.8, 4, 15.2, 0.4, 2, 'surface');
  for (let index = 0; index < 4; index += 1) {
    const height = 0.18 + index * 0.18;
    block(1.1, height, 1.2, 16.6, height / 2, 0 + index * 0.9, 'surface');
  }

  block(1.7, 1.2, 1.7, -10.5, 0.6, -10, 'hairline');
  block(1.5, 1.0, 1.5, -12.4, 0.5, -11.5, 'hairline');
  block(1.3, 1.7, 1.3, -10.5, 1.7, -10, 'hairline');
  block(2.4, 0.9, 1.2, -8, 0.45, -7.5, 'hairline');
  block(1.2, 1.8, 1.2, -6.8, 0.9, -12.5, 'hairline');
  block(1.1, 2.2, 1.1, -10.5, 1.1, -6, 'hairline');

  block(1.7, 1.2, 1.7, 10.5, 0.6, 10, 'hairline');
  block(1.5, 1.0, 1.5, 12.4, 0.5, 11.5, 'hairline');
  block(1.3, 1.7, 1.3, 10.5, 1.7, 10, 'hairline');
  block(1.2, 0.9, 2.4, 8, 0.45, 7.5, 'hairline');
  block(1.2, 1.8, 1.2, 6.8, 0.9, 12.5, 'hairline');
  block(1.1, 2.2, 1.1, 13.5, 1.1, 6, 'hairline');

  block(1.6, 1.0, 1.6, -14.5, 0.5, 1.5, 'hairline');
  block(2.2, 1.1, 1.1, -12, 0.55, 4.5, 'hairline');
  block(1.2, 1.4, 1.2, -5.8, 0.7, 9.5, 'hairline');
  block(2.5, 0.9, 1.1, -8, 0.45, 13, 'hairline');
  block(1.1, 1.5, 1.1, -2.5, 0.75, -12.5, 'hairline');
  block(1.6, 1.0, 1.6, 14.5, 0.5, -1.5, 'hairline');
  block(1.1, 2.2, 1.1, 12, 0.55, -4.5, 'hairline');
  block(1.2, 1.4, 1.2, 5.8, 0.7, -9.5, 'hairline');
  block(1.1, 0.9, 2.5, 8, 0.45, -13, 'hairline');
  block(1.1, 1.5, 1.1, 2.5, 0.75, 12.5, 'hairline');

  block(1.6, 2.3, 1.6, 0, 1.15, -2, 'surface');
  block(1.2, 1.2, 2.6, -4.8, 0.6, 0, 'hairline');
  block(2.6, 1.2, 1.2, 4.8, 0.6, 0, 'hairline');
  block(1.4, 1.5, 1.4, 0, 0.75, 8.5, 'hairline');
  block(1.4, 1.5, 1.4, 0, 0.75, -8.5, 'hairline');

  for (const [x, z] of [[-11, -10], [11, 10], [0, 0], [-15.2, -5], [15.2, 2]]) {
    column(0.13, 4.3, x, 0, z, 'muted');
    column(0.48, 0.24, x, 4.42, z, 'ink', false);
    column(0.16, 0.1, x, 4.32, z, 'accent', false);
    const lamp = new THREE.PointLight(new THREE.Color(PALETTE.accent), x === 0 && z === 0 ? 18 : 32, 14, 1.75);
    lamp.position.set(x, 4.5, z);
    lamps.add(lamp);
  }

  for (const [material, geometries] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), materials[material]);
    mesh.castShadow = material !== 'site';
    mesh.receiveShadow = true;
    const materialGroup = new THREE.Group();
    materialGroup.name = `${material}-geometry`;
    materialGroup.add(mesh);
    solids.add(materialGroup);
    shootables.push(mesh);
  }

  scene.fog = new THREE.FogExp2(new THREE.Color(PALETTE.canvas), 0.021);
  scene.add(new THREE.HemisphereLight(new THREE.Color(PALETTE.hairline), new THREE.Color(PALETTE.canvas), 1.05));

  const key = new THREE.DirectionalLight(new THREE.Color(PALETTE.accent), 1.45);
  key.position.set(14, 19, 11);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -22;
  key.shadow.camera.right = 22;
  key.shadow.camera.top = 22;
  key.shadow.camera.bottom = -22;
  key.shadow.camera.far = 65;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.ink), 0.62);
  fill.position.set(-12, 14, -9);
  const rim = new THREE.DirectionalLight(new THREE.Color(PALETTE.muted), 0.5);
  rim.position.set(-15, 10, 11);
  scene.add(fill, rim);

  return { colliders, shootables, group };
}
