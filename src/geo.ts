/* Egocentric direction helpers. Bearings are relative to the user:
   0° = ahead, 90° = right, 180° = behind, 270° = left. */

const DIRS: { label: string; arrow: string }[] = [
  { label: 'ahead', arrow: '↑' },
  { label: 'ahead-right', arrow: '↗' },
  { label: 'right', arrow: '→' },
  { label: 'behind-right', arrow: '↘' },
  { label: 'behind', arrow: '↓' },
  { label: 'behind-left', arrow: '↙' },
  { label: 'left', arrow: '←' },
  { label: 'ahead-left', arrow: '↖' },
];

export const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

const idx = (deg: number) => Math.round(norm360(deg) / 45) % 8;
export const dirLabel = (deg: number) => DIRS[idx(deg)].label;
export const dirArrow = (deg: number) => DIRS[idx(deg)].arrow;

/** True for the rear hemisphere — sounds the user cannot see. */
export const isBehind = (deg: number) => {
  const a = norm360(deg);
  return a > 110 && a < 250;
};

/** Normalise an angle into the (-180, 180] range. */
export const signedAngle = (deg: number) => {
  let a = norm360(deg);
  if (a > 180) a -= 360;
  return a;
};

/** A point on a ring, 0° at top, increasing clockwise. */
export const ringPoint = (
  cx: number,
  cy: number,
  r: number,
  deg: number
): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
};
