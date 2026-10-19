import {
  cardDots,
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
  "4.1",
  "4.2",
  "4.3",
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
  targetName: document.getElementById("target-name"),
  remaining: document.getElementById("remaining-count"),
  feedback: document.getElementById("feedback"),
};

/** @type {string[]} */
let remainingTargets = [];
/** @type {string | null} */
let currentTarget = null;
/** @type {string[]} cards currently stacked in the build area */
let stacked = [];
/** @type {number[]} quarter-turns for each stacked card */
let stackedTurns = [];
/** @type {Set<string>} palette card names still available this round */
let available = new Set();

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
}

function setFeedback(message, state = "") {
  els.feedback.textContent = message;
  els.feedback.dataset.state = state;
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
  els.buildSlot.classList.toggle("is-empty", stacked.length === 0);
}

function renderTarget() {
  if (!currentTarget) {
    els.targetMount.replaceChildren();
    els.targetName.textContent = "";
    return;
  }
  els.targetMount.replaceChildren(
    renderCard(currentTarget, { className: "play-card" }),
  );
  els.targetName.textContent = currentTarget;
}

function renderPalette() {
  els.palette.replaceChildren();
  for (const name of paletteNames()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-card";
    btn.dataset.name = name;
    btn.setAttribute("aria-label", `Palette card ${name}`);
    if (!available.has(name)) {
      btn.disabled = true;
      btn.classList.add("is-used");
    }
    btn.appendChild(renderCard(name, { className: "palette-card__svg" }));
    const tag = document.createElement("span");
    tag.className = "palette-card__tag";
    tag.textContent = name;
    btn.appendChild(tag);
    btn.addEventListener("pointerdown", (event) => {
      if (btn.disabled) {
        return;
      }
      beginDrag(name, btn, event);
    });
    els.palette.appendChild(btn);
  }
}

function updateHud() {
  els.remaining.textContent = String(remainingTargets.length);
}

function presentTarget() {
  if (remainingTargets.length === 0) {
    currentTarget = null;
    clearBuild({ silent: true });
    showScreen("win");
    return;
  }
  currentTarget = remainingTargets[0];
  clearBuild({ silent: true });
  renderTarget();
  updateHud();
  setFeedback(`Build ${currentTarget}`, "");
}

function clearBuild({ silent = false } = {}) {
  stacked = [];
  stackedTurns = [];
  available = new Set(paletteNames());
  renderBuild();
  renderPalette();
  if (!silent) {
    setFeedback("Build cleared", "");
  }
}

function resetGame() {
  remainingTargets = shuffle([...TARGET_DECK]);
  currentTarget = null;
  clearBuild({ silent: true });
  updateHud();
}

function startGame() {
  resetGame();
  showScreen("play");
  presentTarget();
}

function checkMatch() {
  if (!currentTarget) {
    return;
  }
  const built = buildDotsFromStack();
  const target = cardDots(currentTarget);
  if (!samePattern(built, target)) {
    return;
  }
  const cleared = currentTarget;
  remainingTargets.shift();
  setFeedback(`${cleared} matched — nice`, "hit");
  window.setTimeout(() => {
    presentTarget();
  }, 650);
}

/**
 * @param {string} name
 * @param {HTMLElement} originEl
 * @param {PointerEvent} event
 */
function beginDrag(name, originEl, event) {
  if (drag || event.button !== 0) {
    return;
  }
  event.preventDefault();

  const rect = originEl.getBoundingClientRect();
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.appendChild(renderCard(name, { className: "drag-ghost__card" }));
  document.body.appendChild(ghost);

  drag = {
    name,
    turns: 0,
    originEl,
    ghost,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    pointerId: event.pointerId,
  };

  originEl.classList.add("is-dragging");
  originEl.setPointerCapture?.(event.pointerId);
  moveGhost(event.clientX, event.clientY);
  updateGhostTransform();
  setFeedback("Space rotates · drop on Build", "");
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
  const tryDrop = !cancelled && overBuildSlot(clientX, clientY);
  active.originEl.classList.remove("is-dragging");

  if (tryDrop) {
    const addition = rotateDots(cardDots(active.name), active.turns);
    const merged = tryMergeDots(buildDotsFromStack(), addition);
    if (!merged) {
      els.buildSlot.classList.add("is-reject");
      setFeedback("Dots overlap — try another spot or rotation", "miss");
      window.setTimeout(() => els.buildSlot.classList.remove("is-reject"), 400);
      flyGhostHome(active, () => {});
      return;
    }

    stacked.push(active.name);
    stackedTurns.push(active.turns);
    available.delete(active.name);
    active.ghost.remove();
    renderBuild();
    renderPalette();
    setFeedback(`Placed ${active.name}`, "hit");
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

showScreen("start");
