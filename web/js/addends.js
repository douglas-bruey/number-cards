import {
  cardDots,
  cardValue,
  paletteNames,
  renderCard,
  renderDots,
  rotateDots,
  samePattern,
  tryMergeDots,
} from "./cards.js";
import { pairKey, valuePartitions } from "./partitions.js";

/** Challenge deck: targets with two-card addend partitions. */
const TARGET_DECK = [
  "2.2",
  "3.2",
  "4.2",
  "5.1",
  "6.1",
  "7.1",
  "8.1",
  "8.2",
  "9.1",
];

const els = {
  startScreen: document.getElementById("start-screen"),
  playScreen: document.getElementById("play-screen"),
  winScreen: document.getElementById("win-screen"),
  startBtn: document.getElementById("start-btn"),
  againBtn: document.getElementById("again-btn"),
  palette: document.getElementById("palette"),
  rows: document.getElementById("addends-rows"),
  board: document.getElementById("addends-board"),
  spaceHint: document.getElementById("space-hint"),
  pendingGrid: document.getElementById("pending-grid"),
  completedGrid: document.getElementById("completed-grid"),
  dragCoach: document.getElementById("drag-coach"),
  dragCoachPath: document.getElementById("drag-coach-path"),
  dragCoachHead: document.getElementById("drag-coach-head"),
  assemblePalette: document.querySelector(".assemble-palette"),
};

/** @type {string[]} */
let pendingTargets = [];
/** @type {string[]} */
let completedTargets = [];
/** @type {string | null} */
let currentTarget = null;
/** @type {Array<[number, number]>} */
let partitions = [];

/**
 * @typedef {{
 *   index: number,
 *   stacked: string[],
 *   turns: number[],
 *   verifying: boolean,
 *   solved: boolean,
 *   claimedPair: string | null,
 *   root: HTMLElement,
 *   buildSlot: HTMLElement,
 *   buildMount: HTMLElement,
 *   clearBtn: HTMLElement,
 *   equationBuild: HTMLElement,
 *   equationTarget: HTMLElement,
 *   equationTargetInput: HTMLInputElement,
 * }} Row
 */

/** @type {Row[]} */
let rows = [];

/** @type {{ name: string, turns: number, originEl: HTMLElement, ghost: HTMLElement, offsetX: number, offsetY: number, pointerId: number } | null} */
let drag = null;
/** @type {number | null} */
let dragCoachTimer = null;
/** @type {number | null} */
let hotRowIndex = null;

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function showScreen(name) {
  els.startScreen.hidden = name !== "start";
  els.playScreen.hidden = name !== "play";
  els.winScreen.hidden = name !== "win";
  if (name !== "play") {
    hideDragCoach();
  }
}

function claimedPairs() {
  return new Set(
    rows
      .filter((row) => row.claimedPair)
      .map((row) => row.claimedPair),
  );
}

function rowDots(row) {
  /** @type {Record<string, string>} */
  let dots = {};
  for (let i = 0; i < row.stacked.length; i += 1) {
    const addition = rotateDots(cardDots(row.stacked[i]), row.turns[i]);
    const merged = tryMergeDots(dots, addition);
    if (!merged) {
      throw new Error("Row has overlapping dots");
    }
    dots = merged;
  }
  return dots;
}

function renderRowBuild(row) {
  const dots = row.stacked.length ? rowDots(row) : {};
  row.buildMount.replaceChildren(
    renderDots(dots, {
      className: "play-card",
      label:
        row.stacked.length === 0
          ? "Empty build area"
          : `Build with ${Object.keys(dots).length} dots`,
    }),
  );
  const empty = row.stacked.length === 0;
  row.buildSlot.classList.toggle("is-empty", empty);
  row.clearBtn.hidden = empty || row.verifying || row.solved;
  row.root.classList.toggle("is-solved", row.solved);
  row.root.classList.toggle("is-verifying", row.verifying);
}

function makeDigitInput(ariaLabel, onChange) {
  const input = document.createElement("input");
  input.className = "equation-digit";
  input.type = "text";
  input.inputMode = "numeric";
  input.maxLength = 1;
  input.autocomplete = "off";
  input.pattern = "[0-9]";
  input.setAttribute("aria-label", ariaLabel);
  input.addEventListener("beforeinput", (event) => {
    if (event.data && !/^[0-9]$/.test(event.data)) {
      event.preventDefault();
    }
  });
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 1);
    onChange(input);
  });
  return input;
}

