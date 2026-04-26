"""Webhook delivery (fire-and-forget)."""
import logging
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)


async def deliver_webhook(url: Optional[str], payload: dict, timeout: float = 10.0) -> None:
    """Best-effort POST to a webhook URL. Logs failures, never raises."""
    if not url:
        return
    try:
        import httpx
    except ImportError:
        logger.warning("httpx não instalado; webhook ignorado")
        return
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(url, json=payload)
            logger.info(f"Webhook enviado para {url} → HTTP {r.status_code}")
    except Exception as e:
        logger.warning(f"Falha ao enviar webhook para {url}: {e}")


def fire_and_forget(url: Optional[str], payload: dict) -> None:
    """Schedule webhook delivery on the running event loop without awaiting."""
    if not url:
        return
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(deliver_webhook(url, payload))
    except RuntimeError:
        # No running loop: ignore (caller can await deliver_webhook directly)
        pass
