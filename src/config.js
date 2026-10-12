'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SERVER_DIR = path.resolve(__dirname, '..');

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(path.join(SERVER_DIR, '.env'));

function str(key, fallback) {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

function int(key, fallback) {
  const v = parseInt(process.env[key], 10);
  return Number.isFinite(v) ? v : fallback;
}

function bool(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'sim';
}

function list(key) {
  const v = str(key, '');
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toCents(reais) {
  return Math.round(Number(reais) * 100);
}

const config = {
  env: str('NODE_ENV', 'production'),
  isTest: process.env.NODE_ENV === 'test',

  veopag: {
    baseUrl: str('VEOPAG_BASE_URL', 'https://api.veopag.com').replace(/\/+$/, ''),
    clientId: str('VEOPAG_CLIENT_ID', ''),
    clientSecret: str('VEOPAG_CLIENT_SECRET', ''),
    webhookSecret: str('VEOPAG_WEBHOOK_SECRET', ''),
    callbackToken: str('VEOPAG_CALLBACK_TOKEN', ''),
    callbackUrl: str('VEOPAG_CALLBACK_URL', ''),
    timeoutMs: int('VEOPAG_TIMEOUT_MS', 8000),
    tokenTtlMs: 55 * 60 * 1000
  },

  server: {
    port: int('PORT', 4017),
    host: str('HOST', '127.0.0.1'),
    staticDir: str('STATIC_DIR', SERVER_DIR),
    appUrl: str('APP_URL', ''),
    corsOrigins: list('CORS_ORIGINS'),
    trustProxy: bool('TRUST_PROXY', false),
    bodyLimitBytes: 256 * 1024
  },

  db: {
    url: str('DATABASE_URL', path.join(SERVER_DIR, 'data', 'flowburger.db'))
  },

  security: {
    adminToken: str('ADMIN_TOKEN', ''),
    requirePayerDocument: bool('REQUIRE_PAYER_DOCUMENT', false)
  },

  orders: {
    expiryMinutes: int('ORDER_EXPIRY_MINUTES', 30),
    deliveryFeeCents: toCents(str('DELIVERY_FEE', '0')),
    preparoEstimado: str('PREPARO_ESTIMADO', '30 a 40 minutos'),
    minPixCents: int('MIN_PIX_CENTS', 100),
    remoteCheckMinMs: int('REMOTE_CHECK_MIN_MS', 15000)
  },

  log: {
    level: str('LOG_LEVEL', 'info')
  },

  paths: {
    serverDir: SERVER_DIR,
    siteDir: SERVER_DIR
  }
};

module.exports = config;
