"""Generate a sample page: python -m number_cards [output_dir]"""

import sys
from pathlib import Path

from .geometry import CardSpec, PageSpec, card_origins
from .pdf import write_pdf


def main() -> None:
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("output")
    out_dir.mkdir(parents=True, exist_ok=True)

    page = PageSpec()
    card = CardSpec()

    pdf_path = out_dir / "cards.pdf"
    write_pdf(pdf_path, page, card, card_origins(page, card))
    print(f"Wrote {pdf_path}")


if __name__ == "__main__":
    main()
