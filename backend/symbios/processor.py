"""SYMBIOS processor orchestrator.

Coordinates: hash → parser → OCR → STT → flags → Ω-Gate → ledger → LLM → dossier.
"""
import logging
from pathlib import Path
from typing import Dict, List, Tuple
from collections import Counter

from .hash_utils import sha256_file
from .parser import parse_whatsapp_txt, extract_zip, classify_file
from .ocr import ocr_image
from .hf_client import safe_transcribe, safe_generate, is_configured
from .flags import detect_flags
from .omega_gate import check_event, check_case
from .ledger import extract_ledger
from .dossier import generate_dossier
from .models_helpers import gen_id

logger = logging.getLogger(__name__)


def _process_file(
    case_id: str,
    file_path: Path,
    parent_file_id: str = None,
    parent_sha: str = None,
) -> Tuple[List[Dict], List[Dict]]:
    """Process a single evidence file. Returns (file_records, events)."""
    file_records: List[Dict] = []
    events: List[Dict] = []

    file_type = classify_file(file_path.name)
    sha = sha256_file(file_path)
    rec = {
        "file_id": parent_file_id or gen_id("FILE"),
        "case_id": case_id,
        "filename": file_path.name,
        "sha256": sha,
        "size_bytes": file_path.stat().st_size,
        "file_type": file_type,
        "upload_status": "processed",
    }
    file_records.append(rec)

    if file_type == "zip":
        # extract and recurse
        out_dir = file_path.parent / f"{file_path.stem}_extracted"
        try:
            extracted = extract_zip(file_path, out_dir)
            for ex in extracted:
                sub_files, sub_events = _process_file(case_id, ex)
                file_records.extend(sub_files)
                events.extend(sub_events)
        except Exception as e:
            logger.warning(f"Falha extraindo ZIP {file_path.name}: {e}")
            rec["upload_status"] = "failed"

    elif file_type == "txt":
        try:
            text = file_path.read_text(encoding="utf-8", errors="replace")
            parsed = parse_whatsapp_txt(text)
            for p in parsed:
                ev = {
                    "event_id": gen_id("EVT"),
                    "case_id": case_id,
                    "timestamp": p.get("timestamp"),
                    "raw_timestamp": p.get("raw_timestamp"),
                    "author": p.get("author"),
                    "message": p.get("message", ""),
                    "source": "whatsapp",
                    "source_file_id": rec["file_id"],
                    "source_sha256": sha,
                    "flags": detect_flags(p.get("message", "")),
                    "review_status": "unreviewed",
                    "metadata": {},
                }
                status, missing = check_event(ev)
                ev["omega_status"] = status
                ev["metadata"]["missing_fields"] = missing
                events.append(ev)
        except Exception as e:
            logger.warning(f"Falha parseando TXT {file_path.name}: {e}")

    elif file_type == "image":
        text = ocr_image(file_path)
        if text:
            ev = {
                "event_id": gen_id("EVT"),
                "case_id": case_id,
                "timestamp": None,
                "raw_timestamp": None,
                "author": None,
                "message": text,
                "source": "image",
                "source_file_id": rec["file_id"],
                "source_sha256": sha,
                "flags": detect_flags(text),
                "review_status": "unreviewed",
                "metadata": {"ocr": True},
            }
            status, missing = check_event(ev)
            ev["omega_status"] = status
            ev["metadata"]["missing_fields"] = missing
            events.append(ev)

    elif file_type == "audio":
        if is_configured():
            text = safe_transcribe(file_path)
            if text:
                ev = {
                    "event_id": gen_id("EVT"),
                    "case_id": case_id,
                    "timestamp": None,
                    "raw_timestamp": None,
                    "author": None,
                    "message": text,
                    "source": "audio",
                    "source_file_id": rec["file_id"],
                    "source_sha256": sha,
                    "flags": detect_flags(text),
                    "review_status": "unreviewed",
                    "metadata": {"stt": True},
                }
                status, missing = check_event(ev)
                ev["omega_status"] = status
                ev["metadata"]["missing_fields"] = missing
                events.append(ev)
        else:
            logger.info(f"STT pulado (HF_TOKEN ausente) — {file_path.name}")

    return file_records, events


def process_case_files(case_id: str, raw_dir: Path) -> Dict:
    """Process all files in raw_dir for a case. Returns aggregated result."""
    all_files: List[Dict] = []
    all_events: List[Dict] = []

    for child in sorted(raw_dir.iterdir()):
        if child.is_file():
            recs, evs = _process_file(case_id, child)
            all_files.extend(recs)
            all_events.extend(evs)

    # Sort events chronologically (None timestamps last)
    all_events.sort(key=lambda e: (e.get("timestamp") is None, e.get("timestamp") or ""))

    # Flag stats
    flag_counter: Counter = Counter()
    for ev in all_events:
        for f in ev.get("flags", []):
            flag_counter[f] += 1

    # Ledger
    ledger = extract_ledger(all_events, case_id)

    # Case-level Ω-Gate
    omega_status, omega_issues = check_case(all_events, all_files)

    return {
        "files": all_files,
        "events": all_events,
        "ledger": ledger,
        "flag_counts": dict(flag_counter),
        "total_flags": sum(flag_counter.values()),
        "omega_status": omega_status,
        "omega_issues": omega_issues,
    }


def build_dossier_markdown(
    case: Dict,
    processed: Dict,
    enable_llm: bool = True,
) -> str:
    """Generate the markdown dossier, optionally enriched with LLM analysis."""
    llm_text = ""
    if enable_llm and is_configured() and processed["events"]:
        # Build a compact prompt
        sample = processed["events"][:30]
        bullets = "\n".join(
            f"- [{e.get('timestamp') or 's/data'}] {e.get('author') or 'desconhecido'}: "
            f"{(e.get('message') or '')[:200]}"
            for e in sample
        )
        prompt = (
            "Você é perito forense conversacional. Analise os eventos abaixo "
            "e produza em português: (1) resumo objetivo do caso; "
            "(2) possíveis contradições; (3) lacunas que comprometem a prova; "
            "(4) próximos passos recomendados. Não invente fatos. Se faltar dado, diga claramente.\n\n"
            f"EVENTOS (amostra):\n{bullets}\n\n"
            f"FLAGS DETECTADAS: {processed['flag_counts']}\n"
            f"Ω-GATE: {processed['omega_status']} (issues={processed['omega_issues']})"
        )
        result = safe_generate(prompt, max_tokens=700, temperature=0.3)
        if result:
            llm_text = result

    enriched_case = {
        **case,
        "total_files": len(processed["files"]),
        "total_messages": len(processed["events"]),
        "total_flags": processed["total_flags"],
    }

    return generate_dossier(
        case=enriched_case,
        files=processed["files"],
        events=processed["events"],
        flags_summary=processed["flag_counts"],
        ledger=processed["ledger"],
        omega_case_status=processed["omega_status"],
        omega_case_issues=processed["omega_issues"],
        llm_analysis=llm_text,
    )
