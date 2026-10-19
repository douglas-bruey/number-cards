/**
 * Shared deck data and SVG card renderer.
 * Mirrors number_cards/cards.py and number_cards/geometry.py.
 */

export const DECK = {
  "0": "",
  "1.1": "e",
  "1.2": "a",
  "2.1": "bc",
  "2.2": "ai",
  "3.1": "egh",
  "3.2": "adf",
  "3.3": "abc",
  "4.1": "abce",
  "4.2": "adfi",
  "4.3": "bcgh",
  "5.1": "bcegh",
  "6.1": "abcegh",
  "7.1": "abceghi",
  "8.1": "abcdefgh",
  "8.2": "abcdfghi",
  "9.1": "abcdefghi",
};

export const NUMBER_COLORS = {
  1: "#000000",
  2: "#1071e5",
  3: "#00c2a8",
  4: "#82755b",
  5: "#ffe342",
  6: "#cc4e00",
  7: "#d916a8",
  8: "#e81313",
  9: "#635dff",
};

export const CIRCLE_LETTERS = "abcdefghi";

const CARD = {
  size: 120,
  cornerRadius: 10,
  circleRadius: 10,
  gridSpacing: 30,
  // Keep the outline fully inside the viewBox so strokes are not clipped
  // (clipping reads as uneven / missing borders when the SVG is scaled).
  strokeWidth: 2.5,
};

/**
 * Centres of the 3×3 circle grid, rotated 45° into a diamond.
 * Lettered top→bottom, then left→right:
 *       a
 *     b   c
 *   d   e   f
 *     g   h
 *       i
 */
export function circleCenters() {
  const cx = CARD.size / 2;
  const cy = CARD.size / 2;
  const step = CARD.gridSpacing / Math.SQRT2;
  const centers = [];

  for (const row of [-1, 0, 1]) {
    for (const col of [-1, 0, 1]) {
      centers.push({
        x: cx + (col - row) * step,
        y: cy + (col + row) * step, // SVG y grows downward; flip from PDF
      });
    }
  }

  centers.sort((a, b) => {
    const dy = Math.round(a.y * 1e6) - Math.round(b.y * 1e6);
    return dy !== 0 ? dy : a.x - b.x;
  });

  return Object.fromEntries(
    CIRCLE_LETTERS.split("").map((letter, i) => [letter, centers[i]]),
  );
}

const CENTERS = circleCenters();

/** Number of filled dots on a named card (e.g. "4.2" → 4). */
export function cardValue(name) {
  return Number.parseInt(name.split(".")[0], 10);
}

/**
 * Filled dots for a named card, each keeping that card's number colour.
 * @param {string} name
 * @returns {Record<string, string>} letter → colour
 */
export function cardDots(name) {
  const filled = DECK[name];
  if (filled === undefined) {
    throw new Error(`Unknown card: ${name}`);
  }
  const value = cardValue(name);
  const color = value > 0 ? NUMBER_COLORS[value] : null;
  /** @type {Record<string, string>} */
  const dots = {};
  for (const letter of filled) {
    dots[letter] = color;
  }
  return dots;
}

/**
 * Build an SVG from a letter→colour map (empty map = blank card face).
 * @param {Record<string, string>} dots
 * @param {{ className?: string, label?: string }} [options]
 */
export function renderDots(dots, options = {}) {
  const count = Object.keys(dots).length;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${CARD.size} ${CARD.size}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", options.label ?? `Card with ${count} dots`);
  if (options.className) {
    svg.setAttribute("class", options.className);
  }

  const inset = CARD.strokeWidth / 2;
  const face = document.createElementNS(ns, "rect");
  face.setAttribute("x", String(inset));
  face.setAttribute("y", String(inset));
  face.setAttribute("width", String(CARD.size - CARD.strokeWidth));
  face.setAttribute("height", String(CARD.size - CARD.strokeWidth));
  face.setAttribute("rx", String(CARD.cornerRadius));
  face.setAttribute("ry", String(CARD.cornerRadius));
  face.setAttribute("class", "card-face");
  face.setAttribute("stroke-width", String(CARD.strokeWidth));
  svg.appendChild(face);

  for (const letter of CIRCLE_LETTERS) {
    const { x, y } = CENTERS[letter];
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", String(CARD.circleRadius));

    if (Object.prototype.hasOwnProperty.call(dots, letter)) {
      circle.setAttribute("class", "card-dot card-dot--filled");
      circle.setAttribute("fill", dots[letter]);
    } else {
      circle.setAttribute("class", "card-dot card-dot--hole");
    }
    svg.appendChild(circle);
  }

  return svg;
}

/**
 * Build an SVG element for a named deck card.
 * @param {string} name Deck key
 * @param {{ className?: string }} [options]
 */
export function renderCard(name, options = {}) {
  const value = cardValue(name);
  return renderDots(cardDots(name), {
    className: options.className,
    label: `Card showing ${value}`,
  });
}

export function deckNames() {
  return Object.keys(DECK);
}

/** True when two letter→colour maps cover the same positions. */
export function samePattern(a, b) {
  const keysA = Object.keys(a).sort().join("");
  const keysB = Object.keys(b).sort().join("");
  return keysA === keysB;
}

/** Merge dots if no shared letters; otherwise return null. */
export function tryMergeDots(base, addition) {
  for (const letter of Object.keys(addition)) {
    if (Object.prototype.hasOwnProperty.call(base, letter)) {
      return null;
    }
  }
  return { ...base, ...addition };
}

/**
 * Clockwise 90° letter map for the diamond grid (e stays put):
 * a→f→i→d→a, b→c→h→g→b.
 */
export const ROTATE_CW = {
  a: "f",
  b: "c",
  c: "h",
  d: "a",
  e: "e",
  f: "i",
  g: "b",
  h: "g",
  i: "d",
};

/** Rotate a letter→colour map clockwise by `turns` quarter-turns (0–3). */
export function rotateDots(dots, turns) {
  const n = ((turns % 4) + 4) % 4;
  let current = { ...dots };
  for (let i = 0; i < n; i += 1) {
    /** @type {Record<string, string>} */
    const next = {};
    for (const [letter, color] of Object.entries(current)) {
      next[ROTATE_CW[letter]] = color;
    }
    current = next;
  }
  return current;
}

/** Palette cards: every deck card valued 1–8. */
export function paletteNames() {
  return deckNames().filter((name) => {
    const value = cardValue(name);
    return value >= 1 && value <= 8;
  });
}
