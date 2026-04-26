"""PDF text extraction via pdfplumber."""
from pathlib import Path
from typing import Optional


def extract_pdf_text(path: Path) -> Optional[str]:
    """Extract all text from a PDF file. Returns None on failure."""
    try:
        import pdfplumber
    except ImportError:
        return None
    try:
        chunks = []
        with pdfplumber.open(str(path)) as pdf:
            for page in pdf.pages:
                txt = page.extract_text() or ""
                if txt:
                    chunks.append(txt)
        text = "\n\n".join(chunks).strip()
        return text or None
    except Exception:
        return None
