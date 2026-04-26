"""OCR via Tesseract for image evidence."""
from pathlib import Path
from typing import Optional


def ocr_image(path: Path, lang: str = "por+eng") -> Optional[str]:
    """Run OCR on an image. Returns extracted text or None on failure."""
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        return None

    try:
        with Image.open(path) as img:
            text = pytesseract.image_to_string(img, lang=lang)
            return text.strip() or None
    except Exception:
        return None
