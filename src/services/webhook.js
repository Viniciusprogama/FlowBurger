'use strict';

const crypto = require('node:crypto');
const config = require('../config');
const orders = require('./orders');
const status = require('./orderStatus');

const TOLERANCE_SECONDS = 300;

function headerValue(headers, name) {
  const value = headers[name] || headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value === undefined || value === null ? '' : String(value);
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function computeSignature(secret, timestamp, rawBody) {
  return crypto.createHmac('sha256', secret).update(String(timestamp) + '.' + rawBody).digest('hex');
}

// X-Webhook-Signature = HMAC_SHA256(secret, `${X-Webhook-Timestamp}.${rawBody}`)
function verifySignature(rawBody, headers, options) {
  const opts = options || {};
  const secret = opts.secret !== undefined ? opts.secret : config.veopag.webhookSecret;
  const nowSeconds = opts.nowSeconds || Math.floor(Date.now() / 1000);

  if (!secret) {
    return { ok: false, reason: 'webhook_secret_nao_configurado' };
  }

  const timestamp = headerValue(headers, 'x-webhook-timestamp');
  const signature = headerValue(headers, 'x-webhook-signature').toLowerCase();

  if (!timestamp || !signature) {
    return { ok: false, reason: 'cabecalhos_de_assinatura_ausentes' };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp_fora_da_janela' };
  }

  const expected = computeSignature(secret, timestamp, rawBody);
  if (!safeEqual(expected, signature)) {
    return { ok: false, reason: 'assinatura_invalida' };
  }

  return { ok: true };
}

function verifyCallbackToken(headers, options) {
  const opts = options || {};
  const expected = opts.token !== undefined ? opts.token : config.veopag.callbackToken;
  if (!expected) return { ok: true, reason: 'nao_configurado' };

  const auth = headerValue(headers, 'authorization');
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match || !safeEqual(match[1].trim(), expected.trim())) {
    return { ok: false, reason: 'token_de_callback_invalido' };
  }
  return { ok: true };
}

function webhookEventKey(payload) {
  const base = payload.transaction_id || payload.external_id || 'sem-identificacao';
  return [base, String(payload.status || '').toUpperCase(), payload.txid || ''].join(':');
}

function payloadToEvent(payload, source) {
  const amount = payload.amount;
  return {
    externalId: payload.external_id || null,
    status: payload.status,
    transactionId: payload.transaction_id || null,
    txid: payload.txid || null,
    endToEnd: payload.end_to_end || null,
    amountCents: amount !== undefined && amount !== null && amount !== '' ? Math.round(Number(amount) * 100) : null,
    currency: payload.currency || 'BRL',
    payerName: payload.payer_name || null,
    errorMessage: payload.error_message || null,
    source: source
  };
}

// Processa o POST bruto do webhook. Sempre responde rapido (2xx quando valido),
// deixando a aplicacao de status sincrona (SQLite local).
function handleWebhook(deps, params) {
  const { db, logger } = deps;
  const rawBody = params.rawBody || '';
  const headers = params.headers || {};

  const tokenCheck = verifyCallbackToken(headers, params);
  if (!tokenCheck.ok) {
    logger.warn('webhook rejeitado: ' + tokenCheck.reason);
    return { status: 401, body: { ok: false, error: 'unauthorized' }, outcome: 'unauthorized' };
  }

  const signatureCheck = verifySignature(rawBody, headers, params);
  if (!signatureCheck.ok) {
    logger.error('webhook assinatura rejeitada: ' + signatureCheck.reason);
    db.audit(null, 'webhook_signature_rejected', signatureCheck.reason);
    return { status: 401, body: { ok: false, error: 'invalid_signature' }, outcome: 'rejected' };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return { status: 400, body: { ok: false, error: 'invalid_json' }, outcome: 'invalid' };
  }

  if (!payload || typeof payload !== 'object') {
    return { status: 400, body: { ok: false, error: 'invalid_payload' }, outcome: 'invalid' };
  }

  if (payload.type && payload.type !== 'Deposit') {
    logger.info('webhook ignorado (type=' + payload.type + ')');
    return { status: 200, body: { ok: true, ignored: true }, outcome: 'ignored' };
  }

  if (!payload.external_id || !payload.status) {
    return { status: 400, body: { ok: false, error: 'missing_fields' }, outcome: 'invalid' };
  }

  const eventInfo = {
    eventKey: webhookEventKey(payload),
    transactionId: payload.transaction_id || null,
    externalId: payload.external_id,
    status: payload.status
  };

  if (db.getEvent(eventInfo.eventKey)) {
    logger.info('webhook duplicado ignorado: ' + eventInfo.eventKey);
    return { status: 200, body: { ok: true, duplicate: true }, outcome: 'duplicate' };
  }

  let order = db.getOrderByExternalId(payload.external_id);
  if (!order && payload.transaction_id) {
    order = db.getOrderByTransactionId(payload.transaction_id);
  }

  if (!order) {
    logger.warn('webhook sem pedido correspondente: external_id=' + payload.external_id);
    db.recordEvent(eventInfo, 'unknown_order', rawBody);
    return { status: 200, body: { ok: true, unknownOrder: true }, outcome: 'unknown_order' };
  }

  const event = payloadToEvent(payload, 'webhook');
  const result = status.applyPaymentEvent(db, order, event);
  const outcome = result.changed ? 'processed' : 'ignored_' + result.reason;
  db.recordEvent(eventInfo, outcome, rawBody);

  logger.info(
    'webhook ' + payload.status + ' para ' + order.id + ' -> ' +
      (result.changed ? 'atualizado' : 'sem mudanca (' + result.reason + ')')
  );

  return {
    status: 200,
    body: { ok: true, orderId: order.id, changed: result.changed, reason: result.reason || null },
    outcome: outcome
  };
}

module.exports = {
  handleWebhook: handleWebhook,
  verifySignature: verifySignature,
  computeSignature: computeSignature,
  verifyCallbackToken: verifyCallbackToken,
  webhookEventKey: webhookEventKey,
  payloadToEvent: payloadToEvent,
  TOLERANCE_SECONDS: TOLERANCE_SECONDS
};
