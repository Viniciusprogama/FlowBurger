'use strict';

class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || null;
    this.details = details || null;
  }

  toJSON() {
    const body = { message: this.message };
    if (this.code) body.code = this.code;
    if (this.details) body.details = this.details;
    return body;
  }
}

class ValidationError extends ApiError {
  constructor(details, message) {
    const first = Array.isArray(details) && details[0] ? details[0].message : null;
    super(422, message || first || 'Dados invalidos', 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends ApiError {
  constructor(message) {
    super(404, message || 'Recurso nao encontrado', 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// Erros vindos da API VeoPag (nao vazar detalhes internos para o cliente)
class VeoPagError extends Error {
  constructor(status, message, code, body) {
    super(message);
    this.name = 'VeoPagError';
    this.status = status;
    this.code = code || null;
    this.body = body || null;
    this.retryable = status >= 500 || status === 429 || status === 0;
  }
}

const FRIENDLY_VEOPAG = [
  { match: /limite/i, message: 'O valor do pedido ultrapassa o limite diario de recebimento Pix.' },
  { match: /minimo|minimum|amount/i, message: 'O valor minimo para pagamento Pix nao foi atingido.' },
  { match: /credenciais|unauthorized|invalid client|token/i, message: 'Falha temporaria no gateway de pagamento. Tente novamente em instantes.' },
  { match: /documento|document|cpf|cnpj/i, message: 'Informe um CPF/CNPJ valido para gerar o Pix.' },
  { match: /rate|too many|429/i, message: 'Muitas tentativas. Aguarde alguns segundos e tente de novo.' }
];

function friendlyVeopagMessage(err) {
  const text = (err && err.message) || '';
  for (const rule of FRIENDLY_VEOPAG) {
    if (rule.match.test(text)) return rule.message;
  }
  if (err && err.status >= 500) {
    return 'O gateway de pagamento esta instavel no momento. Tente novamente.';
  }
  return 'Nao foi possivel gerar o QR Code Pix no momento. Tente novamente.';
}

module.exports = {
  ApiError: ApiError,
  ValidationError: ValidationError,
  NotFoundError: NotFoundError,
  VeoPagError: VeoPagError,
  friendlyVeopagMessage: friendlyVeopagMessage
};
