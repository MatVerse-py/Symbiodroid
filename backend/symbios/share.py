"""Public share tokens for sealed cases.

Workflow:
  POST /api/cases/{case_id}/share        → owner creates a temporary token
  GET  /api/share/{token}                → public download of seal.pdf
  GET  /api/cases/{case_id}/shares       → owner lists shares
  DELETE /api/cases/{case_id}/share/{share_id} → owner revokes a share

Rules:
- Only sealed cases can be shared.
- Tokens are JWT signed with SHARE_JWT_SECRET (separate from auth JWT).
- Tokens have short TTL (default 72h, max 30 days enforced).
- Each access is logged (timestamp, IP, user-agent) and access_count incremented.
- Revoked or expired tokens return 410 Gone.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
import jwt
from fastapi import HTTPException


SHARE_JWT_SECRET = os.environ.get("SHARE_JWT_SECRET", "")
SHARE_ALGORITHM = "HS256"
DEFAULT_TTL_HOURS = int(os.environ.get("SHARE_DEFAULT_TTL_HOURS", "72"))
MAX_TTL_HOURS = int(os.environ.get("SHARE_MAX_TTL_HOURS", "720"))  # 30 days
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")


def gen_share_id() -> str:
    return f"SHARE-{uuid.uuid4().hex[:12]}"


def create_share_token(
    share_id: str,
    case_id: str,
    ttl_hours: int = DEFAULT_TTL_HOURS,
) -> Tuple[str, datetime]:
    """Create a signed JWT and return (token, expires_at)."""
    if not SHARE_JWT_SECRET:
        raise HTTPException(status_code=500, detail="SHARE_JWT_SECRET não configurado")
    if ttl_hours < 1:
        raise HTTPException(status_code=400, detail="ttl_hours deve ser >= 1")
    if ttl_hours > MAX_TTL_HOURS:
        raise HTTPException(
            status_code=400, detail=f"ttl_hours acima do máximo ({MAX_TTL_HOURS}h)"
        )
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=ttl_hours)
    payload = {
        "sub": share_id,
        "case_id": case_id,
        "resource": "seal.pdf",
        "typ": "share",
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, SHARE_JWT_SECRET, algorithm=SHARE_ALGORITHM)
    return token, expires_at


def decode_share_token(token: str) -> dict:
    """Decode & validate a share JWT. Raises HTTPException on failure."""
    if not SHARE_JWT_SECRET:
        raise HTTPException(status_code=500, detail="SHARE_JWT_SECRET não configurado")
    try:
        payload = jwt.decode(token, SHARE_JWT_SECRET, algorithms=[SHARE_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=410, detail="Link expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Token inválido")
    if payload.get("typ") != "share":
        raise HTTPException(status_code=400, detail="Tipo de token inválido")
    return payload


def build_share_url(token: str) -> str:
    base = PUBLIC_BASE_URL or ""
    return f"{base}/api/share/{token}" if base else f"/api/share/{token}"
