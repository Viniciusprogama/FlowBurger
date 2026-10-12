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

test('limite de pedidos por IP responde 429 com Retry-After', async () => {
  let last = null;
  let saw429 = false;
  for (let i = 0; i < 11; i++) {
    last = await api(h.baseUrl, 'POST', '/api/orders', {});
    if (last.status === 429) {
      saw429 = true;
      break;
    }
  }
  assert.equal(saw429, true, '11a tentativa deve ser bloqueada (limite 10/min)');
  assert.equal(last.status, 429);
  assert.match(last.body.message, /Aguarde|Tente/i);
  assert.ok(last.headers.get('retry-after'), 'header Retry-After presente');
});

test('health continua respondendo apos o rate limit', async () => {
  const res = await api(h.baseUrl, 'GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});
