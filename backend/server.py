"""SYMBIOS Evidence OS — Motor Python (FastAPI).

Endpoints (todos prefixados com /api):
  Auth:
    POST   /api/auth/register
    POST   /api/auth/login
    GET    /api/auth/me

  Cases:
    POST   /api/cases
    GET    /api/cases
    GET    /api/cases/{case_id}
    DELETE /api/cases/{case_id}
    POST   /api/cases/{case_id}/upload
    POST   /api/cases/{case_id}/process
    GET    /api/cases/{case_id}/timeline
    GET    /api/cases/{case_id}/flags
    GET    /api/cases/{case_id}/ledger
    GET    /api/cases/{case_id}/files
    GET    /api/cases/{case_id}/report          (markdown)
    POST   /api/cases/{case_id}/analyze         (LLM ad-hoc)
    POST   /api/events/{event_id}/review

  Meta:
    GET    /api/health
    GET    /api/flags/catalog
"""
from fastapi import (
    FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks,
)
from fastapi.responses import PlainTextResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import shutil
import logging
from pathlib import Path
from typing import List

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from models import (  # noqa: E402
    UserCreate, UserLogin, UserPublic, TokenResponse,
    CaseCreate, Case, EvidenceFile, Event, EventReview,
    LedgerEntry, AnalyzeRequest, AnalyzeResponse, ProcessResult,
    PreviewResponse, LedgerSummary,
    utc_now_iso, gen_id,
)
from auth import (  # noqa: E402
    hash_password, verify_password, create_access_token, get_current_user,
)
from symbios.processor import process_case_files, build_dossier_markdown  # noqa: E402
from symbios.flags import flag_metadata  # noqa: E402
from symbios.hash_utils import sha256_file  # noqa: E402
from symbios.parser import classify_file  # noqa: E402
from symbios.hf_client import safe_generate, is_configured as hf_configured  # noqa: E402
from symbios.pdf_render import render_pdf_from_markdown  # noqa: E402
from symbios.webhooks import deliver_webhook  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("symbios")

# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------- Storage ----------
DATA_DIR = Path(os.environ.get("SYMBIOS_DATA_DIR", "/app/backend/cases"))
DATA_DIR.mkdir(parents=True, exist_ok=True)


def case_dir(case_id: str) -> Path:
    return DATA_DIR / case_id


def case_raw_dir(case_id: str) -> Path:
    return case_dir(case_id) / "raw"


def case_reports_dir(case_id: str) -> Path:
    return case_dir(case_id) / "reports"


# ---------- App ----------
app = FastAPI(title="SYMBIOS Evidence OS — Motor", version="0.1.0")
api = APIRouter(prefix="/api")


# ---------- Helpers ----------
async def _get_case_or_404(case_id: str, user_id: str) -> dict:
    doc = await db.cases.find_one({"case_id": case_id, "owner_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Caso não encontrado")
    return doc


# ---------- Health ----------
@api.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "SYMBIOS Evidence OS",
        "version": "0.1.0",
        "hf_configured": hf_configured(),
    }


@api.get("/flags/catalog")
async def get_flag_catalog():
    return {"flags": flag_metadata()}


# ---------- Auth ----------
@api.post("/auth/register", response_model=TokenResponse, status_code=201)
async def register(payload: UserCreate):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    user_id = gen_id("USR")
    user_doc = {
        "id": user_id,
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "created_at": utc_now_iso(),
    }
    await db.users.insert_one(user_doc)
    public = UserPublic(
        id=user_id,
        email=user_doc["email"],
        full_name=user_doc["full_name"],
        created_at=user_doc["created_at"],
    )
    token = create_access_token(user_id, user_doc["email"])
    return TokenResponse(access_token=token, user=public)


@api.post("/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    public = UserPublic(
        id=user["id"],
        email=user["email"],
        full_name=user.get("full_name"),
        created_at=user["created_at"],
    )
    token = create_access_token(user["id"], user["email"])
    return TokenResponse(access_token=token, user=public)


@api.get("/auth/me", response_model=UserPublic)
async def me(current=Depends(get_current_user)):
    user = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return UserPublic(**user)


# ---------- Cases ----------
@api.post("/cases", response_model=Case, status_code=201)
async def create_case(payload: CaseCreate, current=Depends(get_current_user)):
    case = Case(
        owner_id=current["id"],
        title=payload.title,
        description=payload.description or "",
        webhook_url=payload.webhook_url,
    )
    # create dirs
    case_raw_dir(case.case_id).mkdir(parents=True, exist_ok=True)
    case_reports_dir(case.case_id).mkdir(parents=True, exist_ok=True)
    await db.cases.insert_one(case.model_dump())
    return case


