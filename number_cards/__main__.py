"""Generate the deck: python -m number_cards [output_dir]"""

import sys
from pathlib import Path

from .cards import DECK
from .geometry import CardSpec, PageSpec
from .pdf import write_pdf


def main() -> None:
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("output")
    out_dir.mkdir(parents=True, exist_ok=True)

    pdf_path = out_dir / "cards.pdf"
    write_pdf(pdf_path, PageSpec(), CardSpec(), DECK)
    print(f"Wrote {pdf_path} ({len(DECK)} cards)")


if __name__ == "__main__":
    main()
