"""Render cards to a PDF page for Silhouette Studio Print & Cut.

Card outlines are the cut lines: Studio is set to "Cut by Line Color" with
only CUT_COLOR enabled, so nothing else on the page may use that colour.
"""

from pathlib import Path

from reportlab.lib.colors import Color, black
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .geometry import CardSpec, PageSpec, Point, circle_centers

CUT_COLOR = Color(1, 0, 0)
CUT_LINE_WIDTH = 0.25  # points
PRINT_LINE_WIDTH = 0.5  # points


def write_pdf(path: Path, page: PageSpec, card: CardSpec, origins: list[Point]) -> None:
    c = canvas.Canvas(str(path), pagesize=(page.width * mm, page.height * mm))

    for ox, oy in origins:
        c.setStrokeColor(black)
        c.setLineWidth(PRINT_LINE_WIDTH)
        for x, y in circle_centers(card, (ox, oy)):
            c.circle(x * mm, y * mm, card.circle_radius * mm, stroke=1, fill=0)

        c.setStrokeColor(CUT_COLOR)
        c.setLineWidth(CUT_LINE_WIDTH)
        c.roundRect(
            ox * mm,
            oy * mm,
            card.size * mm,
            card.size * mm,
            card.corner_radius * mm,
            stroke=1,
            fill=0,
        )

    c.showPage()
    c.save()
