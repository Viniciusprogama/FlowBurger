'use strict';

const config = require('../src/config');
const { createLogger } = require('../src/utils/logger');
const dbModule = require('../src/db');
const { VeoPagClient } = require('../src/services/veopagClient');
const { createApp } = require('../src/app');
const reconcile = require('../src/services/reconcile');

let cachedHandler = null;

function getHandler() {
  if (cachedHandler) return cachedHandler;

  const logger = createLogger(config.log.level);
  const db = dbModule.getDb();

  const veopag = new VeoPagClient({
    baseUrl: config.veopag.baseUrl,
    clientId: config.veopag.clientId,
    clientSecret: config.veopag.clientSecret,
    callbackUrl: config.veopag.callbackUrl,
    timeoutMs: config.veopag.timeoutMs,
    tokenTtlMs: config.veopag.tokenTtlMs,
    logger: logger
  });

  const deps = { db: db, veopag: veopag, logger: logger, config: config };

  try {
    reconcile.start(deps, { intervalMs: 60000 });
  } catch (e) {
    logger.warn('reconcile nao iniciado: ' + e.message);
  }

  cachedHandler = createApp(deps);
  return cachedHandler;
}

module.exports = async function handler(req, res) {
  try {
    const h = getHandler();
    await h(req, res);
  } catch (err) {
    console.error('[api] error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ message: 'Erro interno do servidor' }));
    }
  }
};
