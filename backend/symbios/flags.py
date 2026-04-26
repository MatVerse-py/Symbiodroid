"""neycsec01 flag detector.

Each flag has an ID, regex pattern, severity, and description.
Detection runs over message text (case-insensitive).
"""
import re
from typing import List, Dict


FLAG_DEFS: List[Dict] = [
    # Coercion / threats
    {
        "id": "neycsec01.coercion",
        "pattern": r"\b(amea[çc]o|amea[çc]a|ou eu|n[ãa]o conta|cala a boca|vai se arrepender|destruir|acabar com voc[êe])\b",
        "severity": "high",
        "description": "Indício de coação ou ameaça verbal",
    },
    # Financial promise / debt
    {
        "id": "neycsec01.financial",
        "pattern": r"(R\$\s?\d|US\$\s?\d|\bd[ií]vida\b|\bempr[ée]stimo\b|\bpix\b|\btransfer[êe]ncia\b|\bdep[óo]sito\b|\bpagamento\b)",
        "severity": "medium",
        "description": "Menção financeira (valor, dívida, transferência)",
    },
    # Sexual / intimate
    {
        "id": "neycsec01.intimate",
        "pattern": r"\b(nudes?|foto[s]? [íi]ntima|sex[ou]|cama|encontro [íi]ntimo)\b",
        "severity": "high",
        "description": "Conteúdo de natureza íntima",
    },
    # Location / meeting
    {
        "id": "neycsec01.meeting",
        "pattern": r"\b(encontr(ar|o)|nos vemos|me esperar?|endere[çc]o|hot[ée]l|motel)\b",
        "severity": "medium",
        "description": "Combinação de encontro presencial",
    },
    # Identity / credentials
    {
        "id": "neycsec01.credentials",
        "pattern": r"\b(senha|cpf|rg|cart[ãa]o|c[óo]digo de seguran[çc]a|cvv|token)\b",
        "severity": "high",
        "description": "Compartilhamento de credenciais ou dados sensíveis",
    },
    # Erasure / deletion
    {
        "id": "neycsec01.erasure",
        "pattern": r"\b(apaga|apagar|deleta|exclu[ií]r? (a |as |o |os )?mensagens?|some essa conversa|n[ãa]o pode aparecer)\b",
        "severity": "high",
        "description": "Pedido de apagamento ou ocultação",
    },
    # Minor / age concern
    {
        "id": "neycsec01.minor",
        "pattern": r"\b(menor de idade|crian[çc]a|adolescente|tem \d{1,2} anos)\b",
        "severity": "high",
        "description": "Menção a menor de idade",
    },
    # Substances
    {
        "id": "neycsec01.substance",
        "pattern": r"\b(droga|coca[ií]na|maconha|[êe]cstasy|rem[ée]dio controlado|[áa]lcool em excesso)\b",
        "severity": "medium",
        "description": "Menção a substâncias controladas",
    },
]

_COMPILED = [(d, re.compile(d["pattern"], re.IGNORECASE)) for d in FLAG_DEFS]


def detect_flags(text: str) -> List[str]:
    """Return list of flag IDs that match the given text."""
    if not text:
        return []
    found = []
    for definition, regex in _COMPILED:
        if regex.search(text):
            found.append(definition["id"])
    return found


def flag_metadata() -> List[Dict]:
    """Return public metadata of all flag definitions."""
    return [
        {
            "id": d["id"],
            "severity": d["severity"],
            "description": d["description"],
        }
        for d in FLAG_DEFS
    ]
