"""Pydantic models for SYMBIOS Evidence OS."""
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


# ---------- Auth ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ---------- Cases ----------
class CaseCreate(BaseModel):
    title: str
    description: Optional[str] = ""


class Case(BaseModel):
    model_config = ConfigDict(extra="ignore")
    case_id: str = Field(default_factory=lambda: gen_id("CASE"))
    owner_id: str
    title: str
    description: str = ""
    status: str = "created"  # created | uploaded | processing | processed | sealed
    total_files: int = 0
    total_messages: int = 0
    total_flags: int = 0
    omega_status: str = "PENDING"  # PENDING | OK | BLOCKED
    created_at: str = Field(default_factory=utc_now_iso)
    updated_at: str = Field(default_factory=utc_now_iso)


# ---------- Evidence ----------
class EvidenceFile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    file_id: str = Field(default_factory=lambda: gen_id("FILE"))
    case_id: str
    filename: str
    sha256: str
    size_bytes: int
    file_type: str  # txt | zip | image | audio | other
    mime_type: Optional[str] = None
    upload_status: str = "uploaded"  # uploaded | processed | failed
    uploaded_at: str = Field(default_factory=utc_now_iso)
    notes: Optional[str] = None


# ---------- Events / Timeline ----------
class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event_id: str = Field(default_factory=lambda: gen_id("EVT"))
    case_id: str
    timestamp: Optional[str] = None  # ISO 8601
    raw_timestamp: Optional[str] = None
    author: Optional[str] = None
    message: str = ""
    source: str = "whatsapp"  # whatsapp | image | audio | manual
    source_file_id: Optional[str] = None
    source_sha256: Optional[str] = None
    flags: List[str] = Field(default_factory=list)
    omega_status: str = "PENDING"  # PENDING | OK | BLOCKED
    review_status: str = "unreviewed"  # unreviewed | accepted | rejected
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EventReview(BaseModel):
    review_status: str  # accepted | rejected
    note: Optional[str] = None


# ---------- Ledger ----------
class LedgerEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    entry_id: str = Field(default_factory=lambda: gen_id("LED"))
    case_id: str
    timestamp: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "BRL"
    description: str = ""
    direction: str = "unknown"  # in | out | unknown
    source_event_id: Optional[str] = None
    omega_status: str = "PENDING"
    missing_fields: List[str] = Field(default_factory=list)


# ---------- LLM analysis ----------
class AnalyzeRequest(BaseModel):
    prompt: Optional[str] = None
    max_tokens: int = 600
    temperature: float = 0.4


class AnalyzeResponse(BaseModel):
    case_id: str
    analysis: str
    model: str


# ---------- Process result ----------
class ProcessResult(BaseModel):
    case_id: str
    status: str
    total_files: int
    total_messages: int
    total_flags: int
    omega_status: str
    timeline_url: str
    flags_url: str
    ledger_url: str
    report_url: str
