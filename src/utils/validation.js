'use strict';

const { ValidationError } = require('./errors');

function cleanText(value, maxLen) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen || 200);
}

function digitsOnly(value) {
  return String(value || '').replace(/\D+/g, '');
}

function isValidCPF(value) {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

function isValidCNPJ(value) {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base) => {
    let weight = base.length - 7;
    let sum = 0;
    for (const ch of base) {
      sum += Number(ch) * weight--;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const d1 = calc(cnpj.slice(0, 12));
  const d2 = calc(cnpj.slice(0, 13));
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

function isValidDocument(value) {
  const doc = digitsOnly(value);
  return doc.length === 11 ? isValidCPF(doc) : doc.length === 14 ? isValidCNPJ(doc) : false;
}

function formatDocument(value) {
  const doc = digitsOnly(value);
  if (doc.length === 11) {
    return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (doc.length === 14) {
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
}

function formatPhone(value) {
  const d = digitsOnly(value);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  if (d.length === 12) return d.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, '+$1 ($2) $3-$4');
  if (d.length === 13) return d.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
  return d;
}

function parsePriceToCents(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  const text = cleanText(value, 20).replace(/\s/g, '');
  if (!text) return null;
  const normalized = text.replace(/R\$/i, '');
  const br = normalized.match(/^(\d+)\,(\d{1,2})$/);
  if (br) return Number(br[1]) * 100 + Number((br[2] + '0').slice(0, 2));
  const en = normalized.match(/^(\d+)\.(\d{1,2})$/);
  if (en) return Number(en[1]) * 100 + Number((en[2] + '0').slice(0, 2));
  const plain = normalized.match(/^\d+$/);
  if (plain) return Number(normalized) * 100;
  return null;
}

function optionListToMap(catalog) {
  const map = Object.create(null);
  for (const option of catalog.options || []) {
    map[option.name] = option.prices;
  }
  return map;
}

function resolveOptionPrice(name, clientPriceCents, optionMap, field) {
  const allowed = optionMap[name];
  if (!allowed) {
    throw new ValidationError([{ field: field, message: 'Opcao desconhecida: ' + name }]);
  }
  if (clientPriceCents === null || clientPriceCents === undefined) {
    return allowed[0] * 100;
  }
  const allowedCents = allowed.map((p) => Math.round(p * 100));
  if (allowedCents.indexOf(clientPriceCents) === -1) {
    throw new ValidationError([
      { field: field, message: 'Preco da opcao "' + name + '" invalido' }
    ]);
  }
  return clientPriceCents;
}

function normalizeEntries(raw, field) {
  if (!raw) return [];
  if (!Array.isArray(raw)) {
    throw new ValidationError([{ field: field, message: field + ' deve ser uma lista' }]);
  }
  if (raw.length > 30) {
    throw new ValidationError([{ field: field, message: field + ' com itens demais' }]);
  }
  return raw;
}

function entryName(entry) {
  if (typeof entry === 'string') return cleanText(entry, 80);
  if (entry && typeof entry === 'object') return cleanText(entry.name, 80);
  return '';
}

function entryPriceCents(entry) {
  if (entry && typeof entry === 'object' && entry.price !== undefined) {
    const cents = parsePriceToCents(entry.price);
    return cents;
  }
  return null;
}

function entryQuantity(entry, fallback) {
  if (entry && typeof entry === 'object' && entry.quantity !== undefined) {
    const qty = parseInt(entry.quantity, 10);
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) {
      throw new ValidationError([{ field: 'quantity', message: 'Quantidade invalida' }]);
    }
    return qty;
  }
  return fallback;
}

function normalizeItems(rawItems, catalog) {
  const list = normalizeEntries(rawItems, 'items');
  if (!list.length) {
    throw new ValidationError([{ field: 'items', message: 'Carrinho vazio' }]);
  }

  const products = Object.create(null);
  for (const product of catalog.products) products[product.id] = product;
  const optionMap = optionListToMap(catalog);

  const items = list.map((raw, index) => {
    const field = 'items[' + index + ']';
    if (!raw || typeof raw !== 'object') {
      throw new ValidationError([{ field: field, message: 'Item invalido' }]);
    }
    const productId = parseInt(raw.productId !== undefined ? raw.productId : raw.id, 10);
    const product = products[productId];
    if (!product) {
      throw new ValidationError([
        { field: field + '.productId', message: 'Produto nao encontrado: ' + productId }
      ]);
    }
    const quantity = parseInt(raw.quantity, 10);
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
      throw new ValidationError([
        { field: field + '.quantity', message: 'Quantidade invalida para ' + product.name }
      ]);
    }

    const rawOptions = raw.selectedOptions || raw.options || [];
    const rawComplements = raw.selectedComplements || raw.complements || [];

    const options = normalizeEntries(rawOptions, field + '.options').map((entry, oi) => {
      const name = entryName(entry);
      const priceCents = resolveOptionPrice(
        name,
        entryPriceCents(entry),
        optionMap,
        field + '.options[' + oi + ']'
      );
      const qty = entryQuantity(entry, 1);
      return { name: name, priceCents: priceCents, quantity: qty };
    });

    const complements = normalizeEntries(rawComplements, field + '.complements').map((entry, ci) => {
      const name = entryName(entry);
      const priceCents = resolveOptionPrice(
        name,
        entryPriceCents(entry),
        optionMap,
        field + '.complements[' + ci + ']'
      );
      const qty = entryQuantity(entry, 1);
      return { name: name, priceCents: priceCents, quantity: qty };
    });

    const observations = cleanText(raw.observations, 300);

    let unitPriceCents = product.price * 100;
    for (const opt of options) unitPriceCents += opt.priceCents * opt.quantity;
    for (const comp of complements) unitPriceCents += comp.priceCents * comp.quantity;

    return {
      productId: product.id,
      name: product.name,
      quantity: quantity,
      unitPriceCents: unitPriceCents,
      lineTotalCents: unitPriceCents * quantity,
      options: options,
      complements: complements,
      observations: observations
    };
  });

  const seen = Object.create(null);
  for (const item of items) {
    const key = item.productId + '|' + item.observations;
    if (seen[key]) {
      seen[key].quantity += item.quantity;
      seen[key].lineTotalCents = seen[key].unitPriceCents * seen[key].quantity;
    } else {
      seen[key] = item;
    }
  }

  return Object.values(seen);
}

function normalizeCustomer(raw, options) {
  const cfg = options || {};
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError([{ field: 'customer', message: 'Dados do cliente obrigatorios' }]);
  }

  const errors = [];
  const name = cleanText(raw.name, 120);
  if (name.length < 2) errors.push({ field: 'customer.name', message: 'Informe o nome' });

  const phoneDigits = digitsOnly(raw.phone);
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    errors.push({ field: 'customer.phone', message: 'Telefone invalido' });
  }

  const email = cleanText(raw.email, 160).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.push({ field: 'customer.email', message: 'E-mail invalido' });
  }

  const rawDocument = digitsOnly(raw.document || raw.cpf || raw.cnpj);
  let document = '';
  if (rawDocument) {
    if (!isValidDocument(rawDocument)) {
      errors.push({ field: 'customer.document', message: 'CPF/CNPJ invalido' });
    } else {
      document = formatDocument(rawDocument);
    }
  } else if (cfg.requirePayerDocument) {
    errors.push({ field: 'customer.document', message: 'Informe o CPF/CNPJ do pagador' });
  }

  if (errors.length) throw new ValidationError(errors);

  return {
    name: name,
    phone: formatPhone(phoneDigits),
    phoneDigits: phoneDigits,
    email: email,
    document: document,
    documentDigits: rawDocument
  };
}

