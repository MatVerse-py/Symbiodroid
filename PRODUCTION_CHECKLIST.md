# SYMBIOS Evidence OS — Production Checklist

> Antes de promover o backend para produção, execute **todos os passos abaixo**.
> Falhar em qualquer um deixa o sistema vulnerável a falsificação de webhook,
> roubo de sessão, ou compartilhamento indevido de dossiês.

---

## 1) Rotação de segredos (OBRIGATÓRIO)

⚠️ **Alerta de credencial exposta**: se sua senha do VSCode/code-server apareceu em qualquer captura de tela, **rotacione agora**. Trate-a como vazada.

Gere segredos novos com `openssl` (Linux/macOS):

```bash
# JWT de autenticação dos usuários
openssl rand -hex 64

# HMAC dos webhooks
openssl rand -hex 64

# JWT dos links de share temporários
openssl rand -hex 64
```

Cole os valores em `/app/backend/.env`:

```env
JWT_SECRET="<resultado do 1º openssl>"
WEBHOOK_SECRET="<resultado do 2º openssl>"
SHARE_JWT_SECRET="<resultado do 3º openssl>"
```

Reinicie o backend após cada mudança em `.env`:

```bash
sudo supervisorctl restart backend
```

## 2) URL pública canônica

Para que `share.url` retornado pela API venha já absoluto (ex: `https://api.symbios.ai/api/share/<token>`), defina:

```env
PUBLIC_BASE_URL="https://api.symbios.ai"
```

Sem isso, o campo vem como caminho relativo (`/api/share/<token>`) e o app móvel precisa concatenar manualmente.

## 3) HF_TOKEN (opcional, mas recomendado)

Sem token: STT de áudio e análise LLM (resumo executivo) ficam desabilitadas. Tudo o resto funciona.

```env
HF_TOKEN="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Pegue o token gratuito em https://huggingface.co/settings/tokens (escopo "read" basta).

## 4) MongoDB de produção

Substitua `MONGO_URL` por uma instância gerenciada (Atlas, DocumentDB, etc.) e crie um usuário dedicado com permissão **apenas** no `DB_NAME` configurado. Nunca exponha credenciais root.

```env
MONGO_URL="mongodb+srv://symbios_app:STRONG_PASSWORD@cluster.mongodb.net/?retryWrites=true&w=majority"
DB_NAME="symbios_prod"
```

## 5) CORS restritivo

Em produção, **nunca** mantenha `CORS_ORIGINS=*`. Liste as origens autorizadas:

```env
CORS_ORIGINS="https://symbiodroid.app,https://app.symbios.ai"
```

## 6) Verificação `.gitignore`

```bash
cd /app
git check-ignore -v backend/.env backend/cases/test/raw/x.txt
```

Ambos devem aparecer como ignorados. Se algum não estiver, ajuste `.gitignore`.

Confira que o repo remoto **não** tem nada exposto:

```bash
git ls-files | grep -E "\.env$|cases/" || echo "OK: nada exposto"
```

## 7) Backup do diretório de evidências

`backend/cases/` contém **todas** as evidências brutas e PDFs selados. Configure backup periódico (S3, rsync, snapshot de volume). Sem isso, perda do disco = perda da cadeia de custódia.

```bash
# Exemplo: snapshot diário comprimido
tar -czf "symbios_cases_$(date +%F).tar.gz" /app/backend/cases/
aws s3 cp "symbios_cases_$(date +%F).tar.gz" s3://symbios-backup/cases/
```

## 8) Verificação rápida pós-deploy

```bash
API_URL="https://api.symbios.ai"
curl -s "$API_URL/api/health" | jq .
# esperado: {"status":"ok","hf_configured":true}

# Crie um usuário de teste e rode o ciclo completo: register → case → upload → process → seal → share → revoke
```

## 9) Verificação de webhook HMAC (lado do receptor)

Qualquer serviço que receber webhooks **deve** verificar a assinatura. Exemplo em Python:

```python
import hmac, hashlib

def verify_symbios(body: bytes, header: str, secret: str) -> bool:
    if not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.split("=", 1)[1])
```

Em Node.js:

```javascript
const crypto = require("crypto");
function verifySymbios(body, header, secret) {
  if (!header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header.split("=")[1]));
}
```

## 10) Mobile: nunca embutir segredos

O app **Symbiodroid** deve usar **apenas** o `JWT_SECRET` indiretamente (via login). Nunca inclua `WEBHOOK_SECRET` ou `SHARE_JWT_SECRET` no bundle do app — esses ficam exclusivamente no backend.

Use `services/symbiosApi.ts` (entregue) e armazene o JWT de auth com `expo-secure-store` (não com `AsyncStorage`).

---

## Checklist final

- [ ] `JWT_SECRET` rotacionado (64 bytes hex)
- [ ] `WEBHOOK_SECRET` rotacionado (64 bytes hex)
- [ ] `SHARE_JWT_SECRET` rotacionado (64 bytes hex)
- [ ] `PUBLIC_BASE_URL` definido
- [ ] `CORS_ORIGINS` restritivo
- [ ] `MONGO_URL` apontando para instância de produção
- [ ] `HF_TOKEN` definido (se quiser STT/LLM)
- [ ] `.env` confirmado fora do Git
- [ ] Backup de `backend/cases/` configurado
- [ ] Backend reiniciado
- [ ] `/api/health` respondendo
- [ ] Receptor de webhook implementando verificação HMAC
- [ ] App mobile **não** carrega `WEBHOOK_SECRET` ou `SHARE_JWT_SECRET`
- [ ] Senha do code-server/VSCode rotacionada (se houve exposição)

---

_Última atualização: 2026-04-26_
