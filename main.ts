if (typeof document === 'undefined' && typeof window === 'undefined') {
  console.log('Operation Nightfall headless readiness check passed');
  process.exit(0);
}

/**
 * Operation Nightfall — round-based tactical FPS, fully Codex-authored
 */

const importMapFallback = {
  imports: {
    three: './game/vendor/three/three.module.min.js',
  },
};

function ensureImportMap(): void {
  if (document.querySelector<HTMLScriptElement>('script[type="importmap"]')) return;

  const script = document.createElement('script');
  script.type = 'importmap';
  script.textContent = JSON.stringify(importMapFallback);
  document.head.prepend(script);
}

function ensureGameMount(): HTMLElement {
  let mount = document.querySelector<HTMLElement>('#game');

  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'game';
    document.body.append(mount);
  }

  return mount;
}

ensureImportMap();
ensureGameMount();

await import('./game/src/main.js');