function isSubMultiset(entered, expected) {
  const pool = [...expected];
  for (const value of entered) {
    const idx = pool.indexOf(value);
    if (idx === -1) {
      return false;
    }
    pool.splice(idx, 1);
  }
  return true;
}

function hideRowEquation(row) {
  row.verifying = false;
  row.equationBuild.hidden = true;
  row.equationTarget.hidden = true;
  row.equationBuild.replaceChildren();
  row.equationTargetInput.value = "";
  row.equationTargetInput.disabled = false;
  row.equationTargetInput.classList.remove("is-correct", "is-wrong");
  row.buildSlot.classList.remove("is-equation-success");
  row.root
    .querySelector(".card-slot--target")
    ?.classList.remove("is-equation-success");
}

function showRowEquation(row) {
  row.verifying = true;
  row.equationBuild.replaceChildren();
  const expectedAddends = row.stacked.map((name) => String(cardValue(name)));

  row.stacked.forEach((_, index) => {
    if (index > 0) {
      const plus = document.createElement("span");
      plus.className = "equation-op";
      plus.textContent = "+";
      plus.setAttribute("aria-hidden", "true");
      row.equationBuild.appendChild(plus);
    }
    const input = makeDigitInput(`Addend ${index + 1}`, (el) =>
      onRowEquationInput(row, el),
    );
    row.equationBuild.appendChild(input);
  });

  row.equationTargetInput.dataset.expected = String(cardValue(currentTarget));
  row.equationTargetInput.dataset.addends = expectedAddends.join(",");
  row.equationTargetInput.value = "";
  row.equationTargetInput.disabled = false;
  row.equationTargetInput.classList.remove("is-correct", "is-wrong");
  row.equationTargetInput.oninput = () => {
    row.equationTargetInput.value = row.equationTargetInput.value
      .replace(/\D/g, "")
      .slice(0, 1);
    onRowEquationInput(row, row.equationTargetInput);
  };

  row.equationBuild.hidden = false;
  row.equationTarget.hidden = false;
  row.clearBtn.hidden = true;
  renderPalette();
  row.equationBuild.querySelector(".equation-digit")?.focus();
}

function rowEquationInputs(row) {
  return [
    ...row.equationBuild.querySelectorAll(".equation-digit"),
    row.equationTargetInput,
  ];
}

function paintRowEquation(row) {
  const buildInputs = [
    ...row.equationBuild.querySelectorAll(".equation-digit"),
  ];
  const expected = (row.equationTargetInput.dataset.addends || "").split(",");
  const entered = buildInputs
    .map((input) => input.value)
    .filter((value) => value !== "");
  const buildOk = isSubMultiset(entered, expected);

  for (const input of buildInputs) {
    if (input.value === "") {
      input.classList.remove("is-correct", "is-wrong");
    } else if (buildOk) {
      input.classList.add("is-correct");
      input.classList.remove("is-wrong");
    } else {
      input.classList.add("is-wrong");
      input.classList.remove("is-correct");
    }
  }

  const target = row.equationTargetInput;
  if (target.value === "") {
    target.classList.remove("is-correct", "is-wrong");
  } else if (target.value === target.dataset.expected) {
    target.classList.add("is-correct");
    target.classList.remove("is-wrong");
  } else {
    target.classList.add("is-wrong");
    target.classList.remove("is-correct");
  }
}

function rowEquationCorrect(row) {
  const buildInputs = [
    ...row.equationBuild.querySelectorAll(".equation-digit"),
  ];
  if (buildInputs.some((input) => input.value === "")) {
    return false;
  }
  if (row.equationTargetInput.value === "") {
    return false;
  }
  const entered = buildInputs.map((input) => input.value);
  const expected = (row.equationTargetInput.dataset.addends || "").split(",");
  return (
    entered.length === expected.length &&
    isSubMultiset(entered, expected) &&
    row.equationTargetInput.value === row.equationTargetInput.dataset.expected
  );
}

function onRowEquationInput(row, current) {
  if (!row.verifying || row.solved) {
    return;
  }
  paintRowEquation(row);
  if (current.value !== "") {
    const inputs = rowEquationInputs(row);
    const idx = inputs.indexOf(current);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
    }
  }
  if (rowEquationCorrect(row)) {
    completeRowEquation(row);
  }
}

