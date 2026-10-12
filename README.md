# Flow Burger — API de pedidos e pagamento Pix (VeoPag)

Backend em Node.js **sem dependências externas** (`node:http`, `node:sqlite`, `node:crypto`,
`node:test`, `fetch` global). Ele:

- recebe o pedido do site (`POST /api/orders`), **recalcula os preços** com o cardápio real
  (`src/db/catalog.json`, gerado por `npm run extract-catalog`);
- cria a cobrança Pix na VeoPag e devolve o **QR Code + Copia e Cola**;
- confirma o pagamento **somente** via webhook assinado ou consulta oficial à API;
- serve o site estático junto (mesma origem) em produção.

Nenhuma credencial VeoPag chega ao navegador.

## Comandos

```bash
cd server
npm run extract-catalog   # regenera catalog.json a partir do site
npm test                  # 42 testes (mock local da VeoPag)
npm start                 # API em http://127.0.0.1:4017
```

Requisitos: Node **22.5+** (testado com Node 24).

## Documentação

- [`docs/INSTALACAO.md`](docs/INSTALACAO.md) — configuração local e de produção
- [`docs/API.md`](docs/API.md) — endpoints, payloads e erros
- [`docs/WEBHOOK.md`](docs/WEBHOOK.md) — configuração do portal e validação da assinatura
- [`docs/PRODUCAO.md`](docs/PRODUCAO.md) — checklist de publicação, segurança e operação

## Estrutura

```
server/
├── scripts/extract-catalog.js   # gera o catálogo a partir do site
├── src/
│   ├── index.js                 # bootstrap (servidor + reconciliação)
│   ├── app.js                   # rotas HTTP, CORS, rate limit, estático
│   ├── config.js                # leitura do .env
│   ├── db.js                    # SQLite (node:sqlite) + schema
│   ├── db/catalog.json          # produtos e preços (fonte de verdade)
│   ├── middleware/              # rate limit e CORS
│   ├── services/
│   │   ├── veopagClient.js      # login com cache, idempotência, retry, timeout
│   │   ├── orders.js            # criação, consulta e status de pagamento
│   │   ├── orderStatus.js       # máquina de status (nunca regride de PAID)
│   │   ├── webhook.js           # HMAC + aplicação do evento
│   │   └── reconcile.js         # reaprovisionamento periódico + expiração
│   └── utils/                   # validação, erros, logger com redação
└── tests/                       # node:test com mock da VeoPag
```

## Status do pedido

`PENDING_PAYMENT → PIX_GENERATED → PAID → PROCESSING → READY → DELIVERING → COMPLETED`

Falhas: `PAYMENT_FAILED`, `EXPIRED`, `CANCELLED`. O pagamento só muda para `PAID` com
confirmação oficial (webhook assinado ou consulta a `/api/transactions/deposit`).
