# Instalação

## 1. Requisitos

- Node.js **22.5 ou superior** (usa `node:sqlite` embutido — nenhum `npm install` é necessário)
- Conta e credenciais da VeoPag: https://dashboard.veopag.com/credentials

## 2. Configurar o `.env`

```bash
cd server
copy .env.example .env      # Windows
cp .env.example .env        # Linux/Mac
```

Preencha:

| Variável | Onde encontrar | Obrigatório |
| --- | --- | --- |
| `VEOPAG_CLIENT_ID` / `VEOPAG_CLIENT_SECRET` | dashboard → Credentials | sim |
| `VEOPAG_WEBHOOK_SECRET` | dashboard → Webhooks → *Webhook Signature* | sim |
| `VEOPAG_CALLBACK_URL` | a URL pública deste servidor + `/api/webhooks/veopag/deposit` | sim |
| `VEOPAG_CALLBACK_TOKEN` | dashboard → Webhooks (se o portal pedir token) | não |
| `ADMIN_TOKEN` | gere uma senha forte (ex.: `openssl rand -hex 32`) | sim em produção |
| `CORS_ORIGINS` | origens do site quando é outra porta (dev: `http://127.0.0.1:5503`) | em dev |
| `DATABASE_URL` | padrão `./data/flowburger.db` | não |

> A VeoPag opera em **ambiente único (sem sandbox)**. O teste real pode ser feito com o
> valor mínimo permitido (`min_deposit_amount`, cerca de R$ 1,00).

## 3. Gerar o catálogo de preços

```bash
npm run extract-catalog
```

Lê `../www.flowburger.shop/index.html` (produtos) e `../www.flowburger.shop/js/modal-personalizacao.js`
(opções/complementos) e grava `src/db/catalog.json`. **Rode de novo sempre que o cardápio mudar.**

## 4. Subir

```bash
npm start
```

- API + site: `http://127.0.0.1:4017`
- Saúde: `GET /api/health`

Para desenvolvimento com o site em `http://127.0.0.1:5503`, o front-end já aponta automaticamente
para `http://127.0.0.1:4017` (veja `js/api-config.js`) e o `.env` libera essas origens no CORS.

## 5. Testes

```bash
npm test
```

Sobe um mock local da VeoPag (login, criação de cobrança idempotente e consulta) e valida:
criação de pedido com preços do servidor, rejeição de preços forjados, webhook assinado,
confirmação por consulta, duplicados, valor divergente, expiração, rate limit e CORS.

## 6. Primeiro pedido de verdade

1. Configure o webhook no portal (veja [`WEBHOOK.md`](WEBHOOK.md)).
2. Abra o site, monte o pedido e clique em **Gerar pagamento Pix**.
3. Pague pelo app do banco (valor baixo) e observe a confirmação em até alguns segundos —
   o webhook chega primeiro; a reconciliação a cada 60 s cobre atrasos.
4. Confira o pedido: `GET /api/admin/orders` com `Authorization: Bearer $ADMIN_TOKEN`.