function completeRowEquation(row) {
  if (row.solved || !currentTarget) {
    return;
  }
  row.solved = true;
  row.verifying = false;
  for (const input of rowEquationInputs(row)) {
    input.disabled = true;
    input.classList.add("is-correct");
    input.classList.remove("is-wrong");
  }
  row.buildSlot.classList.add("is-equation-success");
  row.root
    .querySelector(".card-slot--target")
    ?.classList.add("is-equation-success");
  renderRowBuild(row);
  renderPalette();

  window.setTimeout(() => {
    row.buildSlot.classList.remove("is-equation-success");
    row.root
      .querySelector(".card-slot--target")
      ?.classList.remove("is-equation-success");
    if (rows.every((item) => item.solved)) {
      finishTarget();
    }
  }, 2000);
}

function clearRow(row) {
  if (row.verifying || row.solved) {
    return;
  }
  row.stacked = [];
  row.turns = [];
  row.claimedPair = null;
  hideRowEquation(row);
  renderRowBuild(row);
  renderPalette();
}

function createRow(index) {
  const root = document.createElement("div");
  root.className = "addends-row";
  root.dataset.row = String(index);

  root.innerHTML = `
    <div class="assemble-slot">
      <h2 class="assemble-label">Build</h2>
      <div class="card-slot" data-drop="build" aria-label="Build drop target">
        <button type="button" class="build-clear" hidden aria-label="Clear build" title="Clear build">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 7l1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="card-slot__mount"></div>
      </div>
      <div class="equation-build" hidden aria-label="Enter each build card value"></div>
    </div>
    <div class="assemble-slot">
      <h2 class="assemble-label">Target</h2>
      <div class="card-slot card-slot--target" aria-label="Target card">
        <div class="card-slot__mount"></div>
      </div>
      <div class="equation-target" hidden>
        <span class="equation-op" aria-hidden="true">=</span>
        <input class="equation-digit" type="text" inputmode="numeric" maxlength="1" pattern="[0-9]" autocomplete="off" aria-label="Target card value" />
      </div>
    </div>
  `;

  /** @type {Row} */
  const row = {
    index,
    stacked: [],
    turns: [],
    verifying: false,
    solved: false,
    claimedPair: null,
    root,
    buildSlot: root.querySelector("[data-drop='build']"),
    buildMount: root.querySelector("[data-drop='build'] .card-slot__mount"),
    clearBtn: root.querySelector(".build-clear"),
    equationBuild: root.querySelector(".equation-build"),
    equationTarget: root.querySelector(".equation-target"),
    equationTargetInput: root.querySelector(".equation-target .equation-digit"),
  };

  root
    .querySelector(".card-slot--target .card-slot__mount")
    .appendChild(renderCard(currentTarget, { className: "play-card" }));
  row.clearBtn.addEventListener("click", () => clearRow(row));
  renderRowBuild(row);
  return row;
}

function renderRows() {
  els.rows.replaceChildren();
  rows = partitions.map((_, index) => {
    const row = createRow(index);
    els.rows.appendChild(row.root);
    return row;
  });
}

function renderPalette() {
  const anyVerifying = rows.some((row) => row.verifying);
  els.palette.replaceChildren();
  for (const name of paletteNames()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-card";
    btn.dataset.name = name;
    btn.setAttribute("aria-label", `Palette card ${name}`);
    if (anyVerifying || name === currentTarget) {
      btn.disabled = true;
      btn.classList.add("is-used");
    }
    btn.appendChild(renderCard(name, { className: "palette-card__svg" }));
    btn.addEventListener("pointerdown", (event) => {
      if (btn.disabled) {
        return;
      }
      beginDrag(name, btn, event);
    });
    els.palette.appendChild(btn);
  }
}

function renderDeckCard(name, className = "deck-card") {
  const item = document.createElement("div");
  item.className = className;
  item.appendChild(renderCard(name, { className: "deck-card__svg" }));
  return item;
}

function renderDeckRows() {
  els.pendingGrid.replaceChildren(
    ...pendingTargets.map((name) => renderDeckCard(name)),
  );
  els.completedGrid.replaceChildren(
    ...completedTargets.map((name) =>
      renderDeckCard(name, "deck-card deck-card--done"),
    ),
  );
}

function finishTarget() {
  if (!currentTarget) {
    return;
  }
  completedTargets.push(currentTarget);
  currentTarget = null;
  partitions = [];
  rows = [];
  els.rows.replaceChildren();
  renderDeckRows();
  presentTarget();
}

function presentTarget() {
  hideDragCoach();
  if (!currentTarget && pendingTargets.length === 0) {
    showScreen("win");
    return;
  }
  if (!currentTarget) {
    currentTarget = pendingTargets.shift() ?? null;
  }
  partitions = valuePartitions(currentTarget);
  renderRows();
  renderDeckRows();
  renderPalette();
}

