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
 * Build an SVG element for a card.
 * @param {string} name Deck key
 * @param {{ className?: string }} [options]
 */
export function renderCard(name, options = {}) {
  const filled = DECK[name];
  if (filled === undefined) {
    throw new Error(`Unknown card: ${name}`);
  }

  const value = cardValue(name);
  const fillColor = value > 0 ? NUMBER_COLORS[value] : null;
  const filledSet = new Set(filled);

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${CARD.size} ${CARD.size}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Card showing ${value}`);
  if (options.className) {
    svg.setAttribute("class", options.className);
  }

  const face = document.createElementNS(ns, "rect");
  face.setAttribute("x", "0");
  face.setAttribute("y", "0");
  face.setAttribute("width", String(CARD.size));
  face.setAttribute("height", String(CARD.size));
  face.setAttribute("rx", String(CARD.cornerRadius));
  face.setAttribute("ry", String(CARD.cornerRadius));
  face.setAttribute("class", "card-face");
  svg.appendChild(face);

  for (const letter of CIRCLE_LETTERS) {
    const { x, y } = CENTERS[letter];
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", String(CARD.circleRadius));

    if (filledSet.has(letter)) {
      circle.setAttribute("class", "card-dot card-dot--filled");
      circle.setAttribute("fill", fillColor);
    } else {
      circle.setAttribute("class", "card-dot card-dot--hole");
    }
    svg.appendChild(circle);
  }

  return svg;
}

export function deckNames() {
  return Object.keys(DECK);
}
