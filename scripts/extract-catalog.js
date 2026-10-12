#!/usr/bin/env node
'use strict';

// Extrai o catalogo real do site (produtos do index.html + precos de
// opcoes/complementos de js/modal-personalizacao.js) e grava src/db/catalog.json.
// Uso: node scripts/extract-catalog.js   (rodar de server/)

const fs = require('node:fs');
const path = require('node:path');

const SERVER_DIR = path.resolve(__dirname, '..');
const SITE_DIR = path.resolve(SERVER_DIR, '..', 'www.flowburger.shop');
const INDEX_FILE = path.join(SITE_DIR, 'index.html');
const MODAL_FILE = path.join(SITE_DIR, 'js', 'modal-personalizacao.js');
const OUT_FILE = path.join(SERVER_DIR, 'src', 'db', 'catalog.json');

function fail(msg) {
  console.error('[extract-catalog] ERRO: ' + msg);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail('arquivo nao encontrado: ' + file);
  return fs.readFileSync(file, 'utf8');
}

function clean(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(intPart, decPart) {
  return Number(intPart + '.' + (decPart || '0'));
}

function extractProducts(html) {
  const products = [];
  const seen = new Set();
  const cardRe = /<a\s[^>]*href="product\/(\d+)\/index\.html"[\s\S]*?<\/a>/g;
  let match;

  while ((match = cardRe.exec(html)) !== null) {
    const id = Number(match[1]);
    if (seen.has(id)) continue;
    seen.add(id);

    const block = match[0].replace(/<!--[\s\S]*?-->/g, '');

    let name = '';
    const h3 = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (h3) {
      name = clean(h3[1]);
    } else {
      const texto = block.match(/<div class="texto">([\s\S]*?)(?:<div class="estoque"|$)/i);
      const raw = texto ? texto[1] : block;
      name = clean(raw.split(/Frete/i)[0]);
    }

    // ultimo valor monetario do card = preco atual
    // (no card promocional vem "de R$ X por R$ Y" -> o atual e o Y)
    const prices = [...block.matchAll(/R\$\s*(?:&nbsp;|\s)*(\d+)\s*,\s*(\d{2})/g)];
    if (!prices.length) {
      console.warn('[extract-catalog] aviso: card do produto ' + id + ' sem preco legivel, ignorando');
      continue;
    }
    const last = prices[prices.length - 1];
    const price = toNumber(last[1], last[2]);

    products.push({ id: id, name: name, price: price });
  }

  products.sort((a, b) => a.id - b.id);
  return products;
}

function extractOptions(source) {
  const re = /pzOpt\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*(-?\d+(?:\.\d+)?)/g;
  const map = Object.create(null);
  let match;

  while ((match = re.exec(source)) !== null) {
    let name;
    try {
      name = JSON.parse("'" + match[1] + "'");
    } catch (e) {
      name = match[1];
    }
    const price = Number(match[3]);
    if (!map[name]) map[name] = [];
    if (map[name].indexOf(price) === -1) map[name].push(price);
  }

  return Object.keys(map)
    .sort()
    .map(function (name) {
      map[name].sort((a, b) => a - b);
      return { name: name, prices: map[name] };
    });
}

function main() {
  const html = read(INDEX_FILE);
  const modal = read(MODAL_FILE);

  const products = extractProducts(html);
  const options = extractOptions(modal);

  if (products.length < 10) fail('esperava 10 produtos no index.html, achei ' + products.length);
  if (!options.length) fail('nenhuma pzOpt encontrada em modal-personalizacao.js');

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: ['index.html', 'js/modal-personalizacao.js'],
    products: products,
    options: options
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

  console.log('[extract-catalog] produtos: ' + products.length + ', opcoes unicas: ' + options.length);
  products.forEach((p) => console.log('  ' + p.id + '\tR$ ' + p.price.toFixed(2) + '\t' + p.name));
}

main();
