'use strict';

const http = require('node:http');

// Mock da API VeoPag em porta efimera (ambiente unico, sem sandbox).
// Serve login, criacao de deposito (com idempotencia por external_id) e consulta.
function startMockVeoPag() {
  const state = {
    mode: 'ok',
    loginCount: 0,
    requests: [],
    deposits: new Map()
  };

  function json(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
    res.end(payload);
  }

  function readBody(req) {
    return new Promise((resolve) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://mock');
    const raw = await readBody(req);
    let body = null;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch (e) {
        body = null;
      }
    }

    state.requests.push({
      method: req.method,
      path: url.pathname + url.search,
      auth: req.headers.authorization || '',
      body: body
    });

    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      if (state.mode === 'login500') {
        json(res, 500, { message: 'internal error' });
        return;
      }
      if (!body || !body.client_id || !body.client_secret) {
        json(res, 400, { message: 'Missing required fields.' });
        return;
      }
      state.loginCount += 1;
      json(res, 200, {
        message: 'ok',
        token: 'mock-token-' + state.loginCount,
        user: { id: 1, name: 'Loja Teste', email: 'loja@teste.com' }
      });
      return;
    }

    // endpoints autenticados exigem Bearer
    if (!req.headers.authorization || !/^Bearer\s+mock-token/.test(req.headers.authorization)) {
      json(res, 401, { message: 'Token invalido' });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/payments/deposit') {
      if (state.mode === 'fail500') {
        json(res, 500, { message: 'internal error' });
        return;
      }
      if (state.mode === 'fail401') {
        json(res, 401, { message: 'invalid client' });
        return;
      }
      if (!body || body.amount === undefined || !body.external_id || !body.payer) {
        json(res, 400, { message: 'Missing required fields.', code: 'MISSING_FIELDS' });
        return;
      }
      if (Number(body.amount) < 1) {
        json(res, 403, { message: 'Valor minimo para deposito', min_amount: 1 });
        return;
      }

      const existing = state.deposits.get(body.external_id);
      if (existing && (existing.status === 'PENDING' || existing.status === 'COMPLETED')) {
        json(res, 200, {
          id: existing.id,
          transaction_id: existing.transaction_id,
          external_id: existing.external_id,
          status: existing.status,
          qrcode: existing.qrcode,
          idempotent: true
        });
        return;
      }

      const n = state.deposits.size + 1;
      const deposit = {
        id: 'dep_' + n,
        transaction_id: 'tx_' + n + '_' + Date.now(),
        txid: 'txid' + n,
        external_id: body.external_id,
        amount: Number(body.amount),
        fee: Number((Number(body.amount) * 0.0199).toFixed(2)),
        status: 'PENDING',
        currency: 'BRL',
        payment_method: 'PIX',
        qrcode: '00020126MOCKQRCODE' + n + '6304ABCD',
        end_to_end: null,
        payer_name: body.payer.name
      };
      state.deposits.set(body.external_id, deposit);

      json(res, 201, {
        message: 'Cobranca criada',
        qrCodeResponse: {
          transactionId: deposit.transaction_id,
          status: deposit.status,
          qrcode: deposit.qrcode,
          amount: deposit.amount,
          fee: deposit.fee
        }
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/transactions/deposit') {
      if (state.mode === 'consultaFail') {
        json(res, 500, { message: 'internal error' });
        return;
      }
      const filters = {};
      for (const key of ['end_to_end', 'transaction_id', 'external_id', 'txid']) {
        if (url.searchParams.get(key)) filters[key] = url.searchParams.get(key);
      }
      if (Object.keys(filters).length !== 1) {
        json(res, 400, { message: 'Informe exatamente um filtro' });
        return;
      }

      let found = null;
      for (const deposit of state.deposits.values()) {
        if (filters.external_id && deposit.external_id === filters.external_id) found = deposit;
        if (filters.transaction_id && deposit.transaction_id === filters.transaction_id) found = deposit;
        if (filters.txid && deposit.txid === filters.txid) found = deposit;
        if (filters.end_to_end && deposit.end_to_end === filters.end_to_end) found = deposit;
      }
      json(res, 200, { filters: filters, deposit: found });
      return;
    }

    json(res, 404, { message: 'Not found' });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        url: 'http://127.0.0.1:' + address.port,
        state: state,
        requests: state.requests,
        depositCount: () => state.deposits.size,
        getDeposit: (externalId) => state.deposits.get(externalId) || null,
        setDeposit: (externalId, patch) => {
          const deposit = state.deposits.get(externalId);
          if (deposit) Object.assign(deposit, patch);
          return deposit;
        },
        setMode: (mode) => {
          state.mode = mode;
        },
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          })
      });
    });
  });
}

module.exports = { startMockVeoPag: startMockVeoPag };