@api.get("/cases", response_model=List[Case])
async def list_cases(current=Depends(get_current_user)):
    cursor = db.cases.find({"owner_id": current["id"]}, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(500)
    return [Case(**c) for c in items]


@api.get("/cases/{case_id}", response_model=Case)
async def get_case(case_id: str, current=Depends(get_current_user)):
    doc = await _get_case_or_404(case_id, current["id"])
    return Case(**doc)


@api.delete("/cases/{case_id}", status_code=204)
async def delete_case(case_id: str, current=Depends(get_current_user)):
    await _get_case_or_404(case_id, current["id"])
    await db.cases.delete_one({"case_id": case_id, "owner_id": current["id"]})
    await db.evidence_files.delete_many({"case_id": case_id})
    await db.events.delete_many({"case_id": case_id})
    await db.ledger.delete_many({"case_id": case_id})
    cd = case_dir(case_id)
    if cd.exists():
        shutil.rmtree(cd, ignore_errors=True)


@api.post("/cases/{case_id}/upload", response_model=EvidenceFile)
async def upload_evidence(
    case_id: str,
    file: UploadFile = File(...),
    current=Depends(get_current_user),
):
    await _get_case_or_404(case_id, current["id"])
    raw = case_raw_dir(case_id)
    raw.mkdir(parents=True, exist_ok=True)

    # sanitize filename
    safe_name = Path(file.filename).name
    if not safe_name:
        raise HTTPException(status_code=400, detail="Nome de arquivo inválido")
    target = raw / safe_name

    with target.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    sha = sha256_file(target)
    rec = EvidenceFile(
        case_id=case_id,
        filename=safe_name,
        sha256=sha,
        size_bytes=target.stat().st_size,
        file_type=classify_file(safe_name),
        mime_type=file.content_type,
        upload_status="uploaded",
    )
    await db.evidence_files.insert_one(rec.model_dump())
    await db.cases.update_one(
        {"case_id": case_id},
        {"$inc": {"total_files": 1}, "$set": {"status": "uploaded", "updated_at": utc_now_iso()}},
    )
    return rec


@api.post("/cases/{case_id}/process", response_model=ProcessResult)
async def process_case(
    case_id: str,
    background_tasks: BackgroundTasks,
    current=Depends(get_current_user),
):
    case = await _get_case_or_404(case_id, current["id"])
    raw = case_raw_dir(case_id)
    if not raw.exists() or not any(raw.iterdir()):
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado para este caso")

    await db.cases.update_one(
        {"case_id": case_id}, {"$set": {"status": "processing", "updated_at": utc_now_iso()}}
    )

    result = process_case_files(case_id, raw)

    # Replace existing events / ledger / file records with fresh processed data
    await db.events.delete_many({"case_id": case_id})
    await db.ledger.delete_many({"case_id": case_id})
    # Update file records with sha if missing (and add nested ones)
    existing_filenames = set()
    async for f in db.evidence_files.find({"case_id": case_id}, {"_id": 0, "filename": 1}):
        existing_filenames.add(f["filename"])
    new_file_docs = []
    for f in result["files"]:
        if f["filename"] not in existing_filenames:
            new_file_docs.append(f)
            existing_filenames.add(f["filename"])
    if new_file_docs:
        await db.evidence_files.insert_many(new_file_docs)
    # Update sha + status on existing files
    for f in result["files"]:
        await db.evidence_files.update_one(
            {"case_id": case_id, "filename": f["filename"]},
            {"$set": {"sha256": f["sha256"], "size_bytes": f["size_bytes"],
                      "file_type": f["file_type"], "upload_status": "processed"}},
        )

    if result["events"]:
        await db.events.insert_many(result["events"])
    if result["ledger"]:
        await db.ledger.insert_many(result["ledger"])

    # Build & save dossier
    dossier_md = build_dossier_markdown(case, result, enable_llm=True)
    case_reports_dir(case_id).mkdir(parents=True, exist_ok=True)
    report_path = case_reports_dir(case_id) / "dossie_pericial.md"
    report_path.write_text(dossier_md, encoding="utf-8")

    # Update case
    await db.cases.update_one(
        {"case_id": case_id},
        {"$set": {
            "status": "processed",
            "total_files": len(result["files"]),
            "total_messages": len(result["events"]),
            "total_flags": result["total_flags"],
            "omega_status": result["omega_status"],
            "updated_at": utc_now_iso(),
        }},
    )

    process_result = ProcessResult(
        case_id=case_id,
        status="processed",
        total_files=len(result["files"]),
        total_messages=len(result["events"]),
        total_flags=result["total_flags"],
        omega_status=result["omega_status"],
        timeline_url=f"/api/cases/{case_id}/timeline",
        flags_url=f"/api/cases/{case_id}/flags",
        ledger_url=f"/api/cases/{case_id}/ledger",
        report_url=f"/api/cases/{case_id}/report",
    )

    # Fire webhook (non-blocking)
    webhook_url = case.get("webhook_url")
    if webhook_url:
        background_tasks.add_task(
            deliver_webhook,
            webhook_url,
            {
                "event": "case.processed",
                "case_id": case_id,
                "status": "processed",
                "omega_status": result["omega_status"],
                "totals": {
                    "files": len(result["files"]),
                    "events": len(result["events"]),
                    "flags": result["total_flags"],
                    "ledger": len(result["ledger"]),
                },
                "report_url": f"/api/cases/{case_id}/report",
                "report_pdf_url": f"/api/cases/{case_id}/report.pdf",
                "preview_url": f"/api/cases/{case_id}/preview",
            },
        )

    return process_result


@api.get("/cases/{case_id}/files", response_model=List[EvidenceFile])
async def list_files(case_id: str, current=Depends(get_current_user)):
    await _get_case_or_404(case_id, current["id"])
    docs = await db.evidence_files.find({"case_id": case_id}, {"_id": 0}).to_list(1000)
    return [EvidenceFile(**d) for d in docs]


@api.get("/cases/{case_id}/timeline", response_model=List[Event])
async def get_timeline(case_id: str, current=Depends(get_current_user), limit: int = 1000):
    await _get_case_or_404(case_id, current["id"])
    docs = await db.events.find({"case_id": case_id}, {"_id": 0}).to_list(limit)
    docs.sort(key=lambda e: (e.get("timestamp") is None, e.get("timestamp") or ""))
    return [Event(**d) for d in docs]


@api.get("/cases/{case_id}/flags")
async def get_flags(case_id: str, current=Depends(get_current_user)):
    await _get_case_or_404(case_id, current["id"])
    docs = await db.events.find(
        {"case_id": case_id, "flags": {"$ne": []}},
        {"_id": 0},
    ).to_list(1000)
    counts: dict = {}
    for d in docs:
        for f in d.get("flags", []):
            counts[f] = counts.get(f, 0) + 1
    return {"case_id": case_id, "flag_counts": counts, "events_with_flags": len(docs)}


@api.get("/cases/{case_id}/ledger", response_model=List[LedgerEntry])
async def get_ledger(case_id: str, current=Depends(get_current_user)):
    await _get_case_or_404(case_id, current["id"])
    docs = await db.ledger.find({"case_id": case_id}, {"_id": 0}).to_list(1000)
    return [LedgerEntry(**d) for d in docs]


@api.get("/cases/{case_id}/report", response_class=PlainTextResponse)
async def get_report(case_id: str, current=Depends(get_current_user)):
    await _get_case_or_404(case_id, current["id"])
    report_path = case_reports_dir(case_id) / "dossie_pericial.md"
    if not report_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Dossiê ainda não gerado. Chame POST /api/cases/{case_id}/process primeiro.",
        )
    return PlainTextResponse(report_path.read_text(encoding="utf-8"), media_type="text/markdown")


