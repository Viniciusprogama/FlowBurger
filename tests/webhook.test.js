'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startHarness, api, validOrderPayload } = require('./helpers/harness');

let h;
let secret;

before(async () => {
  h = await startHarness();
  secret = h.config.veopag.webhookSecret;
});

after(async () => {
  await h.close();
});

function sign(rawBody, opts) {
  const options = opts || {};
  const ts = options.timestamp !== undefined ? options.timestamp : Math.floor(Date.now() / 1000);
  const sig =
    options.signature !== undefined
      ? options.signature
      : require('../src/services/webhook').computeSignature(options.secret || secret, ts, rawBody);
  return {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': String(ts),
    'X-Webhook-Signature': sig
  };
}

function webhookHeaders(rawBody, event) {
  const payload = Object.assign(
    {
      type: 'Deposit',
      currency: 'BRL',
      payment_method: 'PIX',
      updated_at: new Date().toISOString()
    },
    event
  );
  rawBody.raw = JSON.stringify(payload);
  return sign(rawBody.raw);
}

async function createOrder(overrides) {
  const res = await api(h.baseUrl, 'POST', '/api/orders', validOrderPayload(overrides));
  assert.equal(res.status, 201, res.text);
  return res.body.order;
}

test('webhook COMPLETED oficial confirma o pagamento (PAID)', async () => {
  const order = await createOrder();
  const externalId = 'flowburguer-order-' + order.orderId;

  const body = {};
  const headers = webhookHeaders(body, {
    external_id: externalId,
    transaction_id: 'tx_webhook_1',
    status: 'COMPLETED',
    amount: 47.8,
    payer_name: 'Cliente Teste'
  });

  const res = await api(h.baseUrl, 'POST', '/api/webhooks/veopag/deposit', body.raw, headers);
  assert.equal(res.status, 200, res.text);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.changed, true);

  const status = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId + '/payment-status');
  assert.equal(status.status, 200);
  assert.equal(status.body.status, 'PAID');
  assert.equal(status.body.orderStatus, 'PAID');
  assert.ok(status.body.paidAt, 'paidAt preenchido');

  const full = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId);
  assert.equal(full.body.order.status, 'PAID');
  assert.equal(full.body.order.paidAt, status.body.paidAt);
});

test('assinatura invalida nao confirma pagamento', async () => {
  const order = await createOrder();
  const externalId = 'flowburguer-order-' + order.orderId;

  const body = {};
  const headers = webhookHeaders(body, {
    external_id: externalId,
    status: 'COMPLETED',
    amount: 47.8
  });
  headers['X-Webhook-Signature'] = 'deadbeef'.repeat(8);

  const res = await api(h.baseUrl, 'POST', '/api/webhooks/veopag/deposit', body.raw, headers);
  assert.equal(res.status, 401);
  assert.equal(res.body.ok, false);

  const status = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId + '/payment-status');
  assert.equal(status.body.status, 'PENDING', 'nao pode virar PAID sem assinatura valida');
});

test('timestamp fora da janela de 5 minutos e rejeitado', async () => {
  const order = await createOrder();
  const externalId = 'flowburguer-order-' + order.orderId;
  const stale = Math.floor(Date.now() / 1000) - 600;

  const raw = JSON.stringify({ type: 'Deposit', external_id: externalId, status: 'COMPLETED', amount: 47.8 });
  const res = await api(h.baseUrl, 'POST', '/api/webhooks/veopag/deposit', raw, sign(raw, { timestamp: stale }));
  assert.equal(res.status, 401);

  const status = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId + '/payment-status');
  assert.equal(status.body.status, 'PENDING');
});

test('valor recebido diferente do pedido nao confirma', async () => {
  const order = await createOrder();
  const externalId = 'flowburguer-order-' + order.orderId;

  const body = {};
  const headers = webhookHeaders(body, {
    external_id: externalId,
    status: 'COMPLETED',
    amount: 0.01
  });

  const res = await api(h.baseUrl, 'POST', '/api/webhooks/veopag/deposit', body.raw, headers);
  assert.equal(res.status, 200);
  assert.equal(res.body.changed, false);
  assert.equal(res.body.reason, 'amount_mismatch');

  const status = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId + '/payment-status');
  assert.equal(status.body.status, 'PENDING');
});

