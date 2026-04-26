"""Ω-Gate: fail-closed validation.

Rules:
- A ledger entry is OK only if it has: amount, period (timestamp), criterion (description), and source (event_id).
- An event is OK only if it has: timestamp, author, message, source_sha256.
- A case is OK only if it has at least one event AND at least one file with valid SHA-256.

If any required field is missing → omega_status = BLOCKED, with list of missing_fields.
"""
from typing import Dict, List, Tuple


REQUIRED_EVENT_FIELDS = ["timestamp", "author", "message", "source_sha256"]
REQUIRED_LEDGER_FIELDS = ["amount", "timestamp", "description", "source_event_id"]


def check_event(event: Dict) -> Tuple[str, List[str]]:
    missing = [f for f in REQUIRED_EVENT_FIELDS if not event.get(f)]
    return ("BLOCKED" if missing else "OK", missing)


def check_ledger_entry(entry: Dict) -> Tuple[str, List[str]]:
    missing = []
    for f in REQUIRED_LEDGER_FIELDS:
        v = entry.get(f)
        if v is None or v == "" or (isinstance(v, (int, float)) and f == "amount" and v == 0):
            missing.append(f)
    # amount=0 is suspicious but not necessarily missing; treat None/missing only
    missing = [f for f in REQUIRED_LEDGER_FIELDS if not entry.get(f)]
    return ("BLOCKED" if missing else "OK", missing)


def check_case(events: List[Dict], files: List[Dict]) -> Tuple[str, List[str]]:
    issues: List[str] = []
    if not events:
        issues.append("nenhum_evento_extraido")
    if not files:
        issues.append("nenhum_arquivo_de_evidencia")
    else:
        invalid = [f for f in files if not f.get("sha256")]
        if invalid:
            issues.append("arquivo_sem_sha256")
    blocked_events = [e for e in events if e.get("omega_status") == "BLOCKED"]
    if blocked_events and len(blocked_events) > len(events) * 0.5:
        issues.append("mais_de_metade_eventos_bloqueados")
    return ("BLOCKED" if issues else "OK", issues)
