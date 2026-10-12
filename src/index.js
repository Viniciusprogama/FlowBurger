'use strict';

const http = require('node:http');
const config = require('./config');
const { createLogger } = require('./utils/logger');
const dbModule = require('./db');
const { VeoPagClient } = require('./services/veopagClient');
const { createApp } = require('./app');
const reconcile = require('./services/reconcile');

function main() {
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
  const handler = createApp(deps);
  const server = http.createServer(handler);

  server.listen(config.server.port, config.server.host, () => {
    logger.info('Flow Burger API em http://' + config.server.host + ':' + config.server.port);
    logger.info('site estatico: ' + config.server.staticDir);
    logger.info('banco: ' + db.path);
    logger.info('veopag: ' + config.veopag.baseUrl +
      (config.veopag.clientId ? ' (credenciais configuradas)' : ' (SEM credenciais - configure o .env)'));
    if (!config.veopag.webhookSecret) {
      logger.warn('VEOPAG_WEBHOOK_SECRET vazio: webhooks serao rejeitados');
    }
  });

  const reconciler = reconcile.start(deps, { intervalMs: 60000 });

  function shutdown(signal) {
    logger.info(signal + ' recebido, encerrando...');
    reconciler.stop();
    server.close(() => {
      dbModule.closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return { server: server, deps: deps, reconciler: reconciler };
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write('[flow] FATAL ' + ((err && err.stack) || err) + '\n');
    process.exit(1);
  }
}

module.exports = { main: main };