function resetGame() {
  pendingTargets = shuffle([...TARGET_DECK]);
  completedTargets = [];
  currentTarget = null;
  partitions = [];
  rows = [];
  els.rows.replaceChildren();
  renderDeckRows();
}

function hideDragCoach() {
  if (dragCoachTimer !== null) {
    window.clearTimeout(dragCoachTimer);
    dragCoachTimer = null;
  }
  if (!els.dragCoach) {
    return;
  }
  els.dragCoach.classList.remove("is-visible");
  els.dragCoach.hidden = true;
}

function layoutDragCoachArrow() {
  if (
    !els.dragCoach ||
    !els.dragCoachPath ||
    !els.dragCoachHead ||
    !els.assemblePalette ||
    !rows[0]
  ) {
    return;
  }
  const coachRect = els.dragCoach.getBoundingClientRect();
  const paletteRect = els.assemblePalette.getBoundingClientRect();
  const buildRect = rows[0].buildSlot.getBoundingClientRect();
  const startX = paletteRect.left + paletteRect.width * 0.55 - coachRect.left;
  const startY = paletteRect.top + paletteRect.height * 0.42 - coachRect.top;
  const endX = buildRect.left + buildRect.width * 0.5 - coachRect.left;
  const endY = buildRect.top + buildRect.height * 0.5 - coachRect.top;
  const dx = endX - startX;
  const midX = startX + dx * 0.5;
  const midY = Math.min(startY, endY) - Math.max(36, Math.abs(dx) * 0.12);
  els.dragCoachPath.setAttribute(
    "d",
    `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`,
  );
  const angle = Math.atan2(endY - midY, endX - midX);
  const headLen = 28;
  const spread = Math.PI / 7;
  const leftX = endX - headLen * Math.cos(angle - spread);
  const leftY = endY - headLen * Math.sin(angle - spread);
  const rightX = endX - headLen * Math.cos(angle + spread);
  const rightY = endY - headLen * Math.sin(angle + spread);
  els.dragCoachHead.setAttribute(
    "d",
    `M ${leftX} ${leftY} L ${endX} ${endY} L ${rightX} ${rightY}`,
  );
}

function showDragCoach() {
  if (!els.dragCoach) {
    return;
  }
  hideDragCoach();
  els.dragCoach.hidden = false;
  requestAnimationFrame(() => {
    layoutDragCoachArrow();
    void els.dragCoach.offsetWidth;
    els.dragCoach.classList.add("is-visible");
  });
  dragCoachTimer = window.setTimeout(() => {
    els.dragCoach.classList.remove("is-visible");
    dragCoachTimer = window.setTimeout(() => {
      els.dragCoach.hidden = true;
      dragCoachTimer = null;
    }, 280);
  }, 2600);
}

function startGame() {
  resetGame();
  showScreen("play");
  presentTarget();
  showDragCoach();
}

function beginDrag(name, originEl, event) {
  if (drag || rows.some((row) => row.verifying) || event.button !== 0) {
    return;
  }
  hideDragCoach();
  event.preventDefault();

  const rect = originEl.getBoundingClientRect();
  const sample = rows[0]?.buildMount.getBoundingClientRect();
  const ghostSize = Math.max(sample?.width || 160, 1);
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.style.width = `${ghostSize}px`;
  ghost.appendChild(renderCard(name, { className: "drag-ghost__card" }));
  document.body.appendChild(ghost);

  const scale = ghostSize / Math.max(rect.width, 1);
  drag = {
    name,
    turns: 0,
    originEl,
    ghost,
    offsetX: (event.clientX - rect.left) * scale,
    offsetY: (event.clientY - rect.top) * scale,
    pointerId: event.pointerId,
  };
  originEl.classList.add("is-dragging");
  originEl.setPointerCapture?.(event.pointerId);
  moveGhost(event.clientX, event.clientY);
  updateGhostTransform();
  els.spaceHint.hidden = false;
}

function updateGhostTransform() {
  if (!drag) {
    return;
  }
  const card = drag.ghost.querySelector(".drag-ghost__card");
  if (card) {
    card.style.transform = `rotate(${drag.turns * 90}deg)`;
  }
}

function moveGhost(clientX, clientY) {
  if (!drag) {
    return;
  }
  drag.ghost.style.transform = `translate(${clientX - drag.offsetX}px, ${clientY - drag.offsetY}px)`;
}

