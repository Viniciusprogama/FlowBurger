# Webhook da VeoPag

O pedido só vira **PAID** com confirmação oficial. O webhook é a via principal; a consulta
automática (`GET .../payment-status` e reconciliação a cada 60 s) cobre atrasos ou falhas.

## 1. Configurar no portal

1. https://dashboard.veopag.com/webhooks
2. **Deposit** → URL: `https://SEU-DOMINIO/api/webhooks/veopag/deposit`
3. Copie o valor de **Webhook Signature** para `VEOPAG_WEBHOOK_SECRET` no `.env`
4. (Se o portal gerar um token) copie para `VEOPAG_CALLBACK_TOKEN`
5. Reinicie o servidor

A `clientCallbackUrl` enviada em cada cobrança (`VEOPAG_CALLBACK_URL`) sobrescreve a URL do
portal — mantenha os dois apontando para o mesmo endpoint.

## 2. Como o servidor valida

| Item | Regra |
| --- | --- |
| Assinatura | `HMAC_SHA256(secret, "${X-Webhook-Timestamp}.${rawBody}")` em hex minúsculo |
| Comparação | `timing-safe`, corpo **cru** (sem re-serializar) |
| Janela | `|agora − X-Webhook-Timestamp| ≤ 300 s` (5 min) |
| Token | `Authorization: Bearer $VEOPAG_CALLBACK_TOKEN` (só se configurado) |
| Falhou | `401` + log — o pedido **nunca** é marcado como pago |

## 3. Payload esperado

```json
{
  "type": "Deposit",
  "external_id": "flowburguer-order-ord_a1b2c3d4e5f6",
  "transaction_id": "tx_123",
  "txid": "txid123",
  "end_to_end": "E123...",
  "payer_name": "MARIA SILVA",
  "payer_cpf": "***",
  "status": "COMPLETED",
  "currency": "BRL",
  "amount": 47.8,
  "fee": 0.95,
  "payment_method": "PIX",
  "updated_at": "2026-10-07T20:10:00.000Z"
}
```

## 4. O que o servidor faz

1. Dedup por `transaction_id:STATUS:txid` (evento repetido → `200 { duplicate: true }`)
2. Procura o pedido por `external_id` (senão por `transaction_id`); desconhecido → `200` + log
3. **Confere `amount` × `total`** — valor diferente não confirma (`reason: "amount_mismatch"`)
4. Ignora `currency` ≠ `BRL`
5. Aplica o status (`COMPLETED → PAID`, `FAILED → PAYMENT_FAILED`,
   `PENDING/PROCESSING → só rastreio`) e grava auditoria
6. Responde `200` em seguida (a VeoPag espera 2xx rápido; 3 tentativas: agora, +10 min, +30 min)

Regras de estado: **`PAID` nunca regride**; um `COMPLETED` tardio depois de `FAILED`
(vencimento/cancelamento) volta a marcar `PAID`, porque o dinheiro entrou.

## 5. Testar sem esperar pagamento

```bash
# gera a assinatura igual à da API
node -e "const c=require('crypto');const ts=Math.floor(Date.now()/1000);const body=JSON.stringify({type:'Deposit',external_id:'flowburguer-order-ord_x',status:'COMPLETED',amount:47.8,currency:'BRL'});console.log('TS='+ts);console.log('SIG='+c.createHmac('sha256','SEU_SEGREDO').update(ts+'.'+body).digest('hex'));console.log(body)"

curl -X POST http://127.0.0.1:4017/api/webhooks/veopag/deposit \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Timestamp: <TS>" \
  -H "X-Webhook-Signature: <SIG>" \
  -d '<body>'
```

Ou rode a suíte: `npm test` (cobre assinatura inválida, timestamp velho, valor divergente,
duplicado e confirmação por consulta).