test('webhook duplicado e processado uma unica vez', async () => {
  const order = await createOrder();
  const externalId = 'flowburguer-order-' + order.orderId;

  const body = {};
  const headers = webhookHeaders(body, {
    external_id: externalId,
    transaction_id: 'tx_dup',
    status: 'COMPLETED',
    amount: 47.8
  });

  const first = await api(h.baseUrl, 'POST', '/api/webhooks/veopag/deposit', body.raw, headers);
  assert.equal(first.body.changed, true);

  const second = await api(h.baseUrl, 'POST', '/api/webhooks/veopag/deposit', body.raw, headers);
  assert.equal(second.status, 200);
  assert.equal(second.body.duplicate, true);
});

test('consulta a VeoPag confirma quando o webhook nao chega (e e limitada)', async () => {
  const order = await createOrder();
  const externalId = 'flowburguer-order-' + order.orderId;

  h.mock.setDeposit(externalId, { status: 'COMPLETED', amount: 47.8 });
  const consultas = () => h.mock.requests.filter((r) => r.path.indexOf('/api/transactions/deposit') === 0).length;
  const antes = consultas();

  const first = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId + '/payment-status');
  assert.equal(first.body.status, 'PAID');
  assert.ok(consultas() > antes, 'fez consulta remota');

  const second = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId + '/payment-status');
  assert.equal(second.body.status, 'PAID');
  assert.equal(consultas(), antes + 1, 'segunda chamada nao consultou a VeoPag (throttle)');

  const third = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId + '/payment-status');
  assert.equal(third.body.status, 'PAID');
  assert.equal(consultas(), antes + 1, 'pagamento final nao consulta de novo');
});

test('FAILED marca pedido como recusado e COMPLETED posterior vence', async () => {
  const order = await createOrder();
  const externalId = 'flowburguer-order-' + order.orderId;

  const failedBody = {};
  const failedHeaders = webhookHeaders(failedBody, {
    external_id: externalId,
    transaction_id: 'tx_failed',
    status: 'FAILED',
    amount: 47.8,
    error_message: 'Saldo insuficiente'
  });
  const failedRes = await api(h.baseUrl, 'POST', '/api/webhooks/veopag/deposit', failedBody.raw, failedHeaders);
  assert.equal(failedRes.status, 200);
  assert.equal(failedRes.body.changed, true);

  let status = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId + '/payment-status');
  assert.equal(status.body.status, 'FAILED');
  assert.equal(status.body.orderStatus, 'PAYMENT_FAILED');

  // confirmacao oficial atrasada nao pode ser ignorada
  const paidBody = {};
  const paidHeaders = webhookHeaders(paidBody, {
    external_id: externalId,
    transaction_id: 'tx_failed',
    status: 'COMPLETED',
    amount: 47.8
  });
  await api(h.baseUrl, 'POST', '/api/webhooks/veopag/deposit', paidBody.raw, paidHeaders);

  status = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId + '/payment-status');
  assert.equal(status.body.status, 'PAID');
});

test('webhook de pedido desconhecido nao quebra (200 + log)', async () => {
  const body = {};
  const headers = webhookHeaders(body, {
    external_id: 'flowburguer-order-ord_inexistente',
    status: 'COMPLETED',
    amount: 10
  });
  const res = await api(h.baseUrl, 'POST', '/api/webhooks/veopag/deposit', body.raw, headers);
  assert.equal(res.status, 200);
  assert.equal(res.body.unknownOrder, true);
});

test('corpo assinado mas invalido retorna 400 sem confirmar nada', async () => {
  const raw = 'isso nao e json';
  const res = await api(h.baseUrl, 'POST', '/api/webhooks/veopag/deposit', raw, sign(raw));
  assert.equal(res.status, 400);
});

test('unica fonte de verdade: frontend nao muda status sozinho', async () => {
  const order = await createOrder();
  // nenhuma chamada do cliente marcou o pedido como pago
  assert.equal(order.status, 'PIX_GENERATED');
  assert.equal(order.paymentStatus, 'PENDING');
});
