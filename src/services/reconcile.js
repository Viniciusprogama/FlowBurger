'use strict';

const config = require('../config');
const status = require('./orderStatus');
const orders = require('./orders');

// Reconciliacao periodica: consulta a VeoPag para pedidos ainda pendentes
// (webhook pode ter chegado atrasado/nao chegado) e expira Pix vencidos.
async function tick(deps) {
  const db = deps.db;
  const logger = deps.logger;
  const results = { checked: 0, expired: 0, failed: 0 };

  const now = new Date();
  const toExpire = db.listExpiredPending(now.toISOString(), 20);
  for (const order of toExpire) {
    const res = status.expireOrderIfNeeded(db, order);
    if (res.changed) results.expired += 1;
  }

  const staleMs = config.orders.remoteCheckMinMs;
  const pending = db.listPendingReconcile(Date.now() - staleMs, 10);
  for (const order of pending) {
    try {
      await orders.refreshFromVeoPag(deps, order);
      results.checked += 1;
    } catch (err) {
      results.failed += 1;
      logger.warn('reconcile falhou para ' + order.id + ': ' + ((err && err.message) || err));
    }
  }

  return results;
}

function start(deps, options) {
  const opts = options || {};
  const intervalMs = opts.intervalMs || 60000;
  if (config.isTest && !opts.force) return { stop: function () {} };

  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const results = await tick(deps);
      if (results.checked || results.expired) {
        deps.logger.debug('reconcile: ' + JSON.stringify(results));
      }
    } catch (err) {
      deps.logger.error('reconcile erro: ' + ((err && err.stack) || err));
    } finally {
      running = false;
    }
  }, intervalMs);

  if (typeof timer.unref === 'function') timer.unref();

  return {
    stop: function () {
      clearInterval(timer);
    },
    tick: tick
  };
}

module.exports = { start: start, tick: tick };
