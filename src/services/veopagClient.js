'use strict';

const { VeoPagError } = require('../utils/errors');

const DEFAULTS = {
  maxAttempts: 3,
  backoffMs: 200,
  maxBackoffMs: 2000
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function amountFromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

class VeoPagClient {
  constructor(options) {
    const opts = options || {};
    this.baseUrl = String(opts.baseUrl || '').replace(/\/+$/, '');
    this.clientId = opts.clientId || '';
    this.clientSecret = opts.clientSecret || '';
    this.callbackUrl = opts.callbackUrl || '';
    this.timeoutMs = opts.timeoutMs || 8000;
    this.tokenTtlMs = opts.tokenTtlMs || 55 * 60 * 1000;
    this.maxAttempts = opts.maxAttempts || DEFAULTS.maxAttempts;
    this.backoffMs = opts.backoffMs === undefined ? DEFAULTS.backoffMs : opts.backoffMs;
    this.maxBackoffMs = opts.maxBackoffMs || DEFAULTS.maxBackoffMs;
    this.logger = opts.logger || { debug() {}, info() {}, warn() {}, error() {} };
    this.fetchImpl = opts.fetchImpl || globalThis.fetch;

    this._token = null;
    this._tokenExpiresAt = 0;
    this._tokenPromise = null;
    this._stats = { logins: 0, requests: 0, retries: 0 };
  }

  _headers(token) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  }

  async _login() {
    if (!this.clientId || !this.clientSecret) {
      throw new VeoPagError(0, 'Credenciais VeoPag nao configuradas (VEOPAG_CLIENT_ID/VEOPAG_CLIENT_SECRET)', 'CONFIG_MISSING');
    }

    const body = JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret });
    const result = await this._httpFetch('/api/auth/login', {
      method: 'POST',
      headers: Object.assign(this._headers(null), { 'Content-Type': 'application/json' }),
      body: body,
      authenticated: false,
      attempts: 2
    });

    const payload = result.payload || {};
    const token = payload.token || payload.access_token;
    if (!token) {
      throw new VeoPagError(result.status, 'Resposta de login sem token', 'LOGIN_NO_TOKEN', payload);
    }

    this._token = token;
    this._tokenExpiresAt = Date.now() + this.tokenTtlMs;
    this._stats.logins += 1;
    this.logger.info('veopag: login realizado (token expira em ' + Math.round(this.tokenTtlMs / 60000) + ' min)');
    return token;
  }

  getToken() {
    if (this._token && Date.now() < this._tokenExpiresAt - 30000) {
      return Promise.resolve(this._token);
    }
    if (!this._tokenPromise) {
      this._tokenPromise = this._login()
        .catch((err) => {
          this._token = null;
          this._tokenExpiresAt = 0;
          throw err;
        })
        .finally(() => {
          this._tokenPromise = null;
        });
    }
    return this._tokenPromise;
  }

  invalidateToken() {
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  async _httpFetch(pathname, options) {
    const url = this.baseUrl + pathname;
    const attempts = options.attempts || this.maxAttempts;
    const isAuth = options.authenticated !== false;
    let lastError = null;
    let retriedAuth = false;

    for (let attempt = 0; attempt < attempts; attempt++) {
      let token = null;
      if (isAuth) {
        try {
          token = await this.getToken();
        } catch (err) {
          throw err;
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      this._stats.requests += 1;

      let response;
      try {
        response = await this.fetchImpl(url, {
          method: options.method || 'GET',
          headers: Object.assign(this._headers(token), options.headers || {}),
          body: options.body,
          signal: controller.signal
        });
      } catch (err) {
        clearTimeout(timer);
        lastError = new VeoPagError(
          0,
          err && err.name === 'AbortError'
            ? 'Timeout na chamada a VeoPag'
            : 'Falha de rede na chamada a VeoPag',
          'NETWORK_ERROR'
        );
        this.logger.warn('veopag: tentativa ' + (attempt + 1) + ' falhou: ' + lastError.message);
        await this._waitBackoff(attempt);
        continue;
      } finally {
        clearTimeout(timer);
      }

      const text = await response.text().catch(() => '');
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch (e) {
          payload = { raw: text.slice(0, 500) };
        }
      }

      const status = response.status;

      if (status === 401 && isAuth && !retriedAuth) {
        retriedAuth = true;
        this.invalidateToken();
        this.logger.warn('veopag: 401 recebido, renovando token e tentando de novo');
        continue;
      }

      if (status >= 200 && status < 300) {
        return { status: status, payload: payload, headers: response.headers };
      }

      const message =
        (payload && (payload.message || payload.error)) ||
        response.statusText ||
        'Erro HTTP ' + status;
      const code = payload && (payload.code || payload.error_code) || null;
      const error = new VeoPagError(status, String(message), code, payload);

      const retryable = status >= 500 || status === 429;
      if (retryable && attempt < attempts - 1) {
        const retryAfter = payload && Number(payload.retry_after_seconds);
        this.logger.warn(
          'veopag: HTTP ' + status + ' na tentativa ' + (attempt + 1) + ', repetindo'
        );
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          await sleep(Math.min(retryAfter * 1000, this.maxBackoffMs));
        } else {
          await this._waitBackoff(attempt);
        }
        continue;
      }

      throw error;
    }

    throw lastError || new VeoPagError(0, 'Falha ao chamar VeoPag', 'UNKNOWN');
  }

  async _waitBackoff(attempt) {
    this._stats.retries += 1;
    const delay = Math.min(this.backoffMs * Math.pow(2, attempt), this.maxBackoffMs);
    if (delay > 0) await sleep(delay);
  }

  _loginPath() {
    return '/api/auth/login';
  }

  // POST /api/payments/deposit
  // amount em reais; external_id e chave de idempotencia.
  async createDeposit(params) {
    const payer = params.payer || {};
    const body = {
      amount: amountFromCents(params.amountCents),
      external_id: params.externalId
    };
    if (params.callbackUrl || this.callbackUrl) {
      body.clientCallbackUrl = params.callbackUrl || this.callbackUrl;
    }

    const payerPayload = { name: payer.name };
    if (payer.email) payerPayload.email = payer.email;
    if (payer.document) payerPayload.document = payer.document;
    if (payer.phone) payerPayload.phone = payer.phone;
    body.payer = payerPayload;

    const result = await this._httpFetch('/api/payments/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const payload = result.payload || {};
    const qr = payload.qrCodeResponse || payload;

    return {
      httpStatus: result.status,
      idempotent: payload.idempotent === true,
      transactionId: qr.transactionId || qr.transaction_id || payload.transaction_id || null,
      status: qr.status || payload.status || null,
      pixCode: qr.qrcode || payload.qrcode || null,
      amountCents: qr.amount !== undefined ? Math.round(Number(qr.amount) * 100) : null,
      feeCents: qr.fee !== undefined ? Math.round(Number(qr.fee) * 100) : null,
      raw: payload
    };
  }

  // GET /api/transactions/deposit?external_id=... (exatamente um filtro)
  async getDepositBy(filters) {
    const allowed = ['end_to_end', 'transaction_id', 'external_id', 'txid'];
    const chosen = allowed.filter((key) => filters && filters[key]);
    if (chosen.length !== 1) {
      throw new VeoPagError(0, 'Informe exatamente um filtro de consulta', 'INVALID_FILTER');
    }

    const query = chosen[0] + '=' + encodeURIComponent(filters[chosen[0]]);
    const result = await this._httpFetch('/api/transactions/deposit?' + query, {
      method: 'GET'
    });

    const payload = result.payload || {};
    return payload.deposit || null;
  }

  stats() {
    return Object.assign({}, this._stats);
  }
}

module.exports = { VeoPagClient: VeoPagClient, amountFromCents: amountFromCents };
