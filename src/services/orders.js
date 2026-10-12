'use strict';

const crypto = require('node:crypto');
const config = require('../config');
const { normalizeOrderPayload } = require('../utils/validation');
const { ApiError, ValidationError, friendlyVeopagMessage } = require('../utils/errors');
const status = require('./orderStatus');

function newOrderId() {
  return 'ord_' + crypto.randomBytes(6).toString('hex');
}

function parseOrderId(value) {
  const raw = String(value || '').trim();
  if (/^ord_[0-9a-f]{6,32}$/i.test(raw)) return { type: 'id', value: raw };
  if (/^\d{1,9}$/.test(raw)) return { type: 'number', value: Number(raw) };
  return null;
}

async function findOrder(db, value) {
  const parsed = parseOrderId(value);
  if (!parsed) return null;
  return parsed.type === 'id' ? await db.getOrderById(parsed.value) : await db.getOrderByNumber(parsed.value);
}

function centsToReais(cents) {
  return Number((cents / 100).toFixed(2));
}

function itemView(item) {
  return {
    productId: item.productId,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: item.lineTotalCents,
    options: item.options.map((o) => ({ name: o.name, quantity: o.quantity, priceCents: o.priceCents })),
    complements: item.complements.map((c) => ({
      name: c.name,
      quantity: c.quantity,
      priceCents: c.priceCents
    })),
    observations: item.observations
  };
}

function getView(db, order) {
  const items = JSON.parse(order.items);
  const address = order.address ? JSON.parse(order.address) : null;

  const view = {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    fulfillment: order.fulfillment,
    customer: {
      name: order.customer_name,
      phone: order.customer_phone
    },
    address: address,
    items: items.map(itemView),
    subtotalCents: order.subtotal_cents,
    deliveryFeeCents: order.delivery_fee_cents,
    totalCents: order.total_cents,
    total: centsToReais(order.total_cents),
    currency: order.currency,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    paidAt: order.paid_at || null,
    expiresAt: order.expires_at || null,
    preparoEstimado: config.orders.preparoEstimado
  };

  if (order.status !== status.STATUS.PAYMENT_FAILED) {
    view.pix = order.pix_code
      ? { code: order.pix_code, expiresAt: order.pix_expires_at || order.expires_at }
      : null;
  } else {
    view.errorMessage = order.error_message || 'Nao foi possivel gerar o Pix.';
  }

  return view;
}

function getPaymentStatusView(order) {
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: status.paymentLabel(order.payment_status),
    orderStatus: order.status,
    expiresAt: order.expires_at || null,
    paidAt: order.paid_at || null
  };
}

function depositToEvent(deposit, fallbackExternalId) {
  if (!deposit) return null;
  return {
    externalId: deposit.external_id || fallbackExternalId,
    status: deposit.status,
    transactionId: deposit.transaction_id || deposit.transactionId || null,
    txid: deposit.txid || null,
    endToEnd: deposit.end_to_end || deposit.endToEnd || null,
    amountCents: deposit.amount !== undefined && deposit.amount !== null
      ? Math.round(Number(deposit.amount) * 100)
      : null,
    currency: deposit.currency || 'BRL',
    payerName: deposit.payer_name || deposit.payerName || null,
    errorMessage: deposit.error_message || null,
    source: 'consulta'
  };
}

async function refreshFromVeoPag(deps, order) {
  const deposit = await deps.veopag.getDepositBy({ external_id: order.external_id });
  if (deposit) {
    await status.applyPaymentEvent(deps.db, order, depositToEvent(deposit, order.external_id));
  }
  await deps.db.updateOrder(order.id, { last_remote_check: Date.now(), updated_at: deps.db.now() });
  return await deps.db.getOrderById(order.id);
}

async function chargeOrder(deps, order) {
  const { db, veopag } = deps;
  try {
    const result = await veopag.createDeposit({
      amountCents: order.total_cents,
      externalId: order.external_id,
      callbackUrl: config.veopag.callbackUrl,
      payer: {
        name: order.customer_name,
        email: order.customer_email || undefined,
        document: order.customer_document || undefined
      }
    });

    const now = db.now();
    await db.updateOrder(order.id, {
      status: status.STATUS.PIX_GENERATED,
      payment_status: status.PAYMENT.PENDING,
      pix_code: result.pixCode || null,
      transaction_id: result.transactionId || null,
      error_message: null,
      updated_at: now
    });
    await db.audit(order.id, 'pix_generated', 'transaction=' + (result.transactionId || '-'));
    return await db.getOrderById(order.id);
  } catch (err) {
    const friendly = friendlyVeopagMessage(err);
    await db.updateOrder(order.id, {
      status: status.STATUS.PAYMENT_FAILED,
      payment_status: status.PAYMENT.FAILED,
      error_message: friendly,
      updated_at: db.now()
    });
    await db.audit(order.id, 'pix_generation_failed', (err && err.message) || 'erro desconhecido');
    deps.logger.error('veopag createDeposit falhou para ' + order.id + ': ' + ((err && err.message) || err));
    throw new ApiError(502, friendly, 'PAYMENT_GATEWAY_ERROR');
  }
}

