'use strict';

const STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PIX_GENERATED: 'PIX_GENERATED',
  PAID: 'PAID',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  DELIVERING: 'DELIVERING',
  COMPLETED: 'COMPLETED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
};

const PAYMENT = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED'
};

// status deposito VeoPag -> efeito no nosso pedido
// PENDING/PROCESSING: aguardando; COMPLETED: pago; FAILED: falhou
const DEPOSIT_MAP = {
  PENDING: { payment: PAYMENT.PENDING, final: false },
  PROCESSING: { payment: PAYMENT.PENDING, final: false },
  COMPLETED: { payment: PAYMENT.PAID, final: true },
  FAILED: { payment: PAYMENT.FAILED, final: true }
};

// Transicoes permitidas do fluxo da loja (pos-pagamento)
const TRANSITIONS = {
  PENDING_PAYMENT: [STATUS.CANCELLED],
  PIX_GENERATED: [STATUS.CANCELLED],
  PAID: [STATUS.PROCESSING, STATUS.CANCELLED],
  PROCESSING: [STATUS.READY, STATUS.CANCELLED],
  READY: [STATUS.DELIVERING, STATUS.CANCELLED],
  DELIVERING: [STATUS.COMPLETED],
  COMPLETED: [],
  PAYMENT_FAILED: [],
  EXPIRED: [],
  CANCELLED: []
};

function allowedTransitions(from) {
  return TRANSITIONS[from] || [];
}

function canTransition(from, to) {
  return allowedTransitions(from).indexOf(to) !== -1;
}

function isPaymentFinal(paymentStatus) {
  return paymentStatus === PAYMENT.PAID || paymentStatus === PAYMENT.FAILED;
}

function mapDepositStatus(status) {
  return DEPOSIT_MAP[String(status || '').toUpperCase()] || null;
}

function paymentLabel(paymentStatus) {
  return paymentStatus === PAYMENT.PAID
    ? 'PAID'
    : paymentStatus === PAYMENT.FAILED
      ? 'FAILED'
      : paymentStatus === PAYMENT.EXPIRED
        ? 'EXPIRED'
        : 'PENDING';
}

function isOrderExpired(order) {
  if (!order.expires_at) return false;
  if (isPaymentFinal(order.payment_status)) return false;
  return new Date(order.expires_at).getTime() <= Date.now();
}

// Aplica um evento de pagamento (webhook ou consulta). Nunca regride de PAID.
// Retorna { changed, reason }.
async function applyPaymentEvent(db, order, event) {
  if (!order) return { changed: false, reason: 'order_not_found' };
  if (event.currency && event.currency !== 'BRL') {
    await db.audit(order.id, 'payment_ignored_currency', event.currency);
    return { changed: false, reason: 'currency' };
  }

  const mapped = mapDepositStatus(event.status);
  if (!mapped) {
    await db.audit(order.id, 'payment_ignored_status', String(event.status));
    return { changed: false, reason: 'unknown_status' };
  }

  if (event.amountCents !== null && event.amountCents !== undefined && event.amountCents !== order.total_cents) {
    await db.audit(
      order.id,
      'payment_amount_mismatch',
      'esperado ' + order.total_cents + ' recebido ' + event.amountCents
    );
    return { changed: false, reason: 'amount_mismatch' };
  }

  if (order.payment_status === PAYMENT.PAID) {
    return { changed: false, reason: 'already_paid' };
  }

  const now = db.now();
  const fields = { updated_at: now };
  let status = order.status;

  if (mapped.payment === PAYMENT.PAID) {
    fields.payment_status = PAYMENT.PAID;
    fields.status = STATUS.PAID;
    fields.paid_at = now;
    status = STATUS.PAID;
    if (event.transactionId && !order.transaction_id) fields.transaction_id = event.transactionId;
    if (event.txid) fields.txid = event.txid;
    if (event.endToEnd) fields.end_to_end = event.endToEnd;
    if (event.payerName) fields.payer_name = event.payerName;
  } else if (mapped.payment === PAYMENT.FAILED) {
    if (order.status === STATUS.PAID) {
      // pagamento confirmado nunca volta atras
      await db.audit(order.id, 'payment_failed_ignored', 'pedido ja estava pago');
      return { changed: false, reason: 'already_paid' };
    }
    fields.payment_status = PAYMENT.FAILED;
    fields.status = STATUS.PAYMENT_FAILED;
    fields.error_message = (event.errorMessage || 'Pagamento recusado').slice(0, 300);
    status = STATUS.PAYMENT_FAILED;
    if (event.transactionId && !order.transaction_id) fields.transaction_id = event.transactionId;
  } else {
    // PENDING: so guarda rastreio, nao muda status interno
    if (event.transactionId && !order.transaction_id) fields.transaction_id = event.transactionId;
    if (event.txid && !order.txid) fields.txid = event.txid;
    if (event.payerName && !order.payer_name) fields.payer_name = event.payerName;
    if (order.status === STATUS.PENDING_PAYMENT && event.transactionId) {
      fields.status = STATUS.PIX_GENERATED;
      status = STATUS.PIX_GENERATED;
    }
  }

  await db.updateOrder(order.id, fields);
  await db.audit(order.id, 'payment_event_' + String(event.status).toUpperCase(), event.source || '');
  return { changed: true, status: status, payment: fields.payment_status || order.payment_status };
}

async function expireOrderIfNeeded(db, order) {
  if (!isOrderExpired(order)) return { changed: false };
  await db.updateOrder(order.id, {
    status: STATUS.EXPIRED,
    payment_status: PAYMENT.EXPIRED,
    updated_at: db.now()
  });
  await db.audit(order.id, 'order_expired', order.expires_at);
  return { changed: true };
}

module.exports = {
  STATUS: STATUS,
  PAYMENT: PAYMENT,
  DEPOSIT_MAP: DEPOSIT_MAP,
  TRANSITIONS: TRANSITIONS,
  allowedTransitions: allowedTransitions,
  canTransition: canTransition,
  mapDepositStatus: mapDepositStatus,
  isPaymentFinal: isPaymentFinal,
  paymentLabel: paymentLabel,
  isOrderExpired: isOrderExpired,
  applyPaymentEvent: applyPaymentEvent,
  expireOrderIfNeeded: expireOrderIfNeeded
};
