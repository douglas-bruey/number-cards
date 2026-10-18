"""The deck: which circles are filled in on each card.

Circles that are not filled in are cut out. A card's name starts with the
number of filled circles, followed by a variant number.
"""

from .geometry import CIRCLE_LETTERS

DECK: dict[str, str] = {
    "0": "",
    "1.1": "e",
    "1.2": "a",
    "2.1": "bc",
    "2.2": "ai",
    "3.1": "egh",
    "3.2": "adf",
    "3.3": "abc",
    "4.1": "abce",
    "4.2": "adfi",
    "4.3": "bcgh",
    "5.1": "bcegh",
    "6.1": "abcegh",
    "7.1": "abceghi",
    "8.1": "abcdefgh",
    "8.2": "abcdfghi",
    "9.1": "abcdefghi",
}

for _name, _filled in DECK.items():
    if (
        len(_filled) != int(_name.split(".")[0])
        or len(set(_filled)) != len(_filled)
        or not set(_filled) <= set(CIRCLE_LETTERS)
    ):
        raise ValueError(f"Card {_name} has invalid filled circles {_filled!r}")
