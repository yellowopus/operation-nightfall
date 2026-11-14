// Nightfall's visual language: deep navy architecture with amber tactical accents.
// The same six names are the CSS custom properties in index.html.
export const PALETTE = {
  canvas: '#0b1220',
  surface: '#122031',
  hairline: '#263854',
  ink: '#dce8f8',
  muted: '#667c99',
  accent: '#f2a838',
};

export function shade(name) {
  return PALETTE[name];
}