function rowAtPoint(clientX, clientY) {
  for (const row of rows) {
    if (row.solved || row.verifying) {
      continue;
    }
    const rect = row.buildSlot.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return row;
    }
  }
  return null;
}

function flyGhostHome(active, onDone) {
  const home = active.originEl.getBoundingClientRect();
  active.ghost.classList.add("is-returning");
  active.ghost.style.transform = `translate(${home.left}px, ${home.top}px)`;
  let settled = false;
  const finish = () => {
    if (settled) {
      return;
    }
    settled = true;
    active.ghost.remove();
    onDone();
  };
  active.ghost.addEventListener("transitionend", finish, { once: true });
  window.setTimeout(finish, 320);
}

function tryAcceptDrop(row, active) {
  if (row.stacked.length >= 2) {
    return { ok: false, reason: "full" };
  }

  const addition = rotateDots(cardDots(active.name), active.turns);
  const base = row.stacked.length === 0 ? {} : rowDots(row);
  const merged = tryMergeDots(base, addition);
  if (!merged) {
    return { ok: false, reason: "overlap" };
  }

  const nextStacked = [...row.stacked, active.name];
  const nextTurns = [...row.turns, active.turns];
  if (nextStacked.length < 2) {
    row.stacked = nextStacked;
    row.turns = nextTurns;
    return { ok: true, complete: false };
  }

  if (!samePattern(merged, cardDots(currentTarget))) {
    // Keep both cards so the player can clear and retry.
    row.stacked = nextStacked;
    row.turns = nextTurns;
    return { ok: true, complete: false, mismatch: true };
  }

  const values = nextStacked.map((name) => cardValue(name));
  const key = pairKey(values[0], values[1]);
  const allowed = partitions.some(([a, b]) => pairKey(a, b) === key);
  if (!allowed || claimedPairs().has(key)) {
    return { ok: false, reason: allowed ? "duplicate" : "partition" };
  }

  row.stacked = nextStacked;
  row.turns = nextTurns;
  row.claimedPair = key;
  return { ok: true, complete: true };
}

function endDrag(clientX, clientY, { cancelled = false } = {}) {
  if (!drag) {
    return;
  }
  const active = drag;
  drag = null;
  els.spaceHint.hidden = true;
  if (hotRowIndex !== null && rows[hotRowIndex]) {
    rows[hotRowIndex].buildSlot.classList.remove("is-hot");
  }
  hotRowIndex = null;
  active.originEl.classList.remove("is-dragging");

  const row = cancelled ? null : rowAtPoint(clientX, clientY);
  if (!row) {
    flyGhostHome(active, () => {});
    return;
  }

  const result = tryAcceptDrop(row, active);
  if (!result.ok) {
    row.buildSlot.classList.add("is-reject");
    window.setTimeout(() => row.buildSlot.classList.remove("is-reject"), 400);
    flyGhostHome(active, () => {});
    return;
  }

  active.ghost.remove();
  renderRowBuild(row);
  if (result.complete) {
    showRowEquation(row);
  }
}

function onPointerMove(event) {
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }
  moveGhost(event.clientX, event.clientY);
  const row = rowAtPoint(event.clientX, event.clientY);
  const nextIndex = row ? row.index : null;
  if (hotRowIndex !== nextIndex) {
    if (hotRowIndex !== null && rows[hotRowIndex]) {
      rows[hotRowIndex].buildSlot.classList.remove("is-hot");
    }
    if (row) {
      row.buildSlot.classList.add("is-hot");
    }
    hotRowIndex = nextIndex;
  }
}

function onPointerUp(event) {
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }
  endDrag(event.clientX, event.clientY);
}

function onKeyDown(event) {
  if (!drag) {
    return;
  }
  if (event.code === "Space" || event.key === " ") {
    event.preventDefault();
    drag.turns = (drag.turns + 1) % 4;
    updateGhostTransform();
  } else if (event.key === "Escape") {
    event.preventDefault();
    endDrag(0, 0, { cancelled: true });
  }
}

document.addEventListener("pointermove", onPointerMove);
document.addEventListener("pointerup", onPointerUp);
document.addEventListener("pointercancel", onPointerUp);
document.addEventListener("keydown", onKeyDown);

els.startBtn.addEventListener("click", startGame);
els.againBtn.addEventListener("click", startGame);
els.dragCoach?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  hideDragCoach();
});
window.addEventListener("resize", () => {
  if (els.dragCoach && !els.dragCoach.hidden) {
    layoutDragCoachArrow();
  }
});

showScreen("start");
