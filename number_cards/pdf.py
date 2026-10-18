"""Render cards to a PDF for Silhouette Studio Print & Cut.

Card outlines and the circles to be cut out are the cut lines: Studio is set
to "Cut by Line Color" with only CUT_COLOR enabled, so nothing else on the
page may use that colour.
"""

from pathlib import Path

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .cards import NUMBER_COLORS
from .geometry import CardSpec, PageSpec, Point, card_origins, circle_centers

CUT_COLOR = Color(1, 0, 0)
# Studio only prints lines thicker than 0, so zero-width cut lines are cut but
# not printed. PDF viewers still draw them as hairlines.
CUT_LINE_WIDTH = 0  # points

FILL_COLORS = {n: HexColor(h) for n, h in NUMBER_COLORS.items()}
if any(color.rgb() == CUT_COLOR.rgb() for color in FILL_COLORS.values()):
    raise ValueError("A circle fill colour matches the cut line colour")


def draw_card(c: canvas.Canvas, card: CardSpec, origin: Point, filled: str) -> None:
    r = card.circle_radius * mm
    centers = circle_centers(card, origin)

    if filled:
        c.setFillColor(FILL_COLORS[len(filled)])
    for letter in filled:
        x, y = centers[letter]
        c.circle(x * mm, y * mm, r, stroke=0, fill=1)

    # Holes come before the outline so they are cut while the card is still
    # held in place by the surrounding sheet.
    c.setStrokeColor(CUT_COLOR)
    c.setLineWidth(CUT_LINE_WIDTH)
    for letter, (x, y) in centers.items():
        if letter not in filled:
            c.circle(x * mm, y * mm, r, stroke=1, fill=0)

    ox, oy = origin
    c.roundRect(
        ox * mm,
        oy * mm,
        card.size * mm,
        card.size * mm,
        card.corner_radius * mm,
        stroke=1,
        fill=0,
    )


def write_pdf(path: Path, page: PageSpec, card: CardSpec, deck: dict[str, str]) -> None:
    """Write the deck in order, as many cards per page as the layout holds."""
    c = canvas.Canvas(str(path), pagesize=(page.width * mm, page.height * mm))
    origins = card_origins(page, card)
    names = list(deck)

    for start in range(0, len(names), len(origins)):
        for origin, name in zip(origins, names[start : start + len(origins)]):
            draw_card(c, card, origin, deck[name])
        c.showPage()

    c.save()
