# Deploy no Vercel

## Pré-requisitos

1. Conta no [Vercel](https://vercel.com) (grátis)
2. Conta no [Supabase](https://supabase.com) ou [Vercel Postgres](https://vercel.com/postgres) (grátis)
3. Gateway Pix escolhido (VeoPag, Mercado Pago, etc)

## Estrutura do Projeto

```
www.flowburger.shop/
├── server/
│   ├── api/
│   │   └── index.js          # Serverless function (todas as rotas /api)
│   ├── src/
│   │   ├── app.js            # Lógica existente (não muda)
│   │   ├── db.js             # Banco de dados (SQLite local / Postgres produção)
│   │   ├── config.js         # Configuração (não muda)
│   │   └── ...               # Resto do código (não muda)
│   ├── vercel.json           # Configuração do Vercel
│   └── package.json
└── www.flowburger.shop/      # Site estático
    ├── index.html
    ├── checkout/
    ├── css/
    ├── js/
    └── imgs/
```

## Passo a Passo

### 1. Preparar o Banco de Dados (Supabase)

1. Acesse [supabase.com](https://supabase.com) e crie um projeto
2. Em **Settings > Database**, copie a **Connection string** (URI)
3. Formato: `postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres`

### 2. Instalar o Vercel CLI

```bash
npm install -g vercel
```

### 3. Fazer Login

```bash
vercel login
```

### 4. Configurar Variáveis de Ambiente

```bash
vercel env add VEOPAG_CLIENT_ID
vercel env add VEOPAG_CLIENT_SECRET
vercel env add VEOPAG_WEBHOOK_SECRET
vercel env add ADMIN_TOKEN
vercel env add DATABASE_URL
vercel env add CORS_ORIGINS
vercel env add APP_URL
vercel env add VEOPAG_CALLBACK_URL
```

Ou crie um arquivo `.env.production`:

```env
VEOPAG_CLIENT_ID=seu_client_id
VEOPAG_CLIENT_SECRET=seu_client_secret
VEOPAG_WEBHOOK_SECRET=seu_webhook_secret
VEOPAG_CALLBACK_URL=https://SEU-DOMINIO.vercel.app/api/webhooks/veopag/deposit
ADMIN_TOKEN=seu_token_admin
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
CORS_ORIGINS=https://SEU-DOMINIO.vercel.app
APP_URL=https://SEU-DOMINIO.vercel.app
NODE_ENV=production
```

### 5. Testar Localmente (opcional)

```bash
cd server
vercel dev
```

Isso sobe o servidor em `http://localhost:3000`.

### 6. Deploy

```bash
cd server
vercel --prod
```

### 7. Configurar Webhook

Após o deploy, configure a URL do webhook no painel do gateway:

- **VeoPag**: https://dashboard.veopag.com/webhooks
- **Mercado Pago**: https://www.mercadopago.com.br/developers/panel/app

URL: `https://SEU-DOMINIO.vercel.app/api/webhooks/veopag/deposit`

## Rotas

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/health` | GET | Health check |
| `/api/orders` | POST | Criar pedido |
| `/api/orders/:id` | GET | Consultar pedido |
| `/api/orders/:id/payment-status` | GET | Status do pagamento |
| `/api/webhooks/veopag/deposit` | POST | Webhook do gateway |
| `/api/admin/orders` | GET | Listar pedidos (admin) |
| `/api/admin/orders/:id` | GET | Detalhar pedido (admin) |
| `/api/admin/orders/:id/status` | POST | Atualizar status (admin) |

## Problemas Comuns

### Webhook não funciona

1. Verifique se `VEOPAG_CALLBACK_URL` está correto
2. Verifique os logs: `vercel logs`
3. O webhook precisa ser HTTPS (o Vercel já fornece)

### Banco de dados não conecta

1. Verifique se `DATABASE_URL` está correto
2. No Supabase, verifique se o IP está liberado (Settings > Network)
3. Para produção, desative "Enforce SSL" se necessário

### CORS bloqueado

1. Adicione a origem do site em `CORS_ORIGINS`
2. Formato: `https://SEU-DOMINIO.vercel.app`

## Comandos Úteis

```bash
# Ver logs em tempo real
vercel logs

# Ver variáveis de ambiente
vercel env ls

# Remover deploy
vercel rm

# Voltar para versão anterior
vercel rollback
```
