# number-cards

Dot cards for constructing numbers 0–9.

## Physical cards

Generate a Print & Cut PDF for Silhouette Studio:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m number_cards
```

## Virtual cards

A static site under `web/` hosts browser games that use the same deck.

- Menu: `web/index.html`
- Flashcards: `web/flashcards/` — name each card before the timer runs out (default 3s, adjustable 1–9s via the in-game control or `?time=5`); three fast hits eliminate a card.
- Assemble: `web/assemble/` — stack palette cards (1–8) onto a build area to match target patterns; Space rotates while dragging; overlapping dots bounce back.
- Addends: `web/addends/` — for each target, complete a row for every unique two-card addend pair, then enter the equation.

GitHub Pages deploys from `web/` on every push to `main` (see `.github/workflows/pages.yml`).
After the first successful workflow run, enable **Settings → Pages → Deploy from GitHub Actions** if it is not already selected.
