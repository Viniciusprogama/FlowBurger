'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const config = require('./config');
const { ApiError, ValidationError } = require('./utils/errors');
const { applyCors } = require('./middleware/cors');
const { createLimiter, clientIp, enforce } = require('./middleware/rateLimit');
const orders = require('./services/orders');
const webhook = require('./services/webhook');
const orderStatus = require('./services/orderStatus');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webmanifest': 'application/manifest+json'
};

function sendJson(res, status, body, headers) {
  const payload = JSON.stringify(body === undefined ? {} : body);
  const base = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  };
  const all = Object.assign(base, headers || {});
  res.writeHead(status, all);
  res.end(payload);
}

function sendError(res, err, logger) {
  if (err instanceof ValidationError || err instanceof ApiError) {
    const headers = {};
    if (err.retryAfterSeconds) headers['Retry-After'] = String(err.retryAfterSeconds);
    sendJson(res, err.status, err.toJSON(), headers);
    return;
  }
  logger.error('erro nao tratado: ' + ((err && err.stack) || err));
  sendJson(res, 500, { message: 'Erro interno do servidor' });
}

function readBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limitBytes) {
        settled = true;
        reject(new ApiError(413, 'Corpo da requisicao muito grande', 'PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

async function readJson(req, limitBytes) {
  const raw = await readBody(req, limitBytes);
  if (!raw.length) return { raw: '', json: null };
  let json;
  try {
    json = JSON.parse(raw.toString('utf8'));
  } catch (e) {
    throw new ApiError(400, 'JSON invalido', 'INVALID_JSON');
  }
  return { raw: raw.toString('utf8'), json: json };
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
}

function checkAdmin(req) {
  const expected = config.security.adminToken;
  if (!expected) {
    throw new ApiError(503, 'ADMIN_TOKEN nao configurado no servidor', 'ADMIN_DISABLED');
  }
  const auth = req.headers.authorization || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  const headerToken = (req.headers['x-admin-token'] || '').toString();
  const provided = bearer ? bearer[1].trim() : headerToken.trim();
  if (!provided || provided !== expected) {
    throw new ApiError(401, 'Token administrativo invalido', 'UNAUTHORIZED');
  }
}

function matchOrderRoute(pathname) {
  let m = pathname.match(/^\/api\/orders\/([^/]+)\/payment-status$/);
  if (m) return { route: 'payment-status', id: decodeURIComponent(m[1]) };
  m = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (m) return { route: 'order', id: decodeURIComponent(m[1]) };
  m = pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
  if (m) return { route: 'admin-status', id: decodeURIComponent(m[1]) };
  m = pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (m) return { route: 'admin-order', id: decodeURIComponent(m[1]) };
  return null;
}

function resolveStaticFile(pathname) {
  const root = path.resolve(config.server.staticDir);
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (e) {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const normalized = path.posix.normalize(decoded.replace(/\\/g, '/'));
  const target = path.resolve(root, '.' + (normalized.startsWith('/') ? normalized : '/' + normalized));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

function serveStatic(req, res, pathname) {
  const target = resolveStaticFile(pathname);
  if (!target) {
    sendJson(res, 400, { message: 'Caminho invalido' });
    return;
  }

  let file = target;
  let stat;
  try {
    stat = fs.statSync(file);
    if (stat.isDirectory()) {
      file = path.join(file, 'index.html');
      stat = fs.statSync(file);
    }
  } catch (e) {
    sendJson(res, 404, { message: 'Arquivo nao encontrado' });
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff'
  };

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
}

function createApp(deps) {
  const logger = deps.logger;
  const db = deps.db;
  const veopag = deps.veopag;
  const trustProxy = config.server.trustProxy === true;

  const limiters = {
    createOrder: createLimiter({ max: 10, windowMs: 60000 }),
    orderView: createLimiter({ max: 60, windowMs: 60000 }),
    paymentStatus: createLimiter({ max: 30, windowMs: 60000 }),
    webhook: createLimiter({ max: 300, windowMs: 60000 })
  };

  return async function handler(req, res) {
    const started = Date.now();
    securityHeaders(res);

    let url;
    try {
      url = new URL(req.url, 'http://internal');
    } catch (e) {
      sendJson(res, 400, { message: 'URL invalida' });
      return;
    }
    const pathname = url.pathname;
    const corsOk = applyCors(req, res, config);

    if (req.method === 'OPTIONS') {
      const allowed = corsOk || !req.headers.origin;
      res.writeHead(allowed ? 204 : 403, {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
        'Access-Control-Max-Age': '600'
      });
      res.end();
      return;
    }

    const isApi = pathname === '/api' || pathname.startsWith('/api/');
    const ip = clientIp(req, trustProxy);

    try {
      if (isApi) {
        await handleApi(req, res, {
          pathname: pathname,
          method: req.method,
          ip: ip,
          db: db,
          veopag: veopag,
          logger: logger,
          limiters: limiters,
          deps: deps
        });
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        serveStatic(req, res, pathname === '/' ? '/index.html' : pathname);
      } else {
        sendJson(res, 405, { message: 'Metodo nao permitido' });
      }
    } catch (err) {
      sendError(res, err, logger);
    } finally {
      if (pathname.startsWith('/api/')) {
        logger.debug(req.method + ' ' + pathname + ' ' + (Date.now() - started) + 'ms');
      }
    }
  };
}

async function handleApi(req, res, ctx) {
  const { pathname, method, ip, db, veopag, logger, limiters, deps } = ctx;

  if (method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'flow-burger-api', time: new Date().toISOString() });
    return;
  }

  // Webhook: corpo cru obrigatorio para validar HMAC
  if (method === 'POST' && pathname === '/api/webhooks/veopag/deposit') {
    enforce(limiters.webhook, 'webhook:' + ip, 'Muitos webhooks. Tente novamente em instantes.');
    const raw = await readBody(req, config.server.bodyLimitBytes);
    const result = await webhook.handleWebhook(
      { db: db, logger: logger },
      { rawBody: raw.toString('utf8'), headers: req.headers }
    );
    sendJson(res, result.status, result.body);
    return;
  }

  if (method === 'POST' && pathname === '/api/orders') {
    enforce(limiters.createOrder, ip, 'Muitas tentativas de pedido. Aguarde um minuto.');
    const body = await readJson(req, config.server.bodyLimitBytes);
    const created = await orders.createOrder(deps, body.json || {});
    sendJson(res, created.replayed ? 200 : 201, {
      message: created.replayed ? 'Pedido ja existente' : 'Pedido criado',
      order: orders.getView(db, created.order),
      replayed: created.replayed
    });
    return;
  }

  const orderRoute = matchOrderRoute(pathname);

  if (orderRoute && method === 'GET' && orderRoute.route === 'payment-status') {
    enforce(
      limiters.paymentStatus,
      ip + ':' + orderRoute.id,
      'Consultas de status muito frequentes. Aguarde alguns segundos.'
    );
    const result = await orders.getPaymentStatus(deps, orderRoute.id, { allowRemote: true });
    sendJson(res, 200, result.view);
    return;
  }

  if (orderRoute && method === 'GET' && orderRoute.route === 'order') {
    enforce(limiters.orderView, ip, null);
    const order = await orders.getOrder(deps, orderRoute.id);
    sendJson(res, 200, { order: orders.getView(db, order) });
    return;
  }

  if (orderRoute && method === 'POST' && orderRoute.route === 'admin-status') {
    checkAdmin(req);
    const body = await readJson(req, 8 * 1024);
    const target = String((body.json && body.json.status) || '').toUpperCase();
    const order = await orders.getOrder(deps, orderRoute.id);

    if (!orderStatus.STATUS[target]) {
      throw new ApiError(422, 'Status desconhecido: ' + target, 'INVALID_STATUS');
    }
    if (!orderStatus.canTransition(order.status, target)) {
      throw new ApiError(
        409,
        'Transicao nao permitida: ' + order.status + ' -> ' + target,
        'INVALID_TRANSITION',
        { allowed: orderStatus.allowedTransitions(order.status) }
      );
    }

    await db.updateOrder(order.id, { status: target, updated_at: db.now() });
    await db.audit(order.id, 'status_manual', order.status + ' -> ' + target);
    logger.info('pedido ' + order.id + ': ' + order.status + ' -> ' + target);

    const updated = await db.getOrderById(order.id);
    sendJson(res, 200, { order: orders.getView(db, updated) });
    return;
  }

  if (method === 'GET' && pathname === '/api/admin/orders') {
    checkAdmin(req);
    const limit = Number(urlSearch(req, 'limit')) || 50;
    const statusFilter = urlSearch(req, 'status');
    const rows = statusFilter
      ? await db.listOrdersByStatus(statusFilter, limit)
      : await db.listOrders(limit);
    sendJson(res, 200, {
      orders: rows.map((row) => {
        const view = orders.getView(db, row);
        view.email = row.customer_email;
        return view;
      })
    });
    return;
  }

  if (orderRoute && method === 'GET' && orderRoute.route === 'admin-order') {
    checkAdmin(req);
    const order = await orders.getOrder(deps, orderRoute.id);
    const view = orders.getView(db, order);
    view.email = order.customer_email;
    view.externalId = order.external_id;
    view.transactionId = order.transaction_id;
    sendJson(res, 200, { order: view });
    return;
  }

  if (pathname === '/api/orders' && method !== 'POST') {
    sendJson(res, 405, { message: 'Metodo nao permitido' });
    return;
  }

  sendJson(res, 404, { message: 'Endpoint nao encontrado' });
}

function urlSearch(req, key) {
  try {
    const url = new URL(req.url, 'http://internal');
    return url.searchParams.get(key);
  } catch (e) {
    return null;
  }
}

module.exports = { createApp: createApp, sendJson: sendJson, serveStatic: serveStatic };
