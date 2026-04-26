# Dossiê Pericial — Caso Teste

- **case_id**: `CASE-5f767a15bf91`
- **gerado_em**: 2026-04-26T01:57:00.301764+00:00
- **status_caso**: uploaded
- **Ω-Gate**: **OK**

## 1. Cadeia de Custódia

| filename | tipo | tamanho | sha256 |
|---|---|---|---|
| `whatsapp_test.txt` | txt | 787 B | `056250ef2c29572ec9563579598b70dc2125a3b8687dd9cf66b925f9f72e82ed` |

## 2. Sumário Quantitativo

- Total de arquivos: **1**
- Total de eventos extraídos: **12**
- Total de flags neycsec01: **6**

## 3. Flags neycsec01

- `neycsec01.financial`: 2 ocorrência(s)
- `neycsec01.coercion`: 1 ocorrência(s)
- `neycsec01.erasure`: 1 ocorrência(s)
- `neycsec01.credentials`: 1 ocorrência(s)
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

## 5. Ledger Financeiro

| timestamp | valor | moeda | direção | Ω | descrição |
|---|---|---|---|---|---|
| 2024-05-12T14:30:00 | 1500.0 | BRL | unknown | OK | Preciso te pedir um favor. Você pode me transferir R$ 1.500,00 via PIX? Eu te pa… |
| 2024-05-12T15:00:00 | 150.0 | BRL | out | OK | Ok, fiz a transferência. Paguei R$ 1500 agora. |

---
_Documento gerado automaticamente pelo SYMBIOS Evidence OS. Não substitui parecer humano._