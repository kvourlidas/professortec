export function clampRating(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(5, v));
}
