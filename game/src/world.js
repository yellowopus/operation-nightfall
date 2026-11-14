// The map: a closed grey room with cover, built from boxes. Every box is a collider for the
// player and a surface a bullet stops on. Plain geometry only, no models and no textures.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: 0.03,
    });
  }

  const colliders = [];
  const shootables = [];

  function box(width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  function siteLabel(text, x, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 192;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(7, 13, 22, 0.82)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = PALETTE.accent;
    context.lineWidth = 10;
    context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    context.fillStyle = PALETTE.accent;
    context.font = 'bold 118px Inter, system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 8);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(3.1, 3.1),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.84 }),
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(x, 0.52, z);
    group.add(label);
  }

  // A 34 x 30 m tactical block: left, centre and right lanes feed a pair of bomb sites.
  box(34.4, 0.4, 30.4, 0, -0.2, 0, 'canvas');
  box(0.4, 5.0, 30.4, -17.2, 2.5, 0, 'surface');
  box(0.4, 5.0, 30.4, 17.2, 2.5, 0, 'surface');
  box(34.4, 5.0, 0.4, 0, 2.5, -15.2, 'surface');
  box(34.4, 5.0, 0.4, 0, 2.5, 15.2, 'surface');

  // Main connectors and corner pockets.
  box(8.0, 4.0, 1.0, -10.0, 2.0, -7.0, 'surface');
  box(8.0, 4.0, 1.0, 10.0, 2.0, 6.0, 'surface');
  box(1.0, 4.0, 6.0, -6.0, 2.0, 8.0, 'surface');
  box(1.0, 4.0, 6.0, 6.0, 2.0, -8.0, 'surface');

  // Site A, northwest: platform, crates and sight-line breaks.
  box(8.0, 0.5, 7.0, -11.0, 0.25, -10.0, 'surface');
  box(1.8, 1.5, 1.8, -14.0, 1.25, -12.0, 'hairline');
  box(1.8, 1.2, 1.8, -11.0, 1.1, -12.0, 'hairline');
  box(1.8, 1.8, 1.8, -8.0, 1.4, -12.0, 'hairline');
  box(2.6, 0.8, 2.6, -11.0, 0.9, -8.0, 'hairline');
  box(1.0, 2.6, 4.0, -6.0, 1.3, -11.0, 'hairline');

  // Site B, southeast: long approach, stacked crates and a knife-corner.
  box(8.0, 0.5, 7.0, 11.0, 0.25, 10.0, 'surface');
  box(1.8, 1.5, 1.8, 14.0, 1.25, 12.0, 'hairline');
  box(1.8, 1.2, 1.8, 11.0, 1.1, 12.0, 'hairline');
  box(1.8, 1.8, 1.8, 8.0, 1.4, 12.0, 'hairline');
  box(2.6, 0.8, 2.6, 11.0, 0.9, 8.0, 'hairline');
  box(1.0, 2.6, 4.0, 6.0, 1.3, 11.0, 'hairline');

  // Mid obstacles, spawn cover and small crates that reward crouched peeks.
  box(2.2, 3.6, 2.2, 0, 1.8, 0, 'hairline');
  box(4.0, 1.0, 1.2, -4.0, 0.5, 2.0, 'hairline');
  box(1.2, 1.0, 4.0, 4.0, 0.5, -2.0, 'hairline');
  box(1.6, 0.7, 1.6, -14.0, 0.35, 0.0, 'hairline');
  box(1.6, 0.7, 1.6, 14.0, 0.35, -1.0, 'hairline');
  box(2.4, 0.9, 1.2, -3.0, 0.45, 12.5, 'hairline');
  box(2.4, 0.9, 1.2, 3.0, 0.45, 12.5, 'hairline');
  box(2.4, 0.9, 1.2, -3.0, 0.45, -12.5, 'hairline');
  box(2.4, 0.9, 1.2, 3.0, 0.45, -12.5, 'hairline');

  // Nightfall additions: chokepoints, stacked cover and site approach walls.
  box(0.9, 2.3, 5.5, -3.5, 1.15, -4.0, 'surface');
  box(0.9, 2.3, 5.5, 3.5, 1.15, 4.0, 'surface');
  box(4.5, 1.5, 0.9, -12.5, 0.75, 4.5, 'hairline');
  box(4.5, 1.5, 0.9, 12.5, 0.75, -4.5, 'hairline');
  box(1.2, 1.1, 1.2, -8.5, 0.55, 1.5, 'hairline');
  box(1.2, 1.1, 1.2, 8.5, 0.55, -1.5, 'hairline');
  box(1.4, 2.0, 1.4, -1.5, 1.0, 7.0, 'hairline');
  box(1.4, 2.0, 1.4, 1.5, 1.0, -7.0, 'hairline');
  box(2.8, 0.7, 0.7, -11.0, 0.35, 8.0, 'hairline');
  box(2.8, 0.7, 0.7, 11.0, 0.35, -8.0, 'hairline');

  // Site landmarks: raised cover protects rotates while keeping bombsite labels readable.
  box(1.8, 2.1, 0.7, -16.0, 1.05, -9.0, 'hairline');
  box(1.8, 2.1, 0.7, 16.0, 1.05, 9.0, 'hairline');
  box(0.7, 1.7, 2.8, -6.5, 0.85, -5.0, 'hairline');
  box(0.7, 1.7, 2.8, 6.5, 0.85, 5.0, 'hairline');
  box(2.2, 1.1, 2.2, -16.0, 0.55, -4.0, 'hairline');
  box(2.2, 1.1, 2.2, 16.0, 0.55, 4.0, 'hairline');

  // Low site-entry barriers and scatter crates create peek opportunities.
  box(2.6, 1.3, 1.0, -4.0, 0.65, -11.0, 'hairline');
  box(2.6, 1.3, 1.0, 4.0, 0.65, 11.0, 'hairline');
  box(1.0, 1.3, 2.6, -6.0, 0.65, -13.5, 'hairline');
  box(1.0, 1.3, 2.6, 6.0, 0.65, 13.5, 'hairline');
  box(1.6, 1.0, 1.6, -15.0, 0.5, 1.5, 'hairline');
  box(1.6, 1.0, 1.6, 15.0, 0.5, -1.5, 'hairline');
  box(2.1, 1.2, 1.2, -14.0, 0.6, -1.0, 'hairline');
  box(2.1, 1.2, 1.2, 14.0, 0.6, 1.0, 'hairline');
  box(1.2, 1.2, 2.1, -7.5, 0.6, 13.0, 'hairline');
  box(1.2, 1.2, 2.1, 7.5, 0.6, -13.0, 'hairline');

  // Amber site markers and two cool ceiling strips for navigation.
  for (const [x, z] of [[-11, -10], [11, 10]]) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.02, 5.5),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.08, roughness: 1 }),
    );
    marker.position.set(x, 0.01, z);
    group.add(marker);

  }
  siteLabel('A', -11, -10);
  siteLabel('B', 11, 10);

  scene.fog = new THREE.FogExp2(new THREE.Color('#070d16'), 0.032);

  const sky = new THREE.HemisphereLight(new THREE.Color('#15263f'), new THREE.Color(PALETTE.canvas), 0.42);
  scene.add(sky);

  const key = new THREE.DirectionalLight(new THREE.Color(PALETTE.accent), 1.05);
  key.position.set(12, 16, 9);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;
  key.shadow.camera.far = 55;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.ink), 0.38);
  fill.position.set(-10, 12, -8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(new THREE.Color('#8fb7e5'), 0.22);
  rim.position.set(-14, 9, 10);
  scene.add(rim);

  for (const [x, z, intensity] of [[-11, -10, 20], [11, 10, 20], [0, 0, 10]]) {
    const lamp = new THREE.PointLight(new THREE.Color(PALETTE.accent), intensity, 13, 1.8);
    lamp.position.set(x, 3.2, z);
    group.add(lamp);
  }

  return { colliders, shootables, group };
}
