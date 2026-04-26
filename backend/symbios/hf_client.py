"""HuggingFace Inference API client (text generation + STT)."""
import os
import logging
from pathlib import Path
from typing import Optional
import requests

logger = logging.getLogger(__name__)

HF_TOKEN = os.environ.get("HF_TOKEN", "")
TEXT_MODEL = os.environ.get("HF_TEXT_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")
STT_MODEL = os.environ.get("HF_STT_MODEL", "openai/whisper-large-v3")
HF_BASE = "https://api-inference.huggingface.co/models"
TIMEOUT = 120


def is_configured() -> bool:
    return bool(HF_TOKEN)


def _headers(json_ct: bool = True) -> dict:
    h = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "X-Wait-For-Model": "true",
    }
    if json_ct:
        h["Content-Type"] = "application/json"
    return h


def generate_text(prompt: str, max_tokens: int = 600, temperature: float = 0.4) -> str:
    """Call Mistral-7B-Instruct on HuggingFace Inference API."""
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN não configurado em /app/backend/.env")

    url = f"{HF_BASE}/{TEXT_MODEL}"
    # Mistral instruct format
    formatted = f"<s>[INST] {prompt} [/INST]"
    payload = {
        "inputs": formatted,
        "parameters": {
            "max_new_tokens": max_tokens,
            "temperature": temperature,
            "top_p": 0.9,
            "do_sample": temperature > 0,
            "return_full_text": False,
        },
        "options": {"wait_for_model": True},
    }
    resp = requests.post(url, json=payload, headers=_headers(), timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, list) and data:
        return data[0].get("generated_text", "").strip()
    if isinstance(data, dict):
        return data.get("generated_text", "").strip()
    return str(data)


def transcribe_audio(path: Path, language: str = "pt") -> str:
    """Transcribe audio via HuggingFace Whisper Inference API."""
    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN não configurado em /app/backend/.env")

    url = f"{HF_BASE}/{STT_MODEL}"
    with path.open("rb") as f:
        audio_bytes = f.read()
    resp = requests.post(
        url,
        data=audio_bytes,
        headers=_headers(json_ct=False),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, dict):
        return data.get("text", "").strip()
    return str(data)


def safe_transcribe(path: Path) -> Optional[str]:
    """Transcribe audio without raising, returns None on failure."""
    try:
        return transcribe_audio(path)
    except Exception as e:
        logger.warning(f"STT falhou para {path.name}: {e}")
        return None


def safe_generate(prompt: str, max_tokens: int = 600, temperature: float = 0.4) -> Optional[str]:
    try:
        return generate_text(prompt, max_tokens=max_tokens, temperature=temperature)
    except Exception as e:
        logger.warning(f"LLM falhou: {e}")
        return None
