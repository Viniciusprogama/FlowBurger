'use strict';

// APENAS DESENVOLVIMENTO/local demo.
// Simula a VeoPag: login, criacao de deposito (idempotente), consulta e -
// apos WEBHOOK_DELAY_MS - envia um webhook assinado COMPLETED para a API,
// reproduzindo o pagamento de verdade ponta a ponta.
//
//   npm run mock        -> http://127.0.0.1:4099
//   VEOPAG_BASE_URL=http://127.0.0.1:4099 npm start

const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.MOCK_PORT || 4099);
const API_WEBHOOK_URL = process.env.MOCK_WEBHOOK_URL || 'http://127.0.0.1:4017/api/webhooks/veopag/deposit';
const WEBHOOK_SECRET = process.env.VEOPAG_WEBHOOK_SECRET || 'whsec_dev_local';
const WEBHOOK_DELAY_MS = Number(process.env.MOCK_WEBHOOK_DELAY_MS || 1500);

const deposits = new Map();
let seq = 0;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function sendWebhook(deposit) {
  const body = JSON.stringify({
    type: 'Deposit',
    external_id: deposit.external_id,
    transaction_id: deposit.transaction_id,
    txid: deposit.txid,
    status: 'COMPLETED',
    currency: deposit.currency,
    amount: deposit.amount,
    fee: deposit.fee,
    payer_name: deposit.payer_name,
    payment_method: 'PIX',
    updated_at: new Date().toISOString()
  });
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(ts + '.' + body).digest('hex');

  fetch(API_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Timestamp': String(ts),
      'X-Webhook-Signature': sig
    },
    body
  })
    .then(async (res) => {
      console.log('[mock] webhook ' + deposit.external_id + ' -> ' + res.status + ' ' + await res.text());
    })
    .catch((err) => console.log('[mock] webhook falhou: ' + err.message));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://mock');
  const raw = await readBody(req);
  let body = null;
  if (raw) {
    try { body = JSON.parse(raw); } catch (e) { body = null; }
  }

  console.log('[mock] ' + req.method + ' ' + url.pathname + url.search);

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    if (!body || !body.client_id || !body.client_secret) {
      json(res, 400, { message: 'Missing required fields.' });
      return;
    }
    json(res, 200, { message: 'ok', token: 'mock-token', user: { id: 1, name: 'Loja Mock' } });
    return;
  }

  if (!req.headers.authorization || !/^Bearer\s+/.test(req.headers.authorization)) {
    json(res, 401, { message: 'Token invalido' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/payments/deposit') {
    if (!body || body.amount === undefined || !body.external_id || !body.payer) {
      json(res, 400, { message: 'Missing required fields.' });
      return;
    }
    if (Number(body.amount) < 1) {
      json(res, 403, { message: 'Valor minimo para deposito', min_amount: 1 });
      return;
    }

    const existing = deposits.get(body.external_id);
    if (existing) {
      json(res, 200, {
        id: existing.id,
        transaction_id: existing.transaction_id,
        external_id: existing.external_id,
        status: existing.status,
        qrcode: existing.qrcode,
        idempotent: true
      });
      return;
    }

    seq += 1;
    const deposit = {
      id: 'dep_' + seq,
      transaction_id: 'mocktx_' + seq + '_' + Date.now(),
      txid: 'mocktxid' + seq,
      external_id: body.external_id,
      amount: Number(body.amount),
      fee: Number((Number(body.amount) * 0.0199).toFixed(2)),
      status: 'PENDING',
      currency: 'BRL',
      payment_method: 'PIX',
      qrcode:
        '00020101021226690014BR.GOV.BCB.PIX0147' +
        Buffer.from(String(body.external_id)).toString('base64').slice(0, 40) +
        '5204000053039865802BR5908FLOW PIZ6009SERRALHADA62070503***6304ABCD',
      end_to_end: null,
      payer_name: body.payer.name
    };
    deposits.set(body.external_id, deposit);
    console.log('[mock] deposit criado ' + body.external_id + ' R$ ' + (deposit.amount / 100).toFixed(2));

    setTimeout(() => {
      deposit.status = 'COMPLETED';
      deposit.end_to_end = 'E' + Date.now() + 'MOCK';
      sendWebhook(deposit);
    }, WEBHOOK_DELAY_MS);

    json(res, 201, {
      message: 'Cobranca criada',
      qrCodeResponse: {
        transactionId: deposit.transaction_id,
        status: deposit.status,
        qrcode: deposit.qrcode,
        amount: deposit.amount,
        fee: deposit.fee
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/transactions/deposit') {
    const filters = {};
    for (const key of ['end_to_end', 'transaction_id', 'external_id', 'txid']) {
      if (url.searchParams.get(key)) filters[key] = url.searchParams.get(key);
    }
    if (Object.keys(filters).length !== 1) {
      json(res, 400, { message: 'Informe exatamente um filtro' });
      return;
    }
    let found = null;
    for (const deposit of deposits.values()) {
      if (filters.external_id && deposit.external_id === filters.external_id) found = deposit;
      if (filters.transaction_id && deposit.transaction_id === filters.transaction_id) found = deposit;
      if (filters.txid && deposit.txid === filters.txid) found = deposit;
      if (filters.end_to_end && deposit.end_to_end === filters.end_to_end) found = deposit;
    }
    json(res, 200, { filters: filters, deposit: found });
    return;
  }

  json(res, 404, { message: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[mock] VeoPag mock em http://127.0.0.1:' + PORT);
  console.log('[mock] webhook COMPLETED apos ' + WEBHOOK_DELAY_MS + ' ms -> ' + API_WEBHOOK_URL);
});
