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

# Fill colour of every filled circle on a card, keyed by how many circles
# are filled. Card 0 has no filled circles, so it needs no colour.
NUMBER_COLORS: dict[int, str] = {
    1: "#000000",
    2: "#1071e5",
    3: "#00c2a8",
    4: "#82755b",
    5: "#ffe342",
    6: "#cc4e00",
    7: "#d916a8",
    8: "#e81313",
    9: "#635dff",
}

for _name, _filled in DECK.items():
    if (
        len(_filled) != int(_name.split(".")[0])
        or len(set(_filled)) != len(_filled)
        or not set(_filled) <= set(CIRCLE_LETTERS)
    ):
        raise ValueError(f"Card {_name} has invalid filled circles {_filled!r}")
