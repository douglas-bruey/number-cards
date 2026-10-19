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
- Flashcards: `web/flashcards/` — name each card within 3 seconds; three fast hits eliminate a card.

GitHub Pages deploys from `web/` on every push to `main` (see `.github/workflows/pages.yml`).
After the first successful workflow run, enable **Settings → Pages → Deploy from GitHub Actions** if it is not already selected.
