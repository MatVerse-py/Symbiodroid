"""WhatsApp TXT parser + ZIP extractor.

Handles common WhatsApp export formats (Android/iOS, multiple locales).
"""
import re
import zipfile
from pathlib import Path
from typing import List, Dict, Optional, Iterator
from datetime import datetime


# Patterns for WhatsApp message lines.
# Examples:
#   12/05/2024 14:23 - Joao: mensagem
#   [12/05/2024, 14:23:45] Joao: mensagem
#   12/05/24, 14:23 - Joao: mensagem
PATTERNS = [
    re.compile(
        r"^\[?(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[APap][Mm])?\]?\s*[-\u2013]?\s*(?P<author>[^:]+?):\s*(?P<message>.*)$"
    ),
]

DATE_FORMATS = [
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%d/%m/%y %H:%M:%S",
    "%d/%m/%y %H:%M",
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M",
    "%m/%d/%y %H:%M",
    "%d.%m.%Y %H:%M",
    "%d-%m-%Y %H:%M",
]


def _parse_dt(date_str: str, time_str: str) -> Optional[str]:
    combined = f"{date_str} {time_str}"
    for fmt in DATE_FORMATS:
        try:
            dt = datetime.strptime(combined, fmt)
            return dt.isoformat()
        except ValueError:
            continue
    return None


def parse_whatsapp_txt(text: str) -> List[Dict]:
    """Parse WhatsApp chat export text. Returns list of message dicts.

    Multi-line messages are concatenated to the previous one.
    """
    messages: List[Dict] = []
    current: Optional[Dict] = None

    for line in text.splitlines():
        matched = False
        for pat in PATTERNS:
            m = pat.match(line)
            if m:
                if current:
                    messages.append(current)
                date_str = m.group(1)
                time_str = m.group(2)
                ts_iso = _parse_dt(date_str, time_str)
                current = {
                    "raw_timestamp": f"{date_str} {time_str}",
                    "timestamp": ts_iso,
                    "author": m.group("author").strip(),
                    "message": m.group("message").strip(),
                }
                matched = True
                break
        if not matched and current is not None:
            # continuation of previous message
            current["message"] = (current["message"] + "\n" + line).strip()

    if current:
        messages.append(current)

    return messages


def extract_zip(zip_path: Path, dest_dir: Path) -> List[Path]:
    """Extract a ZIP file safely. Returns list of extracted file paths."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    extracted: List[Path] = []
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.infolist():
            # prevent zip-slip
            target = dest_dir / Path(member.filename).name
            if member.is_dir():
                continue
            with zf.open(member) as src, target.open("wb") as out:
                out.write(src.read())
            extracted.append(target)
    return extracted


def classify_file(filename: str) -> str:
    """Classify file by extension."""
    name = filename.lower()
    if name.endswith(".txt"):
        return "txt"
    if name.endswith(".zip"):
        return "zip"
    if name.endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff")):
        return "image"
    if name.endswith((".mp3", ".wav", ".ogg", ".m4a", ".opus", ".aac", ".flac")):
        return "audio"
    if name.endswith((".pdf",)):
        return "pdf"
    return "other"
