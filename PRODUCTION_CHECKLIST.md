# SYMBIOS Evidence OS — Production Checklist

Execute esta lista antes de promover o backend para produção.

## Objetivo

Garantir que o SYMBIOS rode com repositório limpo, segredos fora do Git, API protegida, mobile sem credenciais sensíveis e compartilhamento auditável.

## Checklist obrigatório

- Rotacionar as chaves de autenticação e assinatura no ambiente de produção.
- Definir `PUBLIC_BASE_URL` com a URL pública real da API.
- Definir `CORS_ORIGINS` com domínios específicos, não com wildcard.
- Confirmar que `.env`, evidências, dossiês gerados e runtime artifacts não estão versionados.
- Confirmar que `backend/cases/`, `backend/uploads/` e `backend/reports/` estão fora do Git.
- Configurar backup do diretório de evidências ou migrar armazenamento para storage gerenciado.
- Validar `GET /api/health` após deploy.
- Testar ciclo: register, login, create case, upload, process, seal, verify, share, revoke.
- Validar assinatura HMAC recebida em webhooks antes de confiar no payload.
- No app mobile, armazenar somente token de usuário com `expo-secure-store`.
- Nunca embutir chaves de servidor no app mobile.
- Rotacionar senha do code-server ou VSCode remoto se apareceu em captura de tela.

## Comando de auditoria Git

```bash
git ls-files | grep -E "\.env$|cases/|uploads/|reports/|dossie|contrato|whatsapp_test|\.pdf$" || echo "OK"
```

O resultado esperado é vazio ou `OK`.

## Variáveis esperadas no backend

```text
JWT_SECRET=<server-only>
WEBHOOK_SECRET=<server-only>
SHARE_JWT_SECRET=<server-only>
PUBLIC_BASE_URL=https://api.symbios.ai
CORS_ORIGINS=https://symbiodroid.app,https://app.symbios.ai
HF_TOKEN=<optional-server-only>
```

## Regra mobile

O Symbiodroid deve consumir a API via `services/symbiosApi.ts` e nunca carregar segredos de servidor no bundle.
