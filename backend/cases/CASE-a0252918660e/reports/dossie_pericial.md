# Dossiê Pericial — Caso Full

- **case_id**: `CASE-a0252918660e`
- **gerado_em**: 2026-04-26T02:27:02.785156+00:00
- **status_caso**: uploaded
- **Ω-Gate**: **OK**

## 1. Cadeia de Custódia

| filename | tipo | tamanho | sha256 |
|---|---|---|---|
| `contrato.pdf` | pdf | 8059 B | `cd529ea25e2966af6982f12cdecd24019eba9f9b40f68ebf66b0b1f151b0d54d` |
| `whatsapp_test.txt` | txt | 787 B | `056250ef2c29572ec9563579598b70dc2125a3b8687dd9cf66b925f9f72e82ed` |

## 2. Sumário Quantitativo

- Total de arquivos: **2**
- Total de eventos extraídos: **13**
- Total de flags neycsec01: **9**

## 3. Flags neycsec01

- `neycsec01.financial`: 3 ocorrência(s)
- `neycsec01.erasure`: 2 ocorrência(s)
- `neycsec01.credentials`: 2 ocorrência(s)
- `neycsec01.coercion`: 1 ocorrência(s)
- `neycsec01.meeting`: 1 ocorrência(s)

## 4. Timeline (primeiros 50 eventos)

- **2024-05-12T14:23:00** · `João` · Ω=OK · flags=[—]
  > Bom dia, tudo bem?
- **2024-05-12T14:25:00** · `Maria` · Ω=OK · flags=[—]
  > Bom dia! Tudo sim.
- **2024-05-12T14:30:00** · `João` · Ω=OK · flags=[neycsec01.financial]
  > Preciso te pedir um favor. Você pode me transferir R$ 1.500,00 via PIX? Eu te pago semana que vem.
- **2024-05-12T14:32:00** · `Maria` · Ω=OK · flags=[—]
  > Não tenho esse valor agora.
- **2024-05-12T14:33:00** · `João` · Ω=OK · flags=[neycsec01.coercion]
  > Por favor, é urgente. Se você não me ajudar vai se arrepender.
- **2024-05-12T14:35:00** · `Maria` · Ω=OK · flags=[—]
  > Está me ameaçando?
- **2024-05-12T14:36:00** · `João` · Ω=OK · flags=[neycsec01.erasure]
  > Apaga essa conversa. Não pode aparecer.
- **2024-05-12T15:00:00** · `Maria` · Ω=OK · flags=[neycsec01.financial]
  > Ok, fiz a transferência. Paguei R$ 1500 agora.
- **2024-05-13T09:10:00** · `João` · Ω=OK · flags=[neycsec01.credentials]
  > Recebi. Obrigado. Me manda sua senha do banco também.
- **2024-05-13T09:15:00** · `Maria` · Ω=OK · flags=[—]
  > De jeito nenhum.
- **2024-05-13T22:00:00** · `João` · Ω=OK · flags=[neycsec01.meeting]
  > Vamos nos encontrar no motel hoje?
- **2024-05-14T08:00:00** · `Maria` · Ω=OK · flags=[—]
  > Não vou mais responder.
- **—** · `—` · Ω=BLOCKED · flags=[neycsec01.financial, neycsec01.credentials, neycsec01.erasure]
  > Contrato de Mútuo Eu, João da Silva, declaro ter recebido R$ 5.000,00 em 15/05/2024 às 10:30 de Maria Souza via PIX. Senha bancária: 1234. Apaga essa conversa depois.

## 5. Ledger Financeiro

| timestamp | valor | moeda | direção | Ω | descrição |
|---|---|---|---|---|---|
| 2024-05-12T14:30:00 | 1500.0 | BRL | unknown | OK | Preciso te pedir um favor. Você pode me transferir R$ 1.500,00 via PIX? Eu te pa… |
| 2024-05-12T15:00:00 | 1500.0 | BRL | out | OK | Ok, fiz a transferência. Paguei R$ 1500 agora. |
| — | 5000.0 | BRL | unknown | BLOCKED | Contrato de Mútuo Eu, João da Silva, declaro ter recebido R$ 5.000,00 em 15/05/2… |

---
_Documento gerado automaticamente pelo SYMBIOS Evidence OS. Não substitui parecer humano._