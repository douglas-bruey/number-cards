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

/** Challenge deck: targets players must assemble freely. */
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
  clearBtn: document.getElementById("clear-btn"),
  palette: document.getElementById("palette"),
  buildSlot: document.getElementById("build-slot"),
  buildMount: document.getElementById("build-mount"),
  targetMount: document.getElementById("target-mount"),
  spaceHint: document.getElementById("space-hint"),
  pendingGrid: document.getElementById("pending-grid"),
  completedGrid: document.getElementById("completed-grid"),
  assembleBoard: document.querySelector(".assemble-board"),
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
/** @type {string[]} */
let stacked = [];
/** @type {number[]} */
let stackedTurns = [];
/** True while a matched build is pulsing before advancing. */
let completing = false;
/** @type {number | null} */
let dragCoachTimer = null;

/** @type {{ name: string, turns: number, originEl: HTMLElement, ghost: HTMLElement, offsetX: number, offsetY: number, pointerId: number } | null} */
let drag = null;
/** @type {{ pointerId: number, x: number, y: number, at: number } | null} */
let rotateTap = null;

const ROTATE_TAP_MAX_MS = 350;
const ROTATE_TAP_MAX_MOVE_PX = 16;

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

function buildDotsFromStack() {
  /** @type {Record<string, string>} */
  let dots = {};
  for (let i = 0; i < stacked.length; i += 1) {
    const addition = rotateDots(cardDots(stacked[i]), stackedTurns[i]);
    const merged = tryMergeDots(dots, addition);
    if (!merged) {
      throw new Error("Stack has overlapping dots");
    }
    dots = merged;
  }
  return dots;
}

function renderBuild() {
  const dots = buildDotsFromStack();
  els.buildMount.replaceChildren(
    renderDots(dots, {
      className: "play-card",
      label:
        stacked.length === 0
          ? "Empty build area"
          : `Build with ${Object.keys(dots).length} dots`,
    }),
  );
  const empty = stacked.length === 0;
  els.buildSlot.classList.toggle("is-empty", empty);
  els.clearBtn.hidden = empty || completing;
}

function renderTarget() {
  if (!currentTarget) {
    els.targetMount.replaceChildren();
    return;
  }
  els.targetMount.replaceChildren(
    renderCard(currentTarget, { className: "play-card" }),
  );
}

