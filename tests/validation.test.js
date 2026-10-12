'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isValidCPF,
  isValidCNPJ,
  isValidDocument,
  formatDocument,
  formatPhone,
  parsePriceToCents,
  cleanText,
  normalizeOrderPayload
} = require('../src/utils/validation');

const catalog = {
  products: [{ id: 4, name: 'Burgão Especial', price: 15.9 }],
  options: [
    { name: 'Ao ponto', prices: [0] },
    { name: 'Batata frita 250g', prices: [8] },
    { name: 'Queijo cheddar extra', prices: [4, 6] }
  ]
};

const cfg = { requirePayerDocument: false, deliveryFeeCents: 0 };

function basePayload() {
  return {
    customer: { name: 'Maria Silva', phone: '(88) 98888-1111', email: 'maria@exemplo.com' },
    fulfillment: 'retirada',
    items: [{ productId: 4, quantity: 1, selectedComplements: [{ name: 'Batata frita 250g', quantity: 1 }] }]
  };
}

test('valida CPF e CNPJ com digitos verificadores', () => {
  assert.equal(isValidCPF('529.982.247-25'), true);
  assert.equal(isValidCPF('52998224726'), false);
  assert.equal(isValidCPF('111.111.111-11'), false);
  assert.equal(isValidCPF('123'), false);

  assert.equal(isValidCNPJ('11.222.333/0001-81'), true);
  assert.equal(isValidCNPJ('11.222.333/0001-80'), false);
  assert.equal(isValidCNPJ('00000000000000'), false);

  assert.equal(isValidDocument('529.982.247-25'), true);
  assert.equal(isValidDocument('11.222.333/0001-81'), true);
  assert.equal(isValidDocument('abc'), false);
});

test('formata documento e telefone no padrao brasileiro', () => {
  assert.equal(formatDocument('52998224725'), '529.982.247-25');
  assert.equal(formatDocument('11222333000181'), '11.222.333/0001-81');
  assert.equal(formatPhone('88999991234'), '(88) 99999-1234');
  assert.equal(formatPhone('8833331234'), '(88) 3333-1234');
});

test('converte precos para centavos sem erro de ponto flutuante', () => {
  assert.equal(parsePriceToCents('R$ 15,90'), 1590);
  assert.equal(parsePriceToCents(15.9), 1590);
  assert.equal(parsePriceToCents('32,9'), 3290);
  assert.equal(parsePriceToCents(47.8), 4780);
  assert.equal(parsePriceToCents('abc'), null);
});

test('cleanText remove quebras/controles e limita tamanho', () => {
  assert.equal(cleanText('  Ola\u0000 mundo \n'), 'Ola mundo');
  assert.equal(cleanText('x'.repeat(500), 10).length, 10);
});

test('normalizeOrderPayload calcula total a partir do catalogo', () => {
  const result = normalizeOrderPayload(basePayload(), catalog, cfg);
  // R$ 15,90 + R$ 8,00
  assert.equal(result.totalCents, 2390);
  assert.equal(result.subtotalCents, 2390);
  assert.equal(result.deliveryFeeCents, 0);
  assert.equal(result.items[0].name, 'Burgão Especial');
});

test('nome com caracteres de controle e normalizado antes de salvar', () => {
  const payload = basePayload();
  payload.customer.name = '  Maria   \u0007 Silva  ';
  const result = normalizeOrderPayload(payload, catalog, cfg);
  assert.equal(result.customer.name, 'Maria Silva');
});

test('pedido sem itens ou com item desconhecido falha', () => {
  const payload = basePayload();
  payload.items = [];
  assert.throws(() => normalizeOrderPayload(payload, catalog, cfg), /vazio|lista/i);

  const payload2 = basePayload();
  payload2.items[0].productId = 999;
  assert.throws(() => normalizeOrderPayload(payload2, catalog, cfg), /nao encontrado/i);
});

test('quantidade invalida falha', () => {
  const payload = basePayload();
  payload.items[0].quantity = 0;
  assert.throws(() => normalizeOrderPayload(payload, catalog, cfg), /Quantidade/i);
});

test('entrega exige endereco completo', () => {
  const payload = basePayload();
  payload.fulfillment = 'entrega';
  assert.throws(() => normalizeOrderPayload(payload, catalog, cfg), /endereco/i);

  payload.address = { rua: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Serra Talhada', estado: 'PE' };
  const result = normalizeOrderPayload(payload, catalog, cfg);
  assert.equal(result.address.city, 'Serra Talhada');
  assert.equal(result.address.state, 'PE');
});

test('documento invalido falha; obrigatorio quando configurado', () => {
  const payload = basePayload();
  payload.customer.document = '111.111.111-11';
  assert.throws(() => normalizeOrderPayload(payload, catalog, cfg), /CPF\/CNPJ/i);

  payload.customer.document = '529.982.247-25';
  const result = normalizeOrderPayload(payload, catalog, cfg);
  assert.equal(result.customer.document, '529.982.247-25');

  const payload2 = basePayload();
  delete payload2.customer.document;
  assert.throws(
    () => normalizeOrderPayload(payload2, catalog, { requirePayerDocument: true }),
    /CPF\/CNPJ/i
  );
});

test('preco do catalogo prevalece e preco de opcao fora do permitido falha', () => {
  const payload = basePayload();
  payload.items[0].selectedComplements = [{ name: 'Queijo cheddar extra', price: 6, quantity: 1 }];
  const result = normalizeOrderPayload(payload, catalog, cfg);
  // dois precos validos (4 e 6): aceita o enviado
  assert.equal(result.totalCents, 1590 + 600);

  const payload2 = basePayload();
  payload2.items[0].selectedComplements = [{ name: 'Queijo cheddar extra', price: 1, quantity: 1 }];
  assert.throws(() => normalizeOrderPayload(payload2, catalog, cfg), /Preco da opcao/i);
});
