# SYMBIOS Evidence OS — PRD

## Problem Statement
Motor Python (FastAPI) para análise forense de evidências conversacionais (WhatsApp, prints, áudios, extratos). Sem UI nesta entrega — usuário fará UI/UX por fora. Funciona como backend "cérebro pericial" auditável: hash → parser → OCR → STT → flags → Ω-Gate → ledger → dossiê. Pode ser plugado a um Custom GPT via Actions/OpenAPI ou a um app Base44/OnSpace via REST.

## Architecture
- **FastAPI** + **MongoDB (motor async)**
- **JWT custom auth** (bcrypt + PyJWT)
- **Storage local** em `/app/backend/cases/{case_id}/{raw,processed,reports}`
- **HuggingFace Inference API** (cloud) para LLM (Mistral-7B-Instruct-v0.3) e STT (Whisper-large-v3)
- **Tesseract OCR** local (português + inglês)

## Data model (MongoDB collections)
- `users` — id, email, password_hash, full_name, created_at
- `cases` — case_id, owner_id, title, description, status, totals, omega_status, timestamps
- `evidence_files` — file_id, case_id, filename, sha256, size, file_type, mime_type, upload_status
- `events` — event_id, case_id, timestamp, author, message, source, source_sha256, flags[], omega_status, review_status, metadata
- `ledger` — entry_id, case_id, timestamp, amount, currency, direction, description, source_event_id, omega_status, missing_fields

## Endpoints (`/api`)
**Auth**: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
**Cases**: `POST /cases`, `GET /cases`, `GET /cases/{id}`, `DELETE /cases/{id}`
**Evidence**: `POST /cases/{id}/upload`, `POST /cases/{id}/process`, `GET /cases/{id}/files`
**Insights**: `GET /cases/{id}/timeline`, `GET /cases/{id}/flags`, `GET /cases/{id}/ledger`, `GET /cases/{id}/report` (Markdown), `POST /cases/{id}/analyze` (LLM)
**Review**: `POST /events/{event_id}/review`
**Meta**: `GET /health`, `GET /flags/catalog`

## Implemented (2026-04-26)
- JWT auth (registro/login/me) com bcrypt
- CRUD de casos por usuário (isolamento por owner_id) com `webhook_url` opcional
- Upload com SHA-256 (cadeia de custódia) e classificação de tipo
- Parser WhatsApp TXT (multi-formato BR), extração de ZIP recursiva
- **Parser PDF** via pdfplumber (tenta formato WhatsApp; senão, evento bulk)
- OCR Tesseract (por+eng) para imagens
- STT via HuggingFace Whisper-large-v3 (skip silencioso se HF_TOKEN ausente)
- Análise LLM via HuggingFace Mistral-7B-Instruct-v0.3 (resumo/contradições/lacunas)
- Detector neycsec01 com 8 flags (coercion, financial, intimate, meeting, credentials, erasure, minor, substance)
- Ω-Gate fail-closed em 3 níveis (evento, ledger, caso)
- Ledger financeiro (R$/US$/reais) com inferência de direção (in/out)
- Geração de dossiê **Markdown + PDF** (WeasyPrint) com cadeia de custódia + timeline + flags + ledger + análise LLM
- **Endpoint `/preview`** — resumo executivo (Ω + flag_top + ledger_summary + LLM 4-6 linhas) ideal para bot WhatsApp/Telegram
- **Webhook de conclusão** — POST automático para `webhook_url` quando `process` termina (BackgroundTask, fire-and-forget)
- Revisão humana de eventos (accepted/rejected + nota)
- OpenAPI/Swagger em `/docs` para colar no Custom GPT Actions

## Configuration
- `HF_TOKEN` em `/app/backend/.env` (vazio por padrão; defina para habilitar LLM/STT)
- Modelos configuráveis via `HF_TEXT_MODEL` e `HF_STT_MODEL`
- `JWT_SECRET` deve ser trocado em produção

## Status
✅ MVP do motor funcional. Testado end-to-end via curl com TXT WhatsApp real → 12 eventos, 6 flags, 2 entradas de ledger, dossiê Markdown gerado.

## Backlog
- P1: Diarização de áudio via pyannote.audio (separar vozes em chamadas — exige aceite de licença HF + GPU). Hook preparado em `symbios/hf_client.py`.
- P2: Streaming SSE em `/process` para casos grandes
- P2: Background processing (Celery/RQ) para casos com muitos áudios
- P2: Assinatura HMAC nos webhooks (header `X-Symbios-Signature`)
- P3: Suporte a Telegram exports (JSON)
- P3: Comparação de versões do dossiê (diff entre processamentos)