function renderPalette() {
  els.palette.replaceChildren();
  for (const name of paletteNames()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-card";
    btn.dataset.name = name;
    btn.setAttribute("aria-label", `Palette card ${name}`);
    const tooLarge =
      currentTarget !== null && cardValue(name) >= cardValue(currentTarget);
    if (completing || tooLarge) {
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

function clearSuccessPulse() {
  completing = false;
  els.assembleBoard?.classList.remove("is-equation-success");
  els.buildSlot.classList.remove("is-equation-success");
  document
    .querySelector(".card-slot--target")
    ?.classList.remove("is-equation-success");
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

function presentTarget() {
  clearSuccessPulse();

  if (!currentTarget && pendingTargets.length === 0) {
    clearBuild();
    renderDeckRows();
    showScreen("win");
    return;
  }

  if (!currentTarget) {
    currentTarget = pendingTargets.shift() ?? null;
  }

  stacked = [];
  stackedTurns = [];
  renderBuild();
  renderTarget();
  renderDeckRows();
  renderPalette();
}

function clearBuild() {
  if (completing) {
    return;
  }
  stacked = [];
  stackedTurns = [];
  renderBuild();
  renderPalette();
}

function resetGame() {
  pendingTargets = shuffle([...TARGET_DECK]);
  completedTargets = [];
  currentTarget = null;
  clearSuccessPulse();
  clearBuild();
  renderTarget();
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
    !els.buildSlot
  ) {
    return;
  }

  const coachRect = els.dragCoach.getBoundingClientRect();
  const paletteRect = els.assemblePalette.getBoundingClientRect();
  const buildRect = els.buildSlot.getBoundingClientRect();

  const startX = paletteRect.left + paletteRect.width * 0.55 - coachRect.left;
  const startY = paletteRect.top + paletteRect.height * 0.42 - coachRect.top;
  const endX = buildRect.left + buildRect.width * 0.5 - coachRect.left;
  const endY = buildRect.top + buildRect.height * 0.5 - coachRect.top;

  const dx = endX - startX;
  const dy = endY - startY;
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

function completeTarget() {
  if (completing || !currentTarget) {
    return;
  }
  completing = true;
  els.clearBtn.hidden = true;
  renderPalette();

  els.assembleBoard?.classList.add("is-equation-success");
  els.buildSlot.classList.add("is-equation-success");
  document
    .querySelector(".card-slot--target")
    ?.classList.add("is-equation-success");

  const cleared = currentTarget;
  window.setTimeout(() => {
    completedTargets.push(cleared);
    currentTarget = null;
    clearSuccessPulse();
    presentTarget();
  }, 2000);
}

function checkMatch() {
  if (!currentTarget || completing) {
    return;
  }
  const built = buildDotsFromStack();
  const target = cardDots(currentTarget);
  if (!samePattern(built, target)) {
    return;
  }
  completeTarget();
}

/**
 * @param {string} name
 * @param {HTMLElement} originEl
 * @param {PointerEvent} event
 */
function beginDrag(name, originEl, event) {
  if (drag || completing || event.button !== 0) {
    return;
  }
  hideDragCoach();
  event.preventDefault();

  const rect = originEl.getBoundingClientRect();
  const buildSize = els.buildMount.getBoundingClientRect();
  const ghostSize = Math.max(buildSize.width, 1);
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

function rotateDragCard() {
  if (!drag) {
    return;
  }
  drag.turns = (drag.turns + 1) % 4;
  updateGhostTransform();
}

function isRotateTap(pointer, clientX, clientY) {
  const elapsed = performance.now() - pointer.at;
  const dx = clientX - pointer.x;
  const dy = clientY - pointer.y;
  return (
    elapsed <= ROTATE_TAP_MAX_MS &&
    dx * dx + dy * dy <= ROTATE_TAP_MAX_MOVE_PX * ROTATE_TAP_MAX_MOVE_PX
  );
}

function moveGhost(clientX, clientY) {
  if (!drag) {
    return;
  }
  drag.ghost.style.transform = `translate(${clientX - drag.offsetX}px, ${clientY - drag.offsetY}px)`;
}

function overBuildSlot(clientX, clientY) {
  const rect = els.buildSlot.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
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

function endDrag(clientX, clientY, { cancelled = false } = {}) {
  if (!drag) {
    return;
  }
  const active = drag;
  drag = null;
  rotateTap = null;
  els.spaceHint.hidden = true;
  const tryDrop = !cancelled && overBuildSlot(clientX, clientY);
  active.originEl.classList.remove("is-dragging");

  if (tryDrop) {
    const addition = rotateDots(cardDots(active.name), active.turns);
    const merged = tryMergeDots(buildDotsFromStack(), addition);
    if (!merged) {
      els.buildSlot.classList.add("is-reject");
      window.setTimeout(() => els.buildSlot.classList.remove("is-reject"), 400);
      flyGhostHome(active, () => {});
      return;
    }

    stacked.push(active.name);
    stackedTurns.push(active.turns);
    active.ghost.remove();
    renderBuild();
    checkMatch();
    return;
  }

  flyGhostHome(active, () => {});
}

function onPointerDown(event) {
  if (!drag || event.pointerId === drag.pointerId) {
    return;
  }
  event.preventDefault();
  rotateTap = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    at: performance.now(),
  };
}

function onPointerMove(event) {
  if (rotateTap && event.pointerId === rotateTap.pointerId) {
    if (!isRotateTap(rotateTap, event.clientX, event.clientY)) {
      rotateTap = null;
    }
    return;
  }
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }
  moveGhost(event.clientX, event.clientY);
  els.buildSlot.classList.toggle(
    "is-hot",
    overBuildSlot(event.clientX, event.clientY),
  );
}

function onPointerUp(event) {
  if (rotateTap && event.pointerId === rotateTap.pointerId) {
    const tap = rotateTap;
    rotateTap = null;
    if (drag && isRotateTap(tap, event.clientX, event.clientY)) {
      rotateDragCard();
    }
    return;
  }
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }
  els.buildSlot.classList.remove("is-hot");
  endDrag(event.clientX, event.clientY);
}

function onKeyDown(event) {
  if (!drag) {
    return;
  }
  if (event.code === "Space" || event.key === " ") {
    event.preventDefault();
    rotateDragCard();
  } else if (event.key === "Escape") {
    event.preventDefault();
    els.buildSlot.classList.remove("is-hot");
    endDrag(0, 0, { cancelled: true });
  }
}

document.addEventListener("pointerdown", onPointerDown, { passive: false });
document.addEventListener("pointermove", onPointerMove);
document.addEventListener("pointerup", onPointerUp);
document.addEventListener("pointercancel", onPointerUp);
document.addEventListener("keydown", onKeyDown);

els.startBtn.addEventListener("click", startGame);
els.againBtn.addEventListener("click", startGame);
els.clearBtn.addEventListener("click", () => clearBuild());
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
