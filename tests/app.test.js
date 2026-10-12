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

test('GET /api/health responde 200', async () => {
  const res = await api(h.baseUrl, 'GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test('endpoint inexistente responde 404 em JSON', async () => {
  const res = await api(h.baseUrl, 'GET', '/api/nao-existe');
  assert.equal(res.status, 404);
  assert.ok(res.body.message);
});

test('CORS: origem permitida recebe cabecalhos; outra origem nao', async () => {
  const allowed = await fetch(h.baseUrl + '/api/health', {
    method: 'OPTIONS',
    headers: { Origin: 'http://127.0.0.1:5503', 'Access-Control-Request-Method': 'GET' }
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5503');

  const denied = await fetch(h.baseUrl + '/api/health', {
    method: 'OPTIONS',
    headers: { Origin: 'http://evil.example', 'Access-Control-Request-Method': 'GET' }
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('admin: token certo lista pedidos, token errado e negado', async () => {
  const created = await api(h.baseUrl, 'POST', '/api/orders', validOrderPayload());
  assert.equal(created.status, 201, created.text);

  const denied = await api(h.baseUrl, 'GET', '/api/admin/orders', null, {
    'X-Admin-Token': 'errado'
  });
  assert.equal(denied.status, 401);

  const ok = await api(h.baseUrl, 'GET', '/api/admin/orders?limit=5', null, {
    'X-Admin-Token': 'admin_teste_token'
  });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.orders.length >= 1);
  assert.equal(ok.body.orders[0].orderId, created.body.order.orderId);

  const single = await api(h.baseUrl, 'GET', '/api/admin/orders/' + created.body.order.orderId, null, {
    Authorization: 'Bearer admin_teste_token'
  });
  assert.equal(single.status, 200);
  assert.equal(single.body.order.externalId, 'flowburguer-order-' + created.body.order.orderId);
});

test('metodo nao permitido responde 405', async () => {
  const res = await api(h.baseUrl, 'DELETE', '/api/orders');
  assert.equal(res.status, 405);
});

test('admin: avanco de status obedece a transicoes', async () => {
  const created = await api(h.baseUrl, 'POST', '/api/orders', validOrderPayload());
  const orderId = created.body.order.orderId;
  const auth = { Authorization: 'Bearer admin_teste_token' };

  const semToken = await api(h.baseUrl, 'POST', '/api/admin/orders/' + orderId + '/status', { status: 'CANCELLED' });
  assert.equal(semToken.status, 401);

  // PIX_GENERATED nao pode pular para PROCESSING
  const salto = await api(h.baseUrl, 'POST', '/api/admin/orders/' + orderId + '/status', { status: 'PROCESSING' }, auth);
  assert.equal(salto.status, 409, salto.text);
  assert.deepEqual(salto.body.details.allowed, ['CANCELLED']);

  const cancelado = await api(h.baseUrl, 'POST', '/api/admin/orders/' + orderId + '/status', { status: 'CANCELLED' }, auth);
  assert.equal(cancelado.status, 200, cancelado.text);
  assert.equal(cancelado.body.order.status, 'CANCELLED');

  // cancelado e estado final
  const depois = await api(h.baseUrl, 'POST', '/api/admin/orders/' + orderId + '/status', { status: 'PROCESSING' }, auth);
  assert.equal(depois.status, 409);

  const desconhecido = await api(h.baseUrl, 'POST', '/api/admin/orders/' + orderId + '/status', { status: 'VOADO' }, auth);
  assert.equal(desconhecido.status, 422);
});

test('site estatico e servido junto com a API', async () => {
  const res = await fetch(h.baseUrl + '/css/delivry.css');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/css/);

  const html = await fetch(h.baseUrl + '/checkout/index.html');
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-type'), /text\/html/);
});

test('traversal de diretorio nao vaza arquivos fora do site', async () => {
  const res = await fetch(h.baseUrl + '/%2e%2e/%2e%2e/server/.env');
  const text = await res.text();
  assert.notEqual(res.status, 200);
  assert.ok(!text.includes('VEOPAG_CLIENT_SECRET'), 'sem vazamento de .env');
  assert.ok(!text.includes('test-client-secret'));
});

test('POST /api/orders com JSON invalido responde 400', async () => {
  const res = await api(h.baseUrl, 'POST', '/api/orders', 'isso nao e json');
  assert.equal(res.status, 400);
  assert.match(res.body.message, /JSON/i);
});

test('nenhuma resposta da API contem segredos', async () => {
  const paths = ['/api/health', '/api/orders/ord_inexistente'];
  for (const path of paths) {
    const res = await api(h.baseUrl, 'GET', path);
    const raw = res.text || '';
    assert.ok(!raw.includes('test-client-secret'), path + ' sem secret');
    assert.ok(!raw.includes('mock-token'), path + ' sem token');
    assert.ok(!raw.includes('whsec_teste_123456'), path + ' sem webhook secret');
  }
});
