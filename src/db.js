'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  order_number INTEGER NOT NULL,
  external_id TEXT NOT NULL UNIQUE,
  client_request_id TEXT UNIQUE,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  fulfillment TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_document TEXT,
  address TEXT,
  items TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  delivery_fee_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  pix_code TEXT,
  pix_expires_at TEXT,
  transaction_id TEXT,
  txid TEXT,
  end_to_end TEXT,
  payer_name TEXT,
  paid_at TEXT,
  expires_at TEXT,
  last_remote_check INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_key TEXT PRIMARY KEY,
  transaction_id TEXT,
  external_id TEXT,
  status TEXT,
  outcome TEXT NOT NULL,
  payload TEXT,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT,
  event TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
`;

let instance = null;

function resolveDbPath(url) {
  if (!url || url === ':memory:') return ':memory:';
  let clean = url.startsWith('file:') ? url.slice(5) : url;
  if (!path.isAbsolute(clean)) clean = path.resolve(config.paths.serverDir, clean);
  fs.mkdirSync(path.dirname(clean), { recursive: true });
  return clean;
}

function nowIso() {
  return new Date().toISOString();
}

function loadCatalog() {
  const file = path.join(__dirname, 'db', 'catalog.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    generatedAt: raw.generatedAt,
    products: raw.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      priceCents: Math.round(p.price * 100)
    })),
    options: raw.options.map((o) => ({ name: o.name, prices: o.prices }))
  };
}

function open(options) {
  const opts = options || {};
  const dbPath = resolveDbPath(opts.url || config.db.url);
  const db = new DatabaseSync(dbPath);

  db.exec('PRAGMA foreign_keys = ON');
  if (dbPath !== ':memory:') {
    try {
      db.exec('PRAGMA journal_mode = WAL');
    } catch (e) {
      /* WAL opcional */
    }
  }

  db.exec(SCHEMA);
  const row = db.prepare('PRAGMA user_version').get();
  const current = row ? row.user_version : 0;
  if (current < SCHEMA_VERSION) {
    db.exec('PRAGMA user_version = ' + SCHEMA_VERSION);
  }

  const catalog = opts.catalog || loadCatalog();

  const stmts = {
    insertOrder: db.prepare(
      `INSERT INTO orders (
        id, order_number, external_id, client_request_id, status, payment_status,
        fulfillment, customer_name, customer_phone, customer_email, customer_document,
        address, items, subtotal_cents, delivery_fee_cents, total_cents, currency,
        pix_code, pix_expires_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    selectById: db.prepare('SELECT * FROM orders WHERE id = ?'),
    selectByClientRequestId: db.prepare('SELECT * FROM orders WHERE client_request_id = ?'),
    selectByExternalId: db.prepare('SELECT * FROM orders WHERE external_id = ?'),
    selectByNumber: db.prepare('SELECT * FROM orders WHERE order_number = ?'),
    selectByTransactionId: db.prepare('SELECT * FROM orders WHERE transaction_id = ?'),
    listOrders: db.prepare(
      'SELECT * FROM orders ORDER BY seq DESC LIMIT ?'
    ),
    listOrdersByStatus: db.prepare(
      'SELECT * FROM orders WHERE status = ? ORDER BY seq DESC LIMIT ?'
    ),
    listPendingReconcile: db.prepare(
      `SELECT * FROM orders
       WHERE payment_status = 'PENDING'
         AND status IN ('PENDING_PAYMENT', 'PIX_GENERATED')
         AND (last_remote_check IS NULL OR last_remote_check <= ?)
       ORDER BY seq ASC LIMIT ?`
    ),
    listExpiredPending: db.prepare(
      `SELECT * FROM orders
       WHERE payment_status = 'PENDING'
         AND expires_at IS NOT NULL AND expires_at <= ?
       ORDER BY seq ASC LIMIT ?`
    ),
    updateOrder: null,
    insertEvent: db.prepare(
      `INSERT OR IGNORE INTO webhook_events
        (event_key, transaction_id, external_id, status, outcome, payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ),
    selectEvent: db.prepare('SELECT * FROM webhook_events WHERE event_key = ?'),
    insertAudit: db.prepare(
      'INSERT INTO audit_log (order_id, event, detail, created_at) VALUES (?, ?, ?, ?)'
    )
  };

  // gerencia UPDATE dinamico de campos permitidos
  function updateOrder(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return 0;
    const allowed = new Set([
      'status',
      'payment_status',
      'order_number',
      'client_request_id',
      'pix_code',
      'pix_expires_at',
      'transaction_id',
      'txid',
      'end_to_end',
      'payer_name',
      'paid_at',
      'expires_at',
      'last_remote_check',
      'error_message',
      'customer_document',
      'updated_at'
    ]);
    const cols = [];
    const values = [];
    for (const key of keys) {
      if (!allowed.has(key)) throw new Error('campo nao permitido em updateOrder: ' + key);
      cols.push(key + ' = ?');
      values.push(fields[key]);
    }
    values.push(id);
    const result = db.prepare('UPDATE orders SET ' + cols.join(', ') + ' WHERE id = ?').run(...values);
    return Number(result.changes);
  }

  function insertOrder(data) {
    const createdAt = data.created_at || nowIso();
    stmts.insertOrder.run(
      data.id,
      data.order_number,
      data.external_id,
      data.client_request_id || null,
      data.status,
      data.payment_status || 'PENDING',
      data.fulfillment,
      data.customer_name,
      data.customer_phone || null,
      data.customer_email || null,
      data.customer_document || null,
      data.address ? JSON.stringify(data.address) : null,
      JSON.stringify(data.items),
      data.subtotal_cents,
      data.delivery_fee_cents,
      data.total_cents,
      data.currency || 'BRL',
      data.pix_code || null,
      data.pix_expires_at || null,
      data.expires_at || null,
      createdAt,
      createdAt
    );
    return stmts.selectByExternalId.get(data.external_id);
  }

  function audit(orderId, event, detail) {
    stmts.insertAudit.run(orderId, event, detail ? String(detail).slice(0, 2000) : null, nowIso());
  }

  function recordEvent(info, outcome, payload) {
    const key = info.eventKey;
    const result = stmts.insertEvent.run(
      key,
      info.transactionId || null,
      info.externalId || null,
      info.status || null,
      outcome,
      payload ? String(payload).slice(0, 4000) : null,
      nowIso()
    );
    return Number(result.changes) > 0;
  }

  return {
    db: db,
    path: dbPath,
    catalog: catalog,
    now: nowIso,
    insertOrder: insertOrder,
    updateOrder: updateOrder,
    audit: audit,
    recordEvent: recordEvent,
    getOrderById: (id) => stmts.selectById.get(id),
    getOrderByClientRequestId: (value) => stmts.selectByClientRequestId.get(value),
    getOrderByExternalId: (value) => stmts.selectByExternalId.get(value),
    getOrderByNumber: (number) => stmts.selectByNumber.get(Number(number)),
    getOrderByTransactionId: (value) => stmts.selectByTransactionId.get(value),
    listOrders: (limit) => stmts.listOrders.all(Math.min(Number(limit) || 50, 200)),
    listOrdersByStatus: (status, limit) =>
      stmts.listOrdersByStatus.all(status, Math.min(Number(limit) || 50, 200)),
    listPendingReconcile: (olderThanMs, limit) =>
      stmts.listPendingReconcile.all(Number(olderThanMs) || 0, Math.min(Number(limit) || 10, 50)),
    listExpiredPending: (nowIsoValue, limit) =>
      stmts.listExpiredPending.all(nowIsoValue, Math.min(Number(limit) || 10, 50)),
    getEvent: (key) => stmts.selectEvent.get(key),
    close: () => db.close()
  };
}

function getDb() {
  if (!instance) instance = open();
  return instance;
}

function setDb(db) {
  instance = db;
}

function closeDb() {
  if (instance) {
    instance.close();
    instance = null;
  }
}

module.exports = { getDb: getDb, setDb: setDb, closeDb: closeDb, open: open, loadCatalog: loadCatalog };
