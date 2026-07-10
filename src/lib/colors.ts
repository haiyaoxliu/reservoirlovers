/**
 * Accessible categorical palette for per-member colours. Chosen to stay
 * distinguishable on the dark background and from each other. Assigned by
 * stable order so a member keeps the same colour across renders.
 */
const PALETTE = [
  "#4aa8ff", // blue
  "#f5c451", // gold
  "#5fd08a", // green
  "#ff7a9c", // pink
  "#b98cff", // purple
  "#ff9f4a", // orange
  "#4fd6d0", // teal
  "#e06c6c", // red
  "#9ccf5a", // lime
  "#c9a06a", // tan
];

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}
