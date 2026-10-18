"""Card and page geometry.

All lengths are in millimetres, with the origin at the bottom-left corner of
the page and y pointing up (the PDF convention).
"""

import math
from dataclasses import dataclass

Point = tuple[float, float]


@dataclass(frozen=True)
class CardSpec:
    size: float = 120.0
    corner_radius: float = 10.0
    circle_radius: float = 10.0
    # Distance between neighbouring circle centres along the grid's own axes,
    # before the grid is rotated 45 degrees into a diamond.
    grid_spacing: float = 30.0


@dataclass(frozen=True)
class PageSpec:
    # US Letter, portrait.
    width: float = 215.9
    height: float = 279.4
    # Vertical gap between the two cards.
    card_gap: float = 10.0


def card_origins(page: PageSpec, card: CardSpec) -> list[Point]:
    """Bottom-left corners of the two cards, stacked vertically and centred."""
    stack_height = 2 * card.size + page.card_gap
    if card.size > page.width or stack_height > page.height:
        raise ValueError("Two cards do not fit on the page")

    x = (page.width - card.size) / 2
    bottom = (page.height - stack_height) / 2
    top = bottom + card.size + page.card_gap
    return [(x, top), (x, bottom)]


def circle_centers(card: CardSpec, origin: Point) -> list[Point]:
    """Centres of the 3x3 circle grid, rotated 45 degrees into a diamond.

    Ordered top to bottom, then left to right.
    """
    cx = origin[0] + card.size / 2
    cy = origin[1] + card.size / 2
    step = card.grid_spacing / math.sqrt(2)

    centers = []
    for row in (-1, 0, 1):
        for col in (-1, 0, 1):
            centers.append((cx + (col - row) * step, cy - (col + row) * step))
    centers.sort(key=lambda p: (-round(p[1], 6), p[0]))
    return centers