async function createOrder(deps, body) {
  const { db, logger } = deps;

  const normalized = normalizeOrderPayload(body, db.catalog, {
    requirePayerDocument: config.security.requirePayerDocument,
    deliveryFeeCents: config.orders.deliveryFeeCents
  });

  if (normalized.totalCents < config.orders.minPixCents) {
    throw new ValidationError(
      [{ field: 'items', message: 'Valor minimo para pagamento Pix: R$ 1,00' }],
      'Valor minimo para pagamento Pix: R$ 1,00'
    );
  }

  // idempotencia do frontend: mesmo clientRequestId devolve o mesmo pedido
  if (normalized.clientRequestId) {
    const existing = await db.getOrderByClientRequestId(normalized.clientRequestId);
    if (existing) {
      if (
        existing.status === status.STATUS.PAYMENT_FAILED ||
        existing.status === status.STATUS.EXPIRED
      ) {
        const charged = await chargeOrder(deps, existing);
        return { order: charged, replayed: true };
      }
      if (existing.pix_code || existing.payment_status === status.PAYMENT.PAID) {
        return { order: existing, replayed: true };
      }
      const charged = await chargeOrder(deps, existing);
      return { order: charged, replayed: true };
    }
  }

  const id = newOrderId();
  const expiresAt = new Date(Date.now() + config.orders.expiryMinutes * 60000).toISOString();

  const order = await db.insertOrder({
    id: id,
    order_number: 0,
    external_id: 'flowburguer-order-' + id,
    client_request_id: normalized.clientRequestId || null,
    status: status.STATUS.PENDING_PAYMENT,
    payment_status: status.PAYMENT.PENDING,
    fulfillment: normalized.fulfillment,
    customer_name: normalized.customer.name,
    customer_phone: normalized.customer.phone,
    customer_email: normalized.customer.email || null,
    customer_document: normalized.customer.document || null,
    address: normalized.address,
    items: normalized.items,
    subtotal_cents: normalized.subtotalCents,
    delivery_fee_cents: normalized.deliveryFeeCents,
    total_cents: normalized.totalCents,
    expires_at: expiresAt,
    created_at: db.now(),
    updated_at: db.now()
  });

  // order_number acompanha o autoincremento (seq)
  await db.updateOrder(order.id, { order_number: order.seq, updated_at: db.now() });
  await db.audit(order.id, 'order_created', 'total=' + normalized.totalCents);

  logger.info(
    'pedido criado ' + order.id + ' (#' + order.order_number + ') total R$ ' +
      centsToReais(normalized.totalCents).toFixed(2)
  );

  const charged = await chargeOrder(deps, order);
  return { order: charged, replayed: false };
}

async function getPaymentStatus(deps, orderId, options) {
  const opts = options || {};
  const db = deps.db;
  let order = await findOrder(db, orderId);
  if (!order) throw new ApiError(404, 'Pedido nao encontrado', 'NOT_FOUND');

  const expired = await status.expireOrderIfNeeded(db, order);
  if (expired.changed) order = await db.getOrderById(order.id);

  const pending = !status.isPaymentFinal(order.payment_status);
  const staleRemote =
    !order.last_remote_check || Date.now() - order.last_remote_check >= config.orders.remoteCheckMinMs;

  let remoteChecked = false;
  if (pending && opts.allowRemote !== false && staleRemote) {
    try {
      order = await refreshFromVeoPag(deps, order);
      remoteChecked = true;
    } catch (err) {
      deps.logger.warn('consulta VeoPag falhou para ' + order.id + ': ' + ((err && err.message) || err));
    }
  }

  return { order: order, remoteChecked: remoteChecked, view: getPaymentStatusView(order) };
}

async function getOrder(deps, orderId) {
  const order = await findOrder(deps.db, orderId);
  if (!order) throw new ApiError(404, 'Pedido nao encontrado', 'NOT_FOUND');
  return order;
}

module.exports = {
  newOrderId: newOrderId,
  parseOrderId: parseOrderId,
  findOrder: findOrder,
  getView: getView,
  getPaymentStatusView: getPaymentStatusView,
  depositToEvent: depositToEvent,
  refreshFromVeoPag: refreshFromVeoPag,
  chargeOrder: chargeOrder,
  createOrder: createOrder,
  getPaymentStatus: getPaymentStatus,
  getOrder: getOrder,
  centsToReais: centsToReais
};
