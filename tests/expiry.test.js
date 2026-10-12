'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startHarness, api, validOrderPayload } = require('./helpers/harness');

let h;

before(async () => {
  h = await startHarness({ ORDER_EXPIRY_MINUTES: '0' });
});

after(async () => {
  await h.close();
});

test('Pix vencido fica EXPIRED sem marcar como pago', async () => {
  const created = await api(h.baseUrl, 'POST', '/api/orders', validOrderPayload());
  assert.equal(created.status, 201, created.text);
  const orderId = created.body.order.orderId;
  assert.ok(created.body.order.expiresAt, 'possui prazo de validade');

  await new Promise((resolve) => setTimeout(resolve, 25));

  const status = await api(h.baseUrl, 'GET', '/api/orders/' + orderId + '/payment-status');
  assert.equal(status.body.status, 'EXPIRED');
  assert.equal(status.body.orderStatus, 'EXPIRED');

  const full = await api(h.baseUrl, 'GET', '/api/orders/' + orderId);
  assert.equal(full.body.order.status, 'EXPIRED');
  assert.equal(full.body.order.paymentStatus, 'EXPIRED');
  assert.notEqual(full.body.order.paymentStatus, 'PAID');
});

test('pagamento tardio apos vencimento nao pode ser silenciosamente descartado sem evento', async () => {
  // evento cheio depois do vencimento: status oficial COMPLETED ainda e aplicado
  const created = await api(h.baseUrl, 'POST', '/api/orders', validOrderPayload());
  const order = created.body.order;
  const externalId = 'flowburguer-order-' + order.orderId;

  await new Promise((resolve) => setTimeout(resolve, 25));
  const expired = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId + '/payment-status');
  assert.equal(expired.body.status, 'EXPIRED');

  const webhook = require('../src/services/webhook');
  const ts = Math.floor(Date.now() / 1000);
  const raw = JSON.stringify({
    type: 'Deposit',
    external_id: externalId,
    status: 'COMPLETED',
    amount: order.total,
    currency: 'BRL'
  });
  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': String(ts),
    'X-Webhook-Signature': webhook.computeSignature(h.config.veopag.webhookSecret, ts, raw)
  };
  const res = await api(h.baseUrl, 'POST', '/api/webhooks/veopag/deposit', raw, headers);
  assert.equal(res.status, 200);

  const after = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId + '/payment-status');
  assert.equal(after.body.status, 'PAID', 'dinheiro recebido vence o vencimento');
});
