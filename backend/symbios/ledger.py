"""Financial ledger extractor from event messages.

Detects monetary references and tries to associate them with periods,
descriptions, and event IDs. Then runs Ω-Gate to mark BLOCKED entries.
"""
import re
from typing import List, Dict
from .omega_gate import check_ledger_entry
from .models_helpers import gen_id


# R$ 1.234,56 / R$1234 / US$ 100 / 100 reais / 200 dolares
# Prefer longer matches (with thousand separators) before falling back to plain digits.
MONEY_PATTERNS = [
    re.compile(r"R\$\s?(?P<num>\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:,\d{2})?)", re.IGNORECASE),
    re.compile(r"US\$\s?(?P<num>\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{1,2})?)", re.IGNORECASE),
    re.compile(r"(?P<num>\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{1,2})?)\s*(reais|d[óo]lares|euros)", re.IGNORECASE),
]

DIRECTION_HINTS_OUT = re.compile(r"\b(pagar|paguei|enviar|enviei|transferi|deposit(o|ei)|pix para)\b", re.IGNORECASE)
DIRECTION_HINTS_IN = re.compile(r"\b(receber|recebi|me pag(a|ou)|caiu|entr(ou|ada))\b", re.IGNORECASE)


def _to_float(num: str) -> float:
    s = num.strip()
    # If both . and , exist → assume , is decimal (BR), . is thousand
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def extract_ledger(events: List[Dict], case_id: str) -> List[Dict]:
    """Extract ledger entries from event messages."""
    entries: List[Dict] = []
    for ev in events:
        msg = ev.get("message", "") or ""
        if not msg:
            continue
        for pat in MONEY_PATTERNS:
            for m in pat.finditer(msg):
                num = m.group("num")
                amount = _to_float(num)
                if amount <= 0:
                    continue
                direction = "unknown"
                if DIRECTION_HINTS_OUT.search(msg):
                    direction = "out"
                elif DIRECTION_HINTS_IN.search(msg):
                    direction = "in"
                entry = {
                    "entry_id": gen_id("LED"),
                    "case_id": case_id,
                    "timestamp": ev.get("timestamp"),
                    "amount": amount,
                    "currency": "USD" if "US$" in m.group(0) or "dol" in m.group(0).lower() else "BRL",
                    "description": msg[:200],
                    "direction": direction,
                    "source_event_id": ev.get("event_id"),
                }
                status, missing = check_ledger_entry(entry)
                entry["omega_status"] = status
                entry["missing_fields"] = missing
                entries.append(entry)
    return entries
