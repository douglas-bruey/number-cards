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

/** Challenge deck: targets players must assemble. */
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
  equationBuild: document.getElementById("equation-build"),
  equationTarget: document.getElementById("equation-target"),
  equationTargetInput: document.getElementById("equation-target-input"),
  assembleBoard: document.querySelector(".assemble-board"),
  dragCoach: document.getElementById("drag-coach"),
};

/** Cards still waiting to be drawn into the target slot. */
/** @type {string[]} */
let pendingTargets = [];
/** Cards successfully built. */
/** @type {string[]} */
let completedTargets = [];
/** @type {string | null} */
let currentTarget = null;
/** @type {string[]} cards currently stacked in the build area */
let stacked = [];
/** @type {number[]} quarter-turns for each stacked card */
let stackedTurns = [];
/** True while the player is filling in card values after a pattern match. */
let verifying = false;
let equationSolved = false;
/** @type {number | null} */
let dragCoachTimer = null;

/** @type {{ name: string, turns: number, originEl: HTMLElement, ghost: HTMLElement, offsetX: number, offsetY: number, pointerId: number } | null} */
let drag = null;

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
  els.clearBtn.hidden = empty || verifying;
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
    // Locked while verifying, or when this card matches the current target.
    if (verifying || name === currentTarget) {
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

function makeDigitInput(ariaLabel) {
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
    onEquationInput(input);
  });
  return input;
}

function hideEquation() {
  verifying = false;
  equationSolved = false;
  els.equationBuild.hidden = true;
  els.equationTarget.hidden = true;
  els.equationBuild.replaceChildren();
  els.equationTargetInput.value = "";
  els.equationTargetInput.disabled = false;
  els.equationTargetInput.classList.remove("is-correct", "is-wrong");
  els.assembleBoard?.classList.remove("is-equation-success");
  els.buildSlot.classList.remove("is-equation-success");
  document
    .querySelector(".card-slot--target")
    ?.classList.remove("is-equation-success");
}

function expectedBuildValues() {
  return stacked.map((name) => String(cardValue(name)));
}

/** True when `entered` is a sub-multiset of `expected`. */
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

function showEquation() {
  verifying = true;
  equationSolved = false;
  els.equationBuild.replaceChildren();

  stacked.forEach((_, index) => {
    if (index > 0) {
      const plus = document.createElement("span");
      plus.className = "equation-op";
      plus.textContent = "+";
      plus.setAttribute("aria-hidden", "true");
      els.equationBuild.appendChild(plus);
    }
    const input = makeDigitInput(`Addend ${index + 1}`);
    els.equationBuild.appendChild(input);
  });

  els.equationTargetInput.dataset.expected = String(cardValue(currentTarget));
  els.equationTargetInput.value = "";
  els.equationTargetInput.disabled = false;
  els.equationTargetInput.classList.remove("is-correct", "is-wrong");

  els.equationBuild.hidden = false;
  els.equationTarget.hidden = false;
  els.clearBtn.hidden = true;
  renderPalette();

  const first = els.equationBuild.querySelector(".equation-digit");
  first?.focus();
}

function buildDigitInputs() {
  return [...els.equationBuild.querySelectorAll(".equation-digit")];
}

function equationInputs() {
  return [...buildDigitInputs(), els.equationTargetInput];
}

function paintEquationState() {
  const buildInputs = buildDigitInputs();
  const expected = expectedBuildValues();
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

  const target = els.equationTargetInput;
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

function equationIsCorrect() {
  const buildInputs = buildDigitInputs();
  if (buildInputs.some((input) => input.value === "")) {
    return false;
  }
  if (els.equationTargetInput.value === "") {
    return false;
  }
  const entered = buildInputs.map((input) => input.value);
  const expected = expectedBuildValues();
  if (entered.length !== expected.length) {
    return false;
  }
  return (
    isSubMultiset(entered, expected) &&
    els.equationTargetInput.value === els.equationTargetInput.dataset.expected
  );
}

function onEquationInput(current) {
  if (!verifying || equationSolved) {
    return;
  }

  paintEquationState();

  if (current.value !== "" && current.value.length === 1) {
    const inputs = equationInputs();
    const idx = inputs.indexOf(current);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
    }
  }

  if (equationIsCorrect()) {
    completeEquation();
  }
}

function completeEquation() {
  if (equationSolved || !currentTarget) {
    return;
  }
  equationSolved = true;
  for (const input of equationInputs()) {
    input.disabled = true;
    input.classList.add("is-correct");
    input.classList.remove("is-wrong");
  }

  els.assembleBoard?.classList.add("is-equation-success");
  els.buildSlot.classList.add("is-equation-success");
  document
    .querySelector(".card-slot--target")
    ?.classList.add("is-equation-success");

  const cleared = currentTarget;
  window.setTimeout(() => {
    completedTargets.push(cleared);
    currentTarget = null;
    hideEquation();
    presentTarget();
  }, 2000);
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
  hideEquation();

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
  if (verifying) {
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
  hideEquation();
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

function showDragCoach() {
  if (!els.dragCoach) {
    return;
  }
  hideDragCoach();
  els.dragCoach.hidden = false;
  // Force reflow so the enter animation can replay.
  void els.dragCoach.offsetWidth;
  els.dragCoach.classList.add("is-visible");
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

function checkMatch() {
  if (!currentTarget || verifying) {
    return;
  }
  const built = buildDotsFromStack();
  const target = cardDots(currentTarget);
  if (!samePattern(built, target)) {
    return;
  }
  showEquation();
}

/**
 * @param {string} name
 * @param {HTMLElement} originEl
 * @param {PointerEvent} event
 */
function beginDrag(name, originEl, event) {
  if (drag || verifying || event.button !== 0) {
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

  // Keep the grab point under the cursor after scaling up to build size.
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

function onPointerMove(event) {
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
    drag.turns = (drag.turns + 1) % 4;
    updateGhostTransform();
  } else if (event.key === "Escape") {
    event.preventDefault();
    els.buildSlot.classList.remove("is-hot");
    endDrag(0, 0, { cancelled: true });
  }
}

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
els.equationTargetInput.addEventListener("beforeinput", (event) => {
  if (event.data && !/^[0-9]$/.test(event.data)) {
    event.preventDefault();
  }
});
els.equationTargetInput.addEventListener("input", () => {
  els.equationTargetInput.value = els.equationTargetInput.value
    .replace(/\D/g, "")
    .slice(0, 1);
  onEquationInput(els.equationTargetInput);
});

showScreen("start");