@api.get("/cases/{case_id}/report.pdf")
async def get_report_pdf(case_id: str, current=Depends(get_current_user)):
    await _get_case_or_404(case_id, current["id"])
    report_path = case_reports_dir(case_id) / "dossie_pericial.md"
    if not report_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Dossiê ainda não gerado. Chame POST /api/cases/{case_id}/process primeiro.",
        )
    md = report_path.read_text(encoding="utf-8")
    pdf_bytes = render_pdf_from_markdown(md)
    if pdf_bytes is None:
        raise HTTPException(status_code=500, detail="Falha ao gerar PDF (verifique WeasyPrint).")
    headers = {"Content-Disposition": f'inline; filename="dossie_{case_id}.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@api.get("/cases/{case_id}/preview", response_model=PreviewResponse)
async def get_preview(case_id: str, current=Depends(get_current_user)):
    """Resumo executivo: Ω-Gate + flags + totais do ledger + breve análise LLM (sem timeline)."""
    case = await _get_case_or_404(case_id, current["id"])

    # Counts
    total_files = await db.evidence_files.count_documents({"case_id": case_id})
    total_events = await db.events.count_documents({"case_id": case_id})

    # Flags top
    flag_counts: dict = {}
    async for ev in db.events.find(
        {"case_id": case_id, "flags": {"$ne": []}}, {"_id": 0, "flags": 1}
    ):
        for f in ev.get("flags", []):
            flag_counts[f] = flag_counts.get(f, 0) + 1
    flag_top = dict(sorted(flag_counts.items(), key=lambda kv: -kv[1])[:8])

    # Ledger summary
    ledger_docs = await db.ledger.find({"case_id": case_id}, {"_id": 0}).to_list(2000)
    summary = LedgerSummary(entries_count=len(ledger_docs))
    for L in ledger_docs:
        amount = float(L.get("amount") or 0)
        currency = L.get("currency", "BRL")
        direction = L.get("direction", "unknown")
        if L.get("omega_status") == "BLOCKED":
            summary.blocked_count += 1
        if currency == "USD":
            if direction == "in":
                summary.total_in_usd += amount
            elif direction == "out":
                summary.total_out_usd += amount
        else:
            if direction == "in":
                summary.total_in_brl += amount
            elif direction == "out":
                summary.total_out_brl += amount
            else:
                summary.total_unknown_brl += amount

    # Executive summary via LLM (best-effort)
    exec_summary = ""
    has_llm = False
    if hf_configured() and total_events > 0:
        sample = await db.events.find({"case_id": case_id}, {"_id": 0}).to_list(20)
        bullets = "\n".join(
            f"- [{e.get('timestamp') or 's/data'}] {e.get('author') or '?'}: "
            f"{(e.get('message') or '')[:160]}"
            for e in sample
        )
        prompt = (
            "Em 4 a 6 linhas, em português, produza um veredito executivo do caso "
            "para um bot de mensagem (WhatsApp/Telegram). Inclua: principal risco, "
            "valores envolvidos se houver, e recomendação imediata. Sem floreios.\n\n"
            f"Eventos:\n{bullets}\n\n"
            f"Flags top: {flag_top}\n"
            f"Ω-Gate: {case.get('omega_status')}"
        )
        result = safe_generate(prompt, max_tokens=220, temperature=0.3)
        if result:
            exec_summary = result
            has_llm = True

    return PreviewResponse(
        case_id=case_id,
        title=case.get("title", ""),
        status=case.get("status", "unknown"),
        omega_status=case.get("omega_status", "PENDING"),
        totals={
            "files": total_files,
            "events": total_events,
            "flags": int(case.get("total_flags") or 0),
            "ledger": len(ledger_docs),
        },
        flag_top=flag_top,
        ledger_summary=summary,
        executive_summary=exec_summary,
        has_llm_summary=has_llm,
    )


@api.post("/cases/{case_id}/analyze", response_model=AnalyzeResponse)
async def analyze_case(
    case_id: str,
    payload: AnalyzeRequest,
    current=Depends(get_current_user),
):
    await _get_case_or_404(case_id, current["id"])
    if not hf_configured():
        raise HTTPException(
            status_code=400,
            detail="HF_TOKEN não configurado em /app/backend/.env. Defina e reinicie o backend.",
        )
    events = await db.events.find({"case_id": case_id}, {"_id": 0}).to_list(200)
    if not events and not payload.prompt:
        raise HTTPException(status_code=400, detail="Sem eventos e sem prompt — nada a analisar")

    if payload.prompt:
        prompt = payload.prompt
    else:
        bullets = "\n".join(
            f"- [{e.get('timestamp') or 's/data'}] {e.get('author') or '?'}: "
            f"{(e.get('message') or '')[:200]}"
            for e in events[:30]
        )
        prompt = (
            "Você é perito forense. Faça análise objetiva (PT-BR) dos eventos abaixo.\n"
            "Inclua: resumo, contradições, lacunas, próximos passos.\n\n" + bullets
        )
    text = safe_generate(prompt, max_tokens=payload.max_tokens, temperature=payload.temperature)
    if text is None:
        raise HTTPException(status_code=502, detail="HuggingFace API falhou. Verifique HF_TOKEN e modelo.")
    return AnalyzeResponse(case_id=case_id, analysis=text, model=os.environ.get("HF_TEXT_MODEL", ""))


@api.post("/events/{event_id}/review", response_model=Event)
async def review_event(
    event_id: str,
    payload: EventReview,
    current=Depends(get_current_user),
):
    if payload.review_status not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="review_status deve ser 'accepted' ou 'rejected'")
    ev = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    # check ownership via case
    case = await db.cases.find_one(
        {"case_id": ev["case_id"], "owner_id": current["id"]}, {"_id": 0}
    )
    if not case:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    update = {"review_status": payload.review_status}
    if payload.note:
        ev_meta = ev.get("metadata") or {}
        ev_meta["review_note"] = payload.note
        update["metadata"] = ev_meta
    await db.events.update_one({"event_id": event_id}, {"$set": update})
    ev.update(update)
    return Event(**ev)


# ---------- Mount ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
