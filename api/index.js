'use strict';

const config = require('../src/config');
const { createLogger } = require('../src/utils/logger');
const dbModule = require('../src/db');
const { VeoPagClient } = require('../src/services/veopagClient');
const { createApp } = require('../src/app');
const reconcile = require('../src/services/reconcile');

let cachedHandler = null;
let handlerReady = null;

function getHandler() {
  if (cachedHandler) return Promise.resolve(cachedHandler);
  if (handlerReady) return handlerReady;

  handlerReady = (async () => {
    const logger = createLogger(config.log.level);
    const db = dbModule.getDb();

    if (typeof db.init === 'function') {
      await db.init();
    }

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
  })();

  return handlerReady;
}

module.exports = async function handler(req, res) {
  try {
    const h = await getHandler();
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
