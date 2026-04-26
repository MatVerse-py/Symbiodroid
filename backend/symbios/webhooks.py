"""HMAC-signed webhook delivery (fire-and-forget)."""
import hmac
import hashlib
import json
import logging
import os
import asyncio
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")


def _canonical_body(payload: dict) -> bytes:
    """Serialize JSON deterministically: sorted keys, no spaces, UTF-8."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode(
        "utf-8"
    )


def sign_payload(body: bytes, secret: str = None) -> str:
    """Compute HMAC-SHA256 of the body. Returns hex digest."""
    s = (secret or WEBHOOK_SECRET or "").encode("utf-8")
    return hmac.new(s, body, hashlib.sha256).hexdigest()


def verify_signature(body: bytes, signature_header: str, secret: str = None) -> bool:
    """Verify a received X-Symbios-Signature header (sha256=<hex>)."""
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = sign_payload(body, secret)
    received = signature_header.split("=", 1)[1].strip()
    return hmac.compare_digest(expected, received)


async def deliver_webhook(url: Optional[str], payload: dict, timeout: float = 10.0) -> None:
    """Best-effort POST with HMAC signature. Logs failures, never raises."""
    if not url:
        return
    try:
        import httpx
    except ImportError:
        logger.warning("httpx não instalado; webhook ignorado")
        return

    body = _canonical_body(payload)
    signature = sign_payload(body)
    timestamp = datetime.now(timezone.utc).isoformat()
    headers = {
        "Content-Type": "application/json",
        "X-Symbios-Signature": f"sha256={signature}",
        "X-Symbios-Timestamp": timestamp,
        "User-Agent": "SYMBIOS-Webhook/0.1",
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(url, content=body, headers=headers)
            logger.info(
                f"Webhook → {url} HTTP {r.status_code} (sig=sha256:{signature[:12]}…)"
            )
    except Exception as e:
        logger.warning(f"Falha ao enviar webhook para {url}: {e}")


def fire_and_forget(url: Optional[str], payload: dict) -> None:
    if not url:
        return
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(deliver_webhook(url, payload))
    except RuntimeError:
        pass
