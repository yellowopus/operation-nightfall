// Nightfall's visual language: readable blue-grey architecture with amber tactical accents.
// The same six names are the CSS custom properties in index.html.
export const PALETTE = {
  canvas: '#3c4c62',
  surface: '#52647d',
  hairline: '#7c8fab',
  ink: '#dce8f8',
  muted: '#667c99',
  accent: '#f2a838',
};

export function shade(name) {
  return PALETTE[name];
}
