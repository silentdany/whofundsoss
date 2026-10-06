/** Flat mark: an open ring (the project) resting on a fund. Sage tile, paper shapes. */
export const MARK_SAGE = "#3d7a6a";
export const MARK_PAPER = "#faf9f7";

export function markShapes(): string {
  return `<rect width="512" height="512" rx="112" fill="${MARK_SAGE}"/>
  <circle cx="256" cy="206" r="92" fill="none" stroke="${MARK_PAPER}" stroke-width="40"/>
  <rect x="124" y="332" width="264" height="58" rx="29" fill="${MARK_PAPER}"/>`;
}

/** Favicon and header tile. One drawing, no gradient, photo, or 3D. */
export function markSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="WhoFundsOSS">
  ${markShapes()}
</svg>
`;
}
