'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startHarness, api, validOrderPayload } = require('./helpers/harness');

let h;

before(async () => {
  h = await startHarness();
});

after(async () => {
  await h.close();
});

test('cria pedido, calcula totais no servidor e gera o Pix', async () => {
  const payload = validOrderPayload();
  const res = await api(h.baseUrl, 'POST', '/api/orders', payload);

  assert.equal(res.status, 201, res.text);
  const order = res.body.order;

  // 2 x (R$ 15,90 + R$ 8,00 batata) = R$ 47,80
  assert.equal(order.status, 'PIX_GENERATED');
  assert.equal(order.paymentStatus, 'PENDING');
  assert.equal(order.subtotalCents, 4780);
  assert.equal(order.deliveryFeeCents, 0);
  assert.equal(order.totalCents, 4780);
  assert.equal(order.total, 47.8);
  assert.ok(order.pix && order.pix.code && order.pix.code.length > 10, 'pix code presente');
  assert.equal(order.items[0].name, 'Burgão Especial');
  assert.equal(order.items[0].complements[0].name, 'Batata frita 250g');

  // resposta nunca pode vazar credenciais/token
  const raw = JSON.stringify(res.body);
  assert.ok(!raw.includes('test-client-secret'), 'sem client secret');
  assert.ok(!raw.includes('mock-token'), 'sem token de acesso');

  // VeoPag recebeu a cobranca certa
  const depositReq = h.mock.requests.filter((r) => r.path === '/api/payments/deposit').pop();
  assert.ok(depositReq, 'requisicao de deposito enviada');
  assert.equal(depositReq.body.amount, 47.8);
  assert.equal(depositReq.body.external_id, 'flowburguer-order-' + order.orderId);
  assert.equal(depositReq.body.payer.name, 'Cliente Teste');
  assert.match(depositReq.auth, /^Bearer mock-token/);

  // consulta do pedido
  const get = await api(h.baseUrl, 'GET', '/api/orders/' + order.orderId);
  assert.equal(get.status, 200);
  assert.equal(get.body.order.orderNumber, 1);
  assert.equal(get.body.order.customer.phone, '(88) 99999-1234');
});

test('preco forjado pelo cliente e rejeitado (preco vem do catalogo)', async () => {
  const payload = validOrderPayload({
    items: [
      {
        productId: 4,
        quantity: 1,
        selectedComplements: [{ name: 'Batata frita 250g', price: 0.01, quantity: 1 }]
      }
    ]
  });
  const res = await api(h.baseUrl, 'POST', '/api/orders', payload);
  assert.equal(res.status, 422, res.text);
  assert.match(JSON.stringify(res.body), /Batata frita 250g/);
});

test('opcao inexistente no catalogo e rejeitada', async () => {
  const payload = validOrderPayload({
    items: [
      {
        productId: 4,
        quantity: 1,
        selectedComplements: [{ name: 'Picante top secret', price: 8, quantity: 1 }]
      }
    ]
  });
  const res = await api(h.baseUrl, 'POST', '/api/orders', payload);
  assert.equal(res.status, 422, res.text);
});

test('item sem preco informado usa o preco do catalogo', async () => {
  const payload = validOrderPayload({
    items: [
      {
        productId: 4,
        quantity: 1,
        selectedComplements: [{ name: 'Batata frita 250g', quantity: 1 }]
      }
    ]
  });
  const res = await api(h.baseUrl, 'POST', '/api/orders', payload);
  assert.equal(res.status, 201, res.text);
  // R$ 15,90 + R$ 8,00
  assert.equal(res.body.order.totalCents, 2390);
});

test('entrega sem endereco e rejeitada', async () => {
  const payload = validOrderPayload({ fulfillment: 'entrega', address: null });
  const res = await api(h.baseUrl, 'POST', '/api/orders', payload);
  assert.equal(res.status, 422, res.text);
});

test('entrega valida e aceita (endereco normalizado)', async () => {
  const payload = validOrderPayload({
    fulfillment: 'entrega',
    address: {
      cep: '63200-000',
      rua: 'Rua das Flores',
      numero: '123',
      bairro: 'Centro',
      cidade: 'Serra Talhada',
      estado: 'PE'
    }
  });
  const res = await api(h.baseUrl, 'POST', '/api/orders', payload);
  assert.equal(res.status, 201, res.text);
  assert.equal(res.body.order.fulfillment, 'entrega');
  assert.equal(res.body.order.address.street, 'Rua das Flores');
});

test('replay do mesmo clientRequestId nao duplica a cobranca', async () => {
  const payload = validOrderPayload();
  const first = await api(h.baseUrl, 'POST', '/api/orders', payload);
  assert.equal(first.status, 201);
  const before = h.mock.depositCount();

  const second = await api(h.baseUrl, 'POST', '/api/orders', payload);
  assert.equal(second.status, 200, second.text);
  assert.equal(second.body.replayed, true);
  assert.equal(second.body.order.orderId, first.body.order.orderId);

  const after = h.mock.depositCount();
  assert.equal(after, before, 'nenhuma nova cobranca na VeoPag');
});

test('admin: lista de pedidos exige token', async () => {
  const noToken = await api(h.baseUrl, 'GET', '/api/admin/orders');
  assert.equal(noToken.status, 401);

  const wrongToken = await api(h.baseUrl, 'GET', '/api/admin/orders', null, {
    Authorization: 'Bearer errado'
  });
  assert.equal(wrongToken.status, 401);

  const ok = await api(h.baseUrl, 'GET', '/api/admin/orders', null, {
    Authorization: 'Bearer admin_teste_token'
  });
  assert.equal(ok.status, 200);
  assert.ok(Array.isArray(ok.body.orders));
  assert.ok(ok.body.orders.length >= 4, 'pedidos listados');
  assert.equal(ok.body.orders[0].email, 'cliente@teste.com');
});
