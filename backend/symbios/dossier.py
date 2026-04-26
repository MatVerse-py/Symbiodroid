"""Markdown dossier generator."""
from typing import Dict, List
from datetime import datetime, timezone


def generate_dossier(
    case: Dict,
    files: List[Dict],
    events: List[Dict],
    flags_summary: Dict[str, int],
    ledger: List[Dict],
    omega_case_status: str,
    omega_case_issues: List[str],
    llm_analysis: str = "",
) -> str:
    """Build a Markdown dossier (dossiê pericial) for the case."""
    now = datetime.now(timezone.utc).isoformat()
    lines: List[str] = []
    lines.append(f"# Dossiê Pericial — {case.get('title', case.get('case_id'))}")
    lines.append("")
    lines.append(f"- **case_id**: `{case.get('case_id')}`")
    lines.append(f"- **gerado_em**: {now}")
    lines.append(f"- **status_caso**: {case.get('status')}")
    lines.append(f"- **Ω-Gate**: **{omega_case_status}**")
    if omega_case_issues:
        lines.append(f"  - issues: {', '.join(omega_case_issues)}")
    lines.append("")

    # Files / chain of custody
    lines.append("## 1. Cadeia de Custódia")
    lines.append("")
    lines.append("| filename | tipo | tamanho | sha256 |")
    lines.append("|---|---|---|---|")
    for f in files:
        lines.append(
            f"| `{f.get('filename')}` | {f.get('file_type')} | {f.get('size_bytes')} B | `{f.get('sha256')}` |"
        )
    lines.append("")

    # Stats
    lines.append("## 2. Sumário Quantitativo")
    lines.append("")
    lines.append(f"- Total de arquivos: **{case.get('total_files', len(files))}**")
    lines.append(f"- Total de eventos extraídos: **{case.get('total_messages', len(events))}**")
    lines.append(f"- Total de flags neycsec01: **{case.get('total_flags', 0)}**")
    lines.append("")

    # Flags breakdown
    lines.append("## 3. Flags neycsec01")
    lines.append("")
    if flags_summary:
        for flag_id, count in sorted(flags_summary.items(), key=lambda x: -x[1]):
            lines.append(f"- `{flag_id}`: {count} ocorrência(s)")
    else:
        lines.append("- Nenhuma flag detectada.")
    lines.append("")

    # Timeline (top 50)
    lines.append("## 4. Timeline (primeiros 50 eventos)")
    lines.append("")
    for e in events[:50]:
        ts = e.get("timestamp") or e.get("raw_timestamp") or "—"
        author = e.get("author") or "—"
        msg = (e.get("message") or "").replace("\n", " ")
        if len(msg) > 200:
            msg = msg[:200] + "…"
        flags = ", ".join(e.get("flags", [])) or "—"
        omega = e.get("omega_status", "—")
        lines.append(f"- **{ts}** · `{author}` · Ω={omega} · flags=[{flags}]")
        lines.append(f"  > {msg}")
    if len(events) > 50:
        lines.append("")
        lines.append(f"_(+{len(events) - 50} eventos omitidos no resumo)_")
    lines.append("")

    # Ledger
    lines.append("## 5. Ledger Financeiro")
    lines.append("")
    if ledger:
        lines.append("| timestamp | valor | moeda | direção | Ω | descrição |")
        lines.append("|---|---|---|---|---|---|")
        for L in ledger[:100]:
            desc = (L.get("description") or "").replace("|", " ").replace("\n", " ")
            if len(desc) > 80:
                desc = desc[:80] + "…"
            lines.append(
                f"| {L.get('timestamp') or '—'} | {L.get('amount')} | {L.get('currency')} | "
                f"{L.get('direction')} | {L.get('omega_status')} | {desc} |"
            )
    else:
        lines.append("- Nenhuma referência financeira identificada.")
    lines.append("")

    # LLM analysis
    if llm_analysis:
        lines.append("## 6. Análise Inteligente (HuggingFace / Mistral-7B)")
        lines.append("")
        lines.append(llm_analysis)
        lines.append("")

    lines.append("---")
    lines.append("_Documento gerado automaticamente pelo SYMBIOS Evidence OS. Não substitui parecer humano._")

    return "\n".join(lines)
