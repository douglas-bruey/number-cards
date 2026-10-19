import {
  cardValue,
  deckNames,
  renderCard,
} from "./cards.js";

const TIME_LIMIT_MS = 3000;
const WINS_TO_ELIMINATE = 3;

const els = {
  stage: document.getElementById("stage"),
  cardMount: document.getElementById("card-mount"),
  timerBar: document.getElementById("timer-bar"),
  timerTrack: document.getElementById("timer-track"),
  feedback: document.getElementById("feedback"),
  answerPad: document.getElementById("answer-pad"),
  remaining: document.getElementById("remaining-count"),
  progressList: document.getElementById("progress-list"),
  startScreen: document.getElementById("start-screen"),
  playScreen: document.getElementById("play-screen"),
  winScreen: document.getElementById("win-screen"),
  startBtn: document.getElementById("start-btn"),
  againBtn: document.getElementById("again-btn"),
};

/** @type {Map<string, number>} */
let wins = new Map();
/** @type {string[]} */
let remaining = [];
/** @type {string | null} */
let current = null;
/** @type {number | null} */
let roundStartedAt = null;
/** @type {number | null} */
let rafId = null;
let locked = false;

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

function resetGame() {
  wins = new Map(deckNames().map((name) => [name, 0]));
  remaining = shuffle(deckNames());
  current = null;
  locked = false;
  stopTimer();
  updateHud();
  els.feedback.textContent = "";
  els.feedback.dataset.state = "";
  els.cardMount.replaceChildren();
  els.timerBar.style.transform = "scaleX(1)";
  els.timerTrack.dataset.state = "";
}

function updateHud() {
  els.remaining.textContent = String(remaining.length);

  els.progressList.replaceChildren();
  for (const name of deckNames()) {
    const li = document.createElement("li");
    li.className = "progress-chip";
    const count = wins.get(name) ?? 0;
    const eliminated = !remaining.includes(name) && count >= WINS_TO_ELIMINATE;
    li.dataset.value = String(cardValue(name));
    if (eliminated) {
      li.dataset.state = "eliminated";
    } else if (name === current) {
      li.dataset.state = "active";
    }
    li.title = `${name}: ${Math.min(count, WINS_TO_ELIMINATE)}/${WINS_TO_ELIMINATE}`;
    li.innerHTML = `<span class="progress-chip__name">${name}</span><span class="progress-chip__wins" aria-hidden="true">${"●".repeat(count)}${"○".repeat(Math.max(0, WINS_TO_ELIMINATE - count))}</span>`;
    els.progressList.appendChild(li);
  }
}

function stopTimer() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  roundStartedAt = null;
}

function tickTimer() {
  if (roundStartedAt === null) {
    return;
  }
  const elapsed = performance.now() - roundStartedAt;
  const left = Math.max(0, 1 - elapsed / TIME_LIMIT_MS);
  els.timerBar.style.transform = `scaleX(${left})`;

  if (elapsed >= TIME_LIMIT_MS) {
    handleTimeout();
    return;
  }
  rafId = requestAnimationFrame(tickTimer);
}

function startRoundTimer() {
  stopTimer();
  els.timerBar.style.transform = "scaleX(1)";
  els.timerTrack.dataset.state = "running";
  roundStartedAt = performance.now();
  rafId = requestAnimationFrame(tickTimer);
}

function setFeedback(message, state) {
  els.feedback.textContent = message;
  els.feedback.dataset.state = state;
}

function presentNextCard() {
  if (remaining.length === 0) {
    stopTimer();
    showScreen("win");
    return;
  }

  locked = false;
  remaining = shuffle(remaining);
  current = remaining[0];
  els.cardMount.replaceChildren(renderCard(current, { className: "play-card" }));
  els.cardMount.classList.remove("is-shake", "is-pop");
  // Force reflow so entrance animation can replay.
  void els.cardMount.offsetWidth;
  els.cardMount.classList.add("is-deal");
  setFeedback("What number is this?", "");
  updateHud();
  startRoundTimer();
}

function removeCurrentFromFront() {
  if (!current) {
    return;
  }
  const idx = remaining.indexOf(current);
  if (idx !== -1) {
    remaining.splice(idx, 1);
  }
}

function handleTimeout() {
  if (locked || !current) {
    return;
  }
  locked = true;
  stopTimer();
  els.timerTrack.dataset.state = "miss";
  els.cardMount.classList.add("is-shake");
  setFeedback("Too slow — keep going", "miss");
  window.setTimeout(() => {
    presentNextCard();
  }, 700);
}

function handleAnswer(answer) {
  if (locked || !current || roundStartedAt === null) {
    return;
  }

  const elapsed = performance.now() - roundStartedAt;
  const correct = answer === cardValue(current);
  const inTime = elapsed <= TIME_LIMIT_MS;

  locked = true;
  stopTimer();

  if (correct && inTime) {
    const nextWins = (wins.get(current) ?? 0) + 1;
    wins.set(current, nextWins);
    els.timerTrack.dataset.state = "hit";
    els.cardMount.classList.add("is-pop");

    if (nextWins >= WINS_TO_ELIMINATE) {
      removeCurrentFromFront();
      setFeedback(`Nice — ${current} cleared!`, "hit");
    } else {
      setFeedback(`Correct · ${nextWins}/${WINS_TO_ELIMINATE}`, "hit");
    }
  } else if (!correct) {
    els.timerTrack.dataset.state = "miss";
    els.cardMount.classList.add("is-shake");
    setFeedback(`That was ${cardValue(current)}`, "miss");
  } else {
    els.timerTrack.dataset.state = "miss";
    els.cardMount.classList.add("is-shake");
    setFeedback("Too slow — keep going", "miss");
  }

  updateHud();
  window.setTimeout(() => {
    presentNextCard();
  }, 700);
}

function buildAnswerPad() {
  els.answerPad.replaceChildren();
  for (let n = 0; n <= 9; n += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer-btn";
    btn.textContent = String(n);
    btn.setAttribute("aria-label", `Answer ${n}`);
    btn.addEventListener("click", () => handleAnswer(n));
    els.answerPad.appendChild(btn);
  }
}

function startGame() {
  resetGame();
  showScreen("play");
  presentNextCard();
}

buildAnswerPad();
showScreen("start");
els.startBtn.addEventListener("click", startGame);
els.againBtn.addEventListener("click", startGame);

document.addEventListener("keydown", (event) => {
  if (els.playScreen.hidden || locked) {
    return;
  }
  if (event.key >= "0" && event.key <= "9") {
    handleAnswer(Number(event.key));
  }
});