function normalizeAddress(raw, fulfillment) {
  if (fulfillment !== 'entrega') return null;
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError([{ field: 'address', message: 'Informe o endereco de entrega' }]);
  }

  const errors = [];
  const street = cleanText(raw.rua || raw.street, 140);
  const number = cleanText(raw.numero || raw.number, 20);
  const complement = cleanText(raw.complemento || raw.complement, 80);
  const district = cleanText(raw.bairro || raw.district, 80);
  const city = cleanText(raw.cidade || raw.city, 80);
  const state = cleanText(raw.estado || raw.state, 40).toUpperCase().slice(0, 40);
  const cep = digitsOnly(raw.cep);
  const reference = cleanText(raw.referencia || raw.reference, 140);

  if (street.length < 3) errors.push({ field: 'address.rua', message: 'Informe a rua' });
  if (!number) errors.push({ field: 'address.numero', message: 'Informe o numero' });
  if (!district) errors.push({ field: 'address.bairro', message: 'Informe o bairro' });
  if (!city) errors.push({ field: 'address.cidade', message: 'Informe a cidade' });
  if (!state) errors.push({ field: 'address.estado', message: 'Informe o estado' });
  if (cep && cep.length !== 8) errors.push({ field: 'address.cep', message: 'CEP invalido' });

  if (errors.length) throw new ValidationError(errors);

  return {
    street: street,
    number: number,
    complement: complement,
    district: district,
    city: city,
    state: state,
    cep: cep,
    reference: reference
  };
}

function normalizeOrderPayload(body, catalog, cfg) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError([{ field: 'body', message: 'Corpo da requisicao invalido' }]);
  }

  const fulfillment = cleanText(body.fulfillment || body.delivery, 20).toLowerCase();
  if (fulfillment !== 'entrega' && fulfillment !== 'retirada') {
    throw new ValidationError([{ field: 'fulfillment', message: 'Selecione entrega ou retirada' }]);
  }

  const customer = normalizeCustomer(body.customer, {
    requirePayerDocument: !!cfg.requirePayerDocument
  });
  const address = normalizeAddress(body.address, fulfillment);
  const items = normalizeItems(body.items, catalog);

  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const deliveryFeeCents = fulfillment === 'entrega' ? cfg.deliveryFeeCents : 0;
  const totalCents = subtotalCents + deliveryFeeCents;

  const clientRequestId = cleanText(body.clientRequestId, 80);

  return {
    clientRequestId: clientRequestId,
    fulfillment: fulfillment,
    customer: customer,
    address: address,
    items: items,
    subtotalCents: subtotalCents,
    deliveryFeeCents: deliveryFeeCents,
    totalCents: totalCents
  };
}

module.exports = {
  cleanText: cleanText,
  digitsOnly: digitsOnly,
  isValidCPF: isValidCPF,
  isValidCNPJ: isValidCNPJ,
  isValidDocument: isValidDocument,
  formatDocument: formatDocument,
  formatPhone: formatPhone,
  parsePriceToCents: parsePriceToCents,
  normalizeCustomer: normalizeCustomer,
  normalizeAddress: normalizeAddress,
  normalizeItems: normalizeItems,
  normalizeOrderPayload: normalizeOrderPayload
};
