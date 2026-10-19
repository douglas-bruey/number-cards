/**
 * Two-card addend partitions that can assemble a target pattern.
 */

import {
  cardDots,
  cardValue,
  paletteNames,
  rotateDots,
  samePattern,
  tryMergeDots,
} from "./cards.js";

/**
 * @param {string} a
 * @param {string} b
 * @param {string} target
 */
export function pairFormsTarget(a, b, target) {
  const goal = cardDots(target);
  for (let ta = 0; ta < 4; ta += 1) {
    for (let tb = 0; tb < 4; tb += 1) {
      const merged = tryMergeDots(
        rotateDots(cardDots(a), ta),
        rotateDots(cardDots(b), tb),
      );
      if (merged && samePattern(merged, goal)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Unordered value pairs {lo,hi} with lo <= hi that can form `target`
 * using two palette cards (the same card name may be used twice).
 * @param {string} target
 * @returns {Array<[number, number]>}
 */
export function valuePartitions(target) {
  const targetValue = cardValue(target);
  const palette = paletteNames();
  /** @type {Map<string, [number, number]>} */
  const found = new Map();

  for (let i = 0; i < palette.length; i += 1) {
    for (let j = i; j < palette.length; j += 1) {
      const a = palette[i];
      const b = palette[j];
      const va = cardValue(a);
      const vb = cardValue(b);
      if (va + vb !== targetValue) {
        continue;
      }
      if (!pairFormsTarget(a, b, target)) {
        continue;
      }
      const lo = Math.min(va, vb);
      const hi = Math.max(va, vb);
      found.set(`${lo}+${hi}`, [lo, hi]);
    }
  }

  return [...found.values()].sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

/** Sorted "lo+hi" key for a pair of values. */
export function pairKey(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${lo}+${hi}`;
}

/**
 * Build rows for one or more target cards. Each realizable value pair is
 * attached to the specific target pattern it can form.
 * @param {string[]} targets
 * @returns {Array<{ values: [number, number], target: string }>}
 */
export function partitionRows(targets) {
  /** @type {Map<string, { values: [number, number], target: string }>} */
  const found = new Map();
  for (const target of targets) {
    for (const values of valuePartitions(target)) {
      const key = pairKey(values[0], values[1]);
      // Prefer the first target that claims a pair; callers should order
      // targets so the intended pattern wins (e.g. 8.1 before 8.2, except
      // 4+4 which only exists on 8.2).
      if (!found.has(key)) {
        found.set(key, { values, target });
      }
    }
  }
  return [...found.values()].sort(
    (left, right) =>
      left.values[0] - right.values[0] || left.values[1] - right.values[1],
  );
}
