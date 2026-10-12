# Produção

## Checklist

- [ ] Node 22.5+ no servidor
- [ ] `server/.env` preenchido (nunca ficar dentro de `www.*` — já está fora da raiz estática)
- [ ] `npm run extract-catalog` executado com o cardápio atual
- [ ] `npm test` verde antes de publicar
- [ ] Webhook configurado no portal (`WEBHOOK.md`) e `VEOPAG_CALLBACK_URL` público
- [ ] `ADMIN_TOKEN` forte; `CORS_ORIGINS` vazio quando site e API estão no mesmo host
- [ ] HTTPS no domínio (webhook e Pix exigem)
- [ ] Relógio do servidor sincronizado (NTP) — a assinatura aceita ±5 min
- [ ] Backup do SQLite agendado

## Rodando como serviço

systemd (`/etc/systemd/system/flow-burger.service`):

```ini
[Unit]
Description=Flow Burger API
After=network.target

[Service]
WorkingDirectory=/opt/flowburger/server
ExecStart=/usr/bin/node src/index.js
Restart=always
User=flow
Environment=NODE_ENV=production
EnvironmentFile=/opt/flowburger/server/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now flow-burger
curl -s http://127.0.0.1:4017/api/health
```

## Proxy reverso (nginx)

```nginx
server {
    server_name loja.exemplo.com;
    listen 443 ssl;

    # API + site no mesmo servidor (origem única, sem CORS)
    location / {
        proxy_pass http://127.0.0.1:4017;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
}
```

Com proxy, deixe `TRUST_PROXY=1` para que o rate limit use o IP real.

## Variáveis críticas

| Variável | Recomendação |
| --- | --- |
| `VEOPAG_*` | nunca no front; só no `.env` |
| `VEOPAG_WEBHOOK_SECRET` | obrigatório — sem ele todo webhook é rejeitado |
| `ADMIN_TOKEN` | `openssl rand -hex 32`; guarda a lista de pedidos |
| `REQUIRE_PAYER_DOCUMENT=1` | recomendado (evita recusa da VeoPag por falta de CPF/CNPJ) |
| `ORDER_EXPIRY_MINUTES` | validade do QR (a VeoPag não documenta TTL próprio) |
| `DELIVERY_FEE` | `0` = entrega grátis |
| `PREPARO_ESTIMADO` | texto exibido no comprovante (ex.: `30 a 40 minutos`) |
| `LOG_LEVEL` | `info` normal; `debug` só para investigar |

## Banco e backups

SQLite em `DATABASE_URL` (padrão `server/data/flowburger.db`), WAL ativo.

```bash
# backup a quente
sqlite3 data/flowburger.db ".backup backups/flow-$(date +%F).db"
```

Restore: parar o serviço, substituir o arquivo, subir de novo.

## Operação

- **Conciliação**: a cada 60 s consulta pedidos pendentes (máx. 10 por ciclo) e expira Pix vencidos.
  Um webhook perdido nunca deixa pedido pago preso.
- **Auditoria**: tabela `audit_log` (criação, eventos de pagamento, transições manuais).
- **Logs**: stdout com redação automática de `secret|token|authorization|cpf|document`.
- **Monitoramento**: `GET /api/health`; alertar se `502` em `POST /api/orders` aparecer
  repetidamente (gateway instável/credenciais) ou se webhook retornar `401` (segredo divergente).
- **Estornos/cancelamentos**: `POST /api/admin/orders/{id}/status { "status": "CANCELLED" }`
  só altera o status interno — o estorno em si é feito no painel da VeoPag.
- **QR Code**: a imagem é gerada no navegador via CDN (cdnjs, com espelho jsDelivr e
  fallback para o texto Copia e Cola). Sem internet o pedido continua pagável pelo código.

## Segurança verificada por teste

- Respostas da API não contêm credenciais/token (`tests/app.test.js`)
- Webhook exige HMAC + janela de 5 min; assinatura inválida não paga pedido
- Preços sempre recalculados no servidor; entrada sanitizada (CPF/CNPJ, telefone, controle)
- Rate limit por IP/rota, CORS por allow-list, `.env` fora da raiz servida, sem path traversal
