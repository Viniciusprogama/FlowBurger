# API

Base: mesma origem do site (produção) ou `http://127.0.0.1:4017` (desenvolvimento).
Todas as respostas são JSON. Dinheiro é enviado em **centavos** (`totalCents`) e também
em reais (`total`) para exibição.

Erros: `{ "message": "...", "code": "...", "details": [{ "field", "message" }] }`
Códigos: `400` JSON inválido · `401` token · `404` inexistente · `405` método ·
`422` validação · `429` rate limit (com `Retry-After`) · `502` gateway VeoPag · `503` admin desativado.

---

## POST /api/orders

Cria o pedido e a cobrança Pix (idempotente por `clientRequestId`).

```json
{
  "clientRequestId": "req_lx9k2p1a",
  "customer": {
    "name": "Maria Silva",
    "phone": "(88) 98888-1111",
    "email": "maria@exemplo.com",
    "document": "52998224725"
  },
  "fulfillment": "entrega",
  "address": {
    "cep": "63200000", "rua": "Rua das Flores", "numero": "123",
    "complemento": "Casa 2", "bairro": "Centro",
    "cidade": "Serra Talhada", "estado": "PE", "referencia": "Portão azul"
  },
  "items": [
    {
      "productId": 4,
      "quantity": 2,
      "observations": "Sem cebola",
      "selectedOptions": [{ "name": "Ao ponto", "quantity": 1 }],
      "selectedComplements": [{ "name": "Batata frita 250g", "quantity": 1 }]
    }
  ]
}
```

- `fulfillment`: `entrega` ou `retirada` (`address` obrigatório só na entrega)
- `customer.email` e `customer.document` opcionais (a VeoPag exige documento em alguns fluxos;
  com `REQUIRE_PAYER_DOCUMENT=1` o backend passa a exigir)
- **Os preços NÃO são aceitos do cliente**: produto e opções são consultados no
  `catalog.json`; preço fora do catálogo → `422`
- `clientRequestId` repetido devolve o mesmo pedido (`200`, `replayed: true`) sem nova cobrança

Resposta `201`:

```json
{
  "message": "Pedido criado",
  "replayed": false,
  "order": {
    "orderId": "ord_a1b2c3d4e5f6",
    "orderNumber": 12,
    "status": "PIX_GENERATED",
    "paymentStatus": "PENDING",
    "fulfillment": "entrega",
    "customer": { "name": "Maria Silva", "phone": "(88) 98888-1111" },
    "address": { "street": "Rua das Flores", "number": "123", "city": "Serra Talhada", "state": "PE", "cep": "63200000" },
    "items": [{ "productId": 4, "name": "Burgão Especial", "quantity": 2, "unitPriceCents": 2390, "lineTotalCents": 4780 }],
    "subtotalCents": 4780, "deliveryFeeCents": 0, "totalCents": 4780, "total": 47.8,
    "currency": "BRL",
    "pix": { "code": "00020126...", "expiresAt": "2026-10-07T21:00:00.000Z" },
    "expiresAt": "2026-10-07T21:00:00.000Z",
    "preparoEstimado": "30 a 40 minutos",
    "paidAt": null
  }
}
```

---

## GET /api/orders/{orderId}

Visão do pedido (`orderId` aceita também o número, ex.: `/api/orders/12`).
O campo `pix` deixa de aparecer em `PAYMENT_FAILED`.

## GET /api/orders/{orderId}/payment-status

Consulta o status e, se ainda estiver pendente, **confere a VeoPag no máximo uma vez a
cada 15 s** (webhook continua sendo a via principal).

```json
{
  "orderId": "ord_a1b2c3d4e5f6",
  "orderNumber": 12,
  "status": "PENDING",
  "orderStatus": "PIX_GENERATED",
  "expiresAt": "2026-10-07T21:00:00.000Z",
  "paidAt": null
}
```

`status`: `PENDING` · `PAID` · `FAILED` · `EXPIRED`.

---

## POST /api/webhooks/veopag/deposit

Recebe os eventos da VeoPag. Exige corpo cru assinado — veja [`WEBHOOK.md`](WEBHOOK.md).

Respostas: `200 { ok: true, changed, reason? }` (também para duplicados/órfãos),
`400` corpo inválido, `401` assinatura/token inválido.

---

## GET /api/health

`{ "ok": true, "service": "flow-burger-api", "time": "..." }`

---

## Admin (exige `Authorization: Bearer $ADMIN_TOKEN` ou `X-Admin-Token`)

| Endpoint | Descrição |
| --- | --- |
| `GET /api/admin/orders?limit=50&status=PAID` | lista de pedidos |
| `GET /api/admin/orders/{id}` | pedido com `externalId`/`transactionId` |
| `POST /api/admin/orders/{id}/status` | avança o fluxo da loja: `{ "status": "PROCESSING" }` |

Transições: `PAID → PROCESSING → READY → DELIVERING → COMPLETED`, e
`{PENDING_PAYMENT, PIX_GENERATED, PAID, PROCESSING, READY} → CANCELLED`.
Violação → `409` com `{ "details": { "allowed": [...] } }`.

---

## Rate limit

| Rota | Limite |
| --- | --- |
| `POST /api/orders` | 10/min por IP |
| `GET .../payment-status` | 30/min por IP+pedido |
| webhook | 300/min por IP |
| demais leituras | 60/min por IP |
