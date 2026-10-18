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
    card_gap: float = 3.0
    # Silhouette Studio's default registration mark inset (0.625 in). Cut
    # lines must stay inside the border this far in from every page edge.
    registration_inset: float = 15.875


def card_origins(page: PageSpec, card: CardSpec) -> list[Point]:
    """Bottom-left corners of the two cards, stacked vertically and centred."""
    stack_height = 2 * card.size + page.card_gap
    usable_width = page.width - 2 * page.registration_inset
    usable_height = page.height - 2 * page.registration_inset
    if card.size > usable_width or stack_height > usable_height:
        raise ValueError(
            f"Two cards ({card.size:g} x {stack_height:g} mm) do not fit inside "
            f"the registration border ({usable_width:g} x {usable_height:g} mm)"
        )

    x = (page.width - card.size) / 2
    bottom = (page.height - stack_height) / 2
    top = bottom + card.size + page.card_gap
    return [(x, top), (x, bottom)]


CIRCLE_LETTERS = "abcdefghi"


def circle_centers(card: CardSpec, origin: Point) -> dict[str, Point]:
    """Centres of the 3x3 circle grid, rotated 45 degrees into a diamond.

    Lettered top to bottom, then left to right:

            a
          b   c
        d   e   f
          g   h
            i
    """
    cx = origin[0] + card.size / 2
    cy = origin[1] + card.size / 2
    step = card.grid_spacing / math.sqrt(2)

    centers = []
    for row in (-1, 0, 1):
        for col in (-1, 0, 1):
            centers.append((cx + (col - row) * step, cy - (col + row) * step))
    centers.sort(key=lambda p: (-round(p[1], 6), p[0]))
    return dict(zip(CIRCLE_LETTERS, centers))
