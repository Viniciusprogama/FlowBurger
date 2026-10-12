'use strict';

const http = require('node:http');
const { startMockVeoPag } = require('./mockVeoPag');

// Sobe o servidor da API apontando para o mock da VeoPag.
// O env e configurado ANTES do primeiro require de src/* (config e singleton).
async function startHarness(envOverrides) {
  const mock = await startMockVeoPag();

  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.VEOPAG_BASE_URL = mock.url;
  process.env.VEOPAG_CLIENT_ID = 'test-client-id';
  process.env.VEOPAG_CLIENT_SECRET = 'test-client-secret';
  process.env.VEOPAG_WEBHOOK_SECRET = 'whsec_teste_123456';
  process.env.VEOPAG_CALLBACK_URL = 'http://127.0.0.1:4017/api/webhooks/veopag/deposit';
  process.env.CORS_ORIGINS = 'http://127.0.0.1:5503';
  process.env.ADMIN_TOKEN = 'admin_teste_token';
  process.env.DATABASE_URL = ':memory:';
  Object.assign(process.env, envOverrides || {});

  const config = require('../../src/config');
  const dbmod = require('../../src/db');
  const { createLogger } = require('../../src/utils/logger');
  const { VeoPagClient } = require('../../src/services/veopagClient');
  const { createApp } = require('../../src/app');

  const logger = createLogger('error');
  const db = dbmod.open({ url: ':memory:' });

  const veopag = new VeoPagClient({
    baseUrl: mock.url,
    clientId: process.env.VEOPAG_CLIENT_ID,
    clientSecret: process.env.VEOPAG_CLIENT_SECRET,
    callbackUrl: process.env.VEOPAG_CALLBACK_URL,
    timeoutMs: 4000,
    backoffMs: 1,
    logger: logger
  });

  const deps = { db: db, veopag: veopag, logger: logger, config: config };
  const server = http.createServer(createApp(deps));

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = 'http://127.0.0.1:' + server.address().port;

  return {
    mock: mock,
    baseUrl: baseUrl,
    db: db,
    deps: deps,
    config: config,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      db.close();
      await mock.close();
    }
  };
}

async function api(baseUrl, method, pathname, body, headers) {
  const init = { method: method, headers: Object.assign({ Accept: 'application/json' }, headers || {}) };
  if (body !== undefined && body !== null) {
    init.headers['Content-Type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const response = await fetch(baseUrl + pathname, init);
  let json = null;
  const text = await response.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = null;
    }
  }
  return { status: response.status, body: json, text: text, headers: response.headers };
}

function validOrderPayload(overrides) {
  const payload = {
    clientRequestId: 'req_' + Math.random().toString(36).slice(2, 12),
    customer: {
      name: 'Cliente Teste',
      phone: '(88) 99999-1234',
      email: 'cliente@teste.com'
    },
    fulfillment: 'retirada',
    address: null,
    items: [
      {
        productId: 4,
        quantity: 2,
        selectedOptions: [{ name: 'Ao ponto', price: 0, quantity: 1 }],
        selectedComplements: [{ name: 'Batata frita 250g', price: 8, quantity: 1 }],
        observations: 'Sem cebola'
      }
    ]
  };
  return Object.assign(payload, overrides || {});
}

module.exports = { startHarness: startHarness, api: api, validOrderPayload: validOrderPayload };
