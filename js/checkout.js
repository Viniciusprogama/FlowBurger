(function () {
    'use strict';

    var DELIVERY_FEE = 0;
    var STORE = {
        customerKey: 'flowburger_checkout'
    };

    var state = {
        cart: [],
        delivery: null,
        submitted: false,
        paid: false,
        discount: 0,
        clientRequestId: null
    };

    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    function $$(sel, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function digits(value) {
        return String(value == null ? '' : value).replace(/\D/g, '');
    }

    function fmt(value) {
        var n = Number(value);
        if (!isFinite(n)) n = 0;
        if (typeof window.formatPrice === 'function') return window.formatPrice(n);
        return 'R$ ' + n.toFixed(2).replace('.', ',');
    }

    function isEmail(value) {
        if (typeof window.isValidEmail === 'function') return window.isValidEmail(value);
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function isCpf(value) {
        var cpf = digits(value);
        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
        var sum = 0;
        var i;
        for (i = 0; i < 9; i++) sum += Number(cpf.charAt(i)) * (10 - i);
        var d1 = (sum * 10) % 11;
        if (d1 === 10) d1 = 0;
        if (d1 !== Number(cpf.charAt(9))) return false;
        sum = 0;
        for (i = 0; i < 10; i++) sum += Number(cpf.charAt(i)) * (11 - i);
        var d2 = (sum * 10) % 11;
        if (d2 === 10) d2 = 0;
        return d2 === Number(cpf.charAt(10));
    }

    function isCnpj(value) {
        var cnpj = digits(value);
        if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
        function calc(base) {
            var weight = base.length - 7;
            var sum = 0;
            for (var k = 0; k < base.length; k++) {
                sum += Number(base.charAt(k)) * weight--;
                if (weight < 2) weight = 9;
            }
            var rest = sum % 11;
            return rest < 2 ? 0 : 11 - rest;
        }
        if (calc(cnpj.slice(0, 12)) !== Number(cnpj.charAt(12))) return false;
        if (calc(cnpj.slice(0, 13)) !== Number(cnpj.charAt(13))) return false;
        return true;
    }

    function isDocument(value) {
        var doc = digits(value);
        if (doc.length === 11) return isCpf(doc);
        if (doc.length === 14) return isCnpj(doc);
        return false;
    }

    function inputValue(id) {
        var input = document.getElementById(id);
        return input ? String(input.value || '').trim() : '';
    }

    function loadCart() {
        try {
            if (typeof window.getCartItems === 'function') {
                var fromGlobal = window.getCartItems();
                if (Array.isArray(fromGlobal)) return fromGlobal;
            }
        } catch (e) {}
        try {
            var cart = JSON.parse(localStorage.getItem('cart') || '[]');
            return Array.isArray(cart) ? cart : [];
        } catch (e) {
            return [];
        }
    }

    function saveCart() {
        try {
            localStorage.setItem('cart', JSON.stringify(state.cart));
        } catch (e) {}
        // mudou o carrinho: proximo Pix deve ser um pedido novo
        state.clientRequestId = null;
        if (typeof window.updateCartCounter === 'function') window.updateCartCounter();
    }

    function qtyOf(item) {
        var q = Number(item.quantity);
        return q > 0 ? q : 1;
    }

    function unitOf(item) {
        var p = Number(item.totalPrice);
        if (!isFinite(p) || p <= 0) p = Number(item.basePrice) || 0;
        return p;
    }

    function lineOf(item) {
        return unitOf(item) * qtyOf(item);
    }

    function totalItems() {
        return state.cart.reduce(function (sum, item) {
            return sum + qtyOf(item);
        }, 0);
    }

    function subtotal() {
        return state.cart.reduce(function (sum, item) {
            return sum + lineOf(item);
        }, 0);
    }

    function total() {
        var fee = state.delivery === 'retirada' ? 0 : DELIVERY_FEE;
        return Math.max(0, subtotal() + fee - state.discount);
    }

    function listOf(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        return Object.keys(value).map(function (key) {
            return value[key];
        });
    }

    function optionsHtml(item) {
        var html = '';

        listOf(item.selectedOptions).forEach(function (option) {
            if (!option || !option.name) return;
            var price = Number(option.price) || 0;
            html += '<li>&bull; ' + esc(option.name) + (price > 0 ? ' <b>+ ' + fmt(price) + '</b>' : '') + '</li>';
        });

        listOf(item.selectedComplements).forEach(function (complement) {
            if (!complement || !complement.name) return;
            var qty = Number(complement.quantity) || 1;
            var price = (Number(complement.price) || 0) * qty;
            html += '<li><b>+ ' + esc(complement.name) + '</b> (' + qty + 'x)' + (price > 0 ? ' <b>+ ' + fmt(price) + '</b>' : '') + '</li>';
        });

        return html;
    }

    function itemHtml(item, index) {
        var name = item.productName || 'Produto';
        var qty = qtyOf(item);
        var unit = unitOf(item);
        var line = lineOf(item);
        var productId = String(item.productId != null ? item.productId : (item.id != null ? item.id : ''));
        var img = '../imgs/' + encodeURIComponent(productId) + '.webp';
        var opts = optionsHtml(item);
        var obs = String(item.observations || '').trim();

        return '' +
            '<article class="co-item" data-index="' + index + '">' +
                '<img class="co-item-img" src="' + esc(img) + '" alt="' + esc(name) + '">' +
                '<div class="co-item-body">' +
                    '<div class="co-item-top">' +
                        '<h3>' + esc(name) + '</h3>' +
                        '<div>' +
                            '<span class="co-item-price">' + fmt(line) + '</span>' +
                            (qty > 1 ? '<span class="co-item-unit">' + fmt(unit) + ' un. &times; ' + qty + '</span>' : '') +
                        '</div>' +
                    '</div>' +
                    (opts ? '<ul class="co-item-opts">' + opts + '</ul>' : '') +
                    (obs ? '<p class="co-item-obs">Obs.: ' + esc(obs) + '</p>' : '') +
                    '<div class="co-item-actions">' +
                        '<div class="co-qty">' +
                            '<button type="button" data-action="dec" aria-label="Diminuir quantidade de ' + esc(name) + '">&minus;</button>' +
                            '<span>' + qty + '</span>' +
                            '<button type="button" data-action="inc" aria-label="Aumentar quantidade de ' + esc(name) + '">+</button>' +
                        '</div>' +
                        '<button type="button" class="co-remove" data-action="remove"><i class="fa-solid fa-trash"></i> Remover</button>' +
                    '</div>' +
                '</div>' +
            '</article>';
    }

    function renderItems() {
        var container = $('#co-items');
        if (!container) return;
        container.innerHTML = state.cart.map(itemHtml).join('');

        $$('#co-items img.co-item-img').forEach(function (img) {
            img.addEventListener('error', function () {
                var placeholder = document.createElement('div');
                placeholder.className = 'co-item-ph';
                placeholder.textContent = (img.alt || 'P').trim().charAt(0).toUpperCase();
                if (img.parentNode) img.parentNode.replaceChild(placeholder, img);
            });
        });
    }

    function renderTotals() {
        var count = totalItems();
        var countEl = $('#co-count');
        if (countEl) countEl.textContent = count + (count === 1 ? ' item' : ' itens');
        if ($('#co-subtotal')) $('#co-subtotal').textContent = fmt(subtotal());

        var feeLabel = state.delivery === 'retirada' ? 'Não se aplica' : 'Grátis';
        if ($('#co-fee')) $('#co-fee').textContent = feeLabel;
        var feeRow = $('#co-feerow');
        if (feeRow) feeRow.classList.toggle('is-free', state.delivery !== 'retirada');

        var discountRow = $('#co-discountrow');
        if (discountRow) discountRow.hidden = state.discount <= 0;
        if ($('#co-discount')) $('#co-discount').textContent = '- ' + fmt(state.discount);

        var finalTotal = fmt(total());
        if ($('#co-total')) $('#co-total').textContent = finalTotal;
        if ($('#co-mtotal')) $('#co-mtotal').textContent = finalTotal;
        if ($('#co-next-total')) $('#co-next-total').textContent = finalTotal;
    }

    function renderEmptyState() {
        var empty = state.cart.length === 0;
        var form = $('#co-form');
        var emptyBox = $('#co-empty');
        if (form) form.hidden = empty || state.submitted;
        if (emptyBox) emptyBox.hidden = !empty || state.paid;
        document.body.classList.toggle('co-nosummary', empty || state.submitted);
    }

    function renderAll() {
        renderItems();
        renderTotals();
        renderEmptyState();
        updateSteps();
    }

    function nameOk() {
        var input = $('#co-nome');
        return !!input && input.value.trim().length >= 3;
    }

    function phoneOk() {
        var input = $('#co-telefone');
        var len = digits(input ? input.value : '').length;
        return len === 10 || len === 11;
    }

    function addressOk() {
        if (state.delivery !== 'entrega') return false;
        var cep = digits($('#co-cep') ? $('#co-cep').value : '');
        return cep.length === 8 &&
            !!(($('#co-rua') || {}).value || '').trim() &&
            !!(($('#co-numero') || {}).value || '').trim() &&
            !!(($('#co-bairro') || {}).value || '').trim() &&
            !!(($('#co-cidade') || {}).value || '').trim() &&
            !!(($('#co-estado') || {}).value || '');
    }

    function updateSteps() {
        var steps = $$('#co-steps .co-step');
        if (!steps.length) return;

        var flags = state.paid
            ? [true, true, true, true, true, true]
            : [
                true,
                state.cart.length > 0,
                nameOk() && phoneOk(),
                state.delivery === 'retirada' ? true : addressOk(),
                !!state.delivery,
                state.submitted
            ];

        var current = flags.indexOf(false);
        if (current === -1) current = steps.length - 1;

        steps.forEach(function (step, index) {
            step.classList.toggle('is-done', index < current);
            step.classList.toggle('is-current', index === current);
            if (index === current) {
                step.setAttribute('aria-current', 'step');
            } else {
                step.removeAttribute('aria-current');
            }
        });
    }

    function setDelivery(mode) {
        state.delivery = mode;
        // mudou a forma de recebimento: proximo Pix deve ser um pedido novo
        state.clientRequestId = null;

        $$('.co-choice').forEach(function (choice) {
            var input = choice.querySelector('input');
            choice.classList.toggle('is-selected', !!input && input.checked);
        });

        var hint = $('#co-address-hint');
        var pickup = $('#co-pickup-note');
        var body = $('#co-address-body');
        if (hint) hint.hidden = mode !== null;
        if (pickup) pickup.hidden = mode !== 'retirada';
        if (body) body.hidden = mode !== 'entrega';

        var deliveryError = $('#err-delivery');
        if (deliveryError) {
            deliveryError.hidden = true;
            deliveryError.textContent = '';
        }

        renderTotals();
        updateSteps();
    }

    function clearFieldError(wrapId) {
        var wrap = document.getElementById(wrapId);
        if (!wrap) return;
        wrap.classList.remove('is-invalid');
        var err = document.getElementById('err-' + wrapId.replace('fw-', ''));
        if (err) {
            err.hidden = true;
            err.textContent = '';
        }
    }

    function setFieldError(wrapId, message) {
        var wrap = document.getElementById(wrapId);
        if (!wrap) return;
        wrap.classList.add('is-invalid');
        var err = document.getElementById('err-' + wrapId.replace('fw-', ''));
        if (err) {
            err.hidden = false;
            err.textContent = message;
        }
    }

    function clearAllErrors() {
        ['fw-nome', 'fw-telefone', 'fw-email', 'fw-documento', 'fw-cep', 'fw-rua', 'fw-numero', 'fw-bairro', 'fw-cidade', 'fw-estado'].forEach(clearFieldError);
        var deliveryError = $('#err-delivery');
        if (deliveryError) {
            deliveryError.hidden = true;
            deliveryError.textContent = '';
        }
        var box = $('#co-errors');
        if (box) box.hidden = true;
        var list = $('#co-errors-list');
        if (list) list.innerHTML = '';
    }

    function validate() {
        var errors = [];

        if (state.cart.length === 0) {
            errors.push({ message: 'Adicione pelo menos um produto ao pedido.', wrap: null });
        }

        if (!nameOk()) {
            errors.push({ message: 'Informe seu nome completo.', wrap: 'fw-nome' });
        }

        if (!phoneOk()) {
            errors.push({ message: 'Digite um telefone válido.', wrap: 'fw-telefone' });
        }

        var emailInput = $('#co-email');
        var email = emailInput ? emailInput.value.trim() : '';
        if (email && !isEmail(email)) {
            errors.push({ message: 'Digite um e-mail v\u00e1lido.', wrap: 'fw-email' });
        }

        var docInput = $('#co-documento');
        var doc = digits(docInput ? docInput.value : '');
        if (doc && !isDocument(doc)) {
            errors.push({ message: 'Digite um CPF ou CNPJ v\u00e1lido.', wrap: 'fw-documento' });
        }

        if (!state.delivery) {
            errors.push({ message: 'Escolha entre entrega ou retirada.', wrap: 'delivery' });
        } else if (state.delivery === 'entrega') {
            if (digits(($('#co-cep') || {}).value).length !== 8) {
                errors.push({ message: 'Digite um CEP válido.', wrap: 'fw-cep' });
            }
            if (!inputValue('co-rua')) {
                errors.push({ message: 'Informe a rua do endereço.', wrap: 'fw-rua' });
            }
            if (!inputValue('co-numero')) {
                errors.push({ message: 'Informe o número do endereço.', wrap: 'fw-numero' });
            }
            if (!inputValue('co-bairro')) {
                errors.push({ message: 'Informe o bairro do endereço.', wrap: 'fw-bairro' });
            }
            if (!inputValue('co-cidade')) {
                errors.push({ message: 'Informe a cidade do endereço.', wrap: 'fw-cidade' });
            }
            if (!inputValue('co-estado')) {
                errors.push({ message: 'Selecione o estado.', wrap: 'fw-estado' });
            }
        }

        return errors;
    }

    function renderErrors(errors) {
        clearAllErrors();

        errors.forEach(function (error) {
            if (error.wrap === 'delivery') {
                var deliveryError = $('#err-delivery');
                if (deliveryError) {
                    deliveryError.hidden = false;
                    deliveryError.textContent = error.message;
                }
            } else if (error.wrap) {
                setFieldError(error.wrap, error.message);
            }
        });

        if (!errors.length) return;

        var box = $('#co-errors');
        var list = $('#co-errors-list');
        if (list) {
            list.innerHTML = errors.map(function (error) {
                return '<li>' + esc(error.message) + '</li>';
            }).join('');
        }
        if (box) {
            box.hidden = false;
            if (typeof box.scrollIntoView === 'function') {
                try {
                    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } catch (e) {
                    box.scrollIntoView();
                }
            }
        }

        var first = errors.find(function (error) {
            return error.wrap && error.wrap !== 'delivery';
        });
        if (first) {
            var wrap = document.getElementById(first.wrap);
            var input = wrap ? wrap.querySelector('input, select') : null;
            if (input && typeof input.focus === 'function') input.focus();
        }
    }

    function customerData() {
        var data = {
            name: ($('#co-nome') || {}).value || '',
            phone: ($('#co-telefone') || {}).value || '',
            email: (($('#co-email') || {}).value || '').trim(),
            document: (($('#co-documento') || {}).value || '').trim(),
            delivery: state.delivery,
            address: null
        };

        if (state.delivery === 'entrega') {
            data.address = {
                cep: ($('#co-cep') || {}).value || '',
                rua: ($('#co-rua') || {}).value || '',
                numero: ($('#co-numero') || {}).value || '',
                complemento: ($('#co-complemento') || {}).value || '',
                bairro: ($('#co-bairro') || {}).value || '',
                cidade: ($('#co-cidade') || {}).value || '',
                estado: ($('#co-estado') || {}).value || '',
                referencia: ($('#co-referencia') || {}).value || ''
            };
        }

        return data;
    }

    function fillNextPanel() {
        var data = customerData();
        if ($('#co-next-nome')) $('#co-next-nome').textContent = data.name;
        if ($('#co-next-telefone')) $('#co-next-telefone').textContent = data.phone;

        var deliveryText = data.delivery === 'retirada' ? 'Retirada no local' : 'Entrega em domicílio';
        if ($('#co-next-entrega')) $('#co-next-entrega').textContent = deliveryText;

        var addressRow = $('#co-next-endereco-row');
        if (addressRow) {
            if (data.delivery === 'entrega' && data.address) {
                var a = data.address;
                var parts = [a.rua + ', ' + a.numero];
                if (a.complemento) parts.push(a.complemento);
                parts.push(a.bairro);
                parts.push(a.cidade + (a.estado ? ' - ' + a.estado : ''));
                if ($('#co-next-endereco')) $('#co-next-endereco').textContent = parts.join(' · ');
                addressRow.hidden = false;
            } else {
                addressRow.hidden = true;
            }
        }

        renderTotals();
    }

    function showNextStep() {
        var data = customerData();
        try {
            localStorage.setItem(STORE.customerKey, JSON.stringify({
                customer: data,
                items: state.cart.length,
                total: total(),
                updatedAt: Date.now()
            }));
        } catch (e) {}

        state.submitted = true;
        var form = $('#co-form');
        var panel = $('#co-next');
        if (form) form.hidden = true;
        if (panel) panel.hidden = false;
        fillNextPanel();
        renderEmptyState();
        updateSteps();
        if (typeof window.scrollTo === 'function') {
            try {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (e) {
                window.scrollTo(0, 0);
            }
        }
    }

    function reviewAgain() {
        state.submitted = false;
        closePayment();
        var form = $('#co-form');
        var panel = $('#co-next');
        if (form) form.hidden = false;
        if (panel) panel.hidden = true;
        renderEmptyState();
        updateSteps();
    }

    function trySubmit(event) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (state.submitted) return;

        clearAllErrors();
        var errors = validate();
        if (errors.length) {
            renderErrors(errors);
            return;
        }
        showNextStep();
        // QR gerado na hora: sem clique extra depois de "Continuar para pagamento Pix"
        if (typeof window.fetch === 'function') generatePix();
    }

    /* ------------------------------------------------------------------ *
     *  Pagamento Pix (POST /api/orders + polling de status)              *
     * ------------------------------------------------------------------ */

    var PAY_POLL_MS = 5000;
    // aviso unico mostrado apos a compra quando a transacao falha
    var TX_ERROR_MSG = 'Compra não concluída. Tente novamente.';
    var PAY_LABELS = {
        PENDING: 'Aguardando pagamento',
        PAID: 'Pagamento confirmado',
        FAILED: 'Pagamento recusado',
        EXPIRED: 'Código expirado'
    };

    var pay = {
        order: null,
        view: null,
        pollTimer: null,
        expiryTimer: null,
        generating: false
    };

    function apiUrl(path) {
        if (typeof window.flowApiUrl === 'function') return window.flowApiUrl(path);
        var base = typeof window.FLOW_API_BASE === 'string' ? window.FLOW_API_BASE : '';
        return String(base).replace(/\/+$/, '') + path;
    }

    function apiJson(method, path, body) {
        var init = {
            method: method,
            headers: { Accept: 'application/json' }
        };
        if (body !== undefined && body !== null) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(body);
        }
        return window.fetch(apiUrl(path), init).then(function (res) {
            return res.json().catch(function () {
                return null;
            }).then(function (json) {
                return { status: res.status, body: json };
            });
        });
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value == null ? '' : value;
    }

    function newClientRequestId() {
        return 'req_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

    function orderPayload() {
        var data = customerData();
        if (!state.clientRequestId) state.clientRequestId = newClientRequestId();

        var payload = {
            clientRequestId: state.clientRequestId,
            customer: {
                name: data.name,
                phone: data.phone
            },
            fulfillment: state.delivery,
            items: state.cart.map(function (item) {
                var entry = {
                    productId: item.productId != null ? item.productId : item.id,
                    quantity: qtyOf(item),
                    observations: String(item.observations || '').trim()
                };
                var options = listOf(item.selectedOptions)
                    .filter(function (o) { return o && o.name; })
                    .map(function (o) {
                        return { name: o.name, quantity: Number(o.quantity) || 1 };
                    });
                var complements = listOf(item.selectedComplements)
                    .filter(function (c) { return c && c.name; })
                    .map(function (c) {
                        return { name: c.name, quantity: Number(c.quantity) || 1 };
                    });
                if (options.length) entry.selectedOptions = options;
                if (complements.length) entry.selectedComplements = complements;
                return entry;
            })
        };

        if (data.email) payload.customer.email = data.email;
        if (digits(data.document).length) payload.customer.document = digits(data.document);
        if (data.address) payload.address = data.address;

        return payload;
    }

    function setGenerateBusy(busy) {
        var btn = $('#co-generate-pix');
        if (!btn) return;
        btn.disabled = !!busy;
        btn.innerHTML = busy
            ? '<i class="fa-solid fa-spinner fa-spin"></i> Gerando Pix…'
            : '<i class="fa-brands fa-pix"></i> Gerar pagamento Pix';
    }

    function setPanelState(mode) {
        var loading = $('#co-pay-loading');
        var body = $('#co-pay-body');
        var bar = $('#co-pay-statusbar');
        var error = $('#co-pay-error');
        var success = $('#co-pay-success');
        var actions = $('#co-pay-actions');
        if (loading) loading.hidden = mode !== 'loading';
        if (body) body.hidden = mode !== 'ready';
        if (bar) bar.hidden = mode !== 'ready';
        if (error) error.hidden = mode !== 'error';
        if (success) success.hidden = mode !== 'success';
        if (actions) actions.hidden = mode === 'success';
    }

    function showPaymentPanel() {
        var panel = $('#co-payment');
        if (panel) panel.hidden = false;
        var next = $('#co-next');
        if (next) next.hidden = true;
        document.body.classList.add('co-paying');
        if (typeof window.scrollTo === 'function') {
            try {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (e) {
                window.scrollTo(0, 0);
            }
        }
    }

    function closePayment() {
        stopPayTimers();
        var panel = $('#co-payment');
        if (panel) panel.hidden = true;
        document.body.classList.remove('co-paying');
        setPanelState('loading');
        hidePayError();
    }

    function hidePayError() {
        var el = $('#co-pay-error');
        if (el) el.hidden = true;
    }

    function showUpsellOnly() {
        var body = $('#co-pay-body');
        if (body) body.hidden = true;
        var statusbar = $('#co-pay-statusbar');
        if (statusbar) statusbar.hidden = true;
        hidePayError();
        var upsell = $('#co-pay-upsell');
        if (upsell) upsell.hidden = false;
    }

    function showPayError(message, options) {
        var opts = options || {};
        var title = opts.title || 'Compra não concluída';
        var titleSpan = $('#co-pay-error-title span');
        if (titleSpan) titleSpan.textContent = title;
        setText('co-pay-error-msg', message || TX_ERROR_MSG);
        var retry = $('#co-pay-retry');
        if (retry) retry.textContent = opts.retryLabel || 'Tentar novamente';
        showPaymentPanel();
        setPanelState('error');
    }

    function setPayStatus(kind, label) {
        var badge = $('#co-pay-status');
        if (badge) {
            badge.textContent = label || PAY_LABELS[kind] || kind || '';
            badge.className = 'co-pay-badge is-' + String(kind || '').toLowerCase();
        }
        var indicator = $('#co-pay-indicator');
        if (indicator) indicator.hidden = kind !== 'PENDING';
        var msg = $('#co-pay-msg');
        if (msg && kind === 'PENDING') {
            msg.textContent = 'Após o pagamento, estamos aguardando a confirmação.';
        }
    }

    function mapApiErrors(details) {
        var wraps = {
            'customer.name': 'fw-nome',
            'customer.phone': 'fw-telefone',
            'customer.email': 'fw-email',
            'customer.document': 'fw-documento',
            'address.cep': 'fw-cep',
            'address.rua': 'fw-rua',
            'address.numero': 'fw-numero',
            'address.bairro': 'fw-bairro',
            'address.cidade': 'fw-cidade',
            'address.estado': 'fw-estado'
        };
        return details.map(function (detail) {
            return {
                message: detail && detail.message ? detail.message : 'Dado inválido.',
                wrap: wraps[detail && detail.field] || null
            };
        });
    }

    function generatePix() {
        if (pay.generating || state.paid) return;
        if (!state.cart.length) {
            reviewAgain();
            return;
        }
        if (typeof window.fetch !== 'function') {
            showPayError('Seu navegador não suporta a geração do pedido. Atualize o navegador.');
            return;
        }

        pay.generating = true;
        setGenerateBusy(true);
        hidePayError();
        showPaymentPanel();
        setPanelState('loading');

        apiJson('POST', '/api/orders', orderPayload())
            .then(function (response) {
                if (response.status === 201 || response.status === 200) {
                    onOrderReady(response.body && response.body.order);
                    return;
                }
                if (response.status === 422 && response.body && Array.isArray(response.body.details) && response.body.details.length) {
                    closePayment();
                    state.submitted = false;
                    var form = $('#co-form');
                    if (form) form.hidden = false;
                    var panel = $('#co-next');
                    if (panel) panel.hidden = true;
                    renderErrors(mapApiErrors(response.body.details));
                    updateSteps();
                    return;
                }
                showPayError(TX_ERROR_MSG, { retryLabel: 'Tentar novamente' });
            })
            .catch(function () {
                showPayError(TX_ERROR_MSG);
            })
            .then(function () {
                pay.generating = false;
                setGenerateBusy(false);
            });
    }

    function onOrderReady(order) {
        if (!order) {
            showPayError(TX_ERROR_MSG);
            return;
        }
        pay.order = order;
        hidePayError();
        showPaymentPanel();

        setText('co-pay-order', '#' + order.orderNumber);
        setText('co-pay-valor', fmt(order.total));

        if (order.paymentStatus === 'PAID') {
            showUpsellOnly();
            return;
        }
        if (order.paymentStatus === 'FAILED' || order.status === 'PAYMENT_FAILED') {
            setPayStatus('FAILED');
            showPayError(TX_ERROR_MSG, {
                title: 'Compra não concluída',
                retryLabel: 'Tentar novamente'
            });
            return;
        }

        var code = order.pix && order.pix.code ? order.pix.code : '';
        var area = $('#co-pay-code');
        if (area) area.value = code;
        renderQr(code);

        setPayStatus('PENDING');
        setPanelState('ready');
        startPolling();
        startExpiry(order.expiresAt || (order.pix && order.pix.expiresAt));
    }

    function stopPayTimers() {
        if (pay.pollTimer) {
            clearInterval(pay.pollTimer);
            pay.pollTimer = null;
        }
        if (pay.expiryTimer) {
            clearInterval(pay.expiryTimer);
            pay.expiryTimer = null;
        }
    }

    function startPolling() {
        stopPayTimers();
        pay.pollTimer = setInterval(function () {
            refreshPaymentStatus(false);
        }, PAY_POLL_MS);
    }

    function refreshPaymentStatus(manual) {
        if (!pay.order || state.paid) return;
        if (manual) {
            var btn = $('#co-pay-refresh');
            if (btn) {
                btn.disabled = true;
                setTimeout(function () {
                    btn.disabled = false;
                }, 2000);
            }
        }
        apiJson('GET', '/api/orders/' + pay.order.orderId + '/payment-status')
            .then(function (response) {
                if (response.status === 200 && response.body) applyPayStatus(response.body);
            })
            .catch(function () {
                if (manual) setText('co-pay-msg', 'Não foi possível verificar agora. Tente novamente em instantes.');
            });
    }

    function applyPayStatus(view) {
        pay.view = view;
        if (view.status === 'PAID') {
            stopPayTimers();
            setPayStatus('PAID');
            showUpsellOnly();
            return;
        }
        if (view.status === 'FAILED') {
            stopPayTimers();
            setPayStatus('FAILED');
            showPayError(TX_ERROR_MSG, {
                title: 'Compra não concluída',
                retryLabel: 'Gerar novo código'
            });
            state.clientRequestId = null;
            return;
        }
        if (view.status === 'EXPIRED') {
            stopPayTimers();
            setPayStatus('EXPIRED');
            showPayError('O código Pix expirou. Gere um novo código para continuar o pedido.', {
                title: 'Código expirado',
                retryLabel: 'Gerar novo código'
            });
            state.clientRequestId = null;
            return;
        }
        setPayStatus('PENDING');
    }

    function startExpiry(iso) {
        if (pay.expiryTimer) {
            clearInterval(pay.expiryTimer);
            pay.expiryTimer = null;
        }
        var el = $('#co-pay-expiry');
        if (!el) return;
        if (!iso) {
            el.textContent = '';
            return;
        }
        var end = new Date(iso).getTime();
        if (isNaN(end)) {
            el.textContent = '';
            return;
        }

        function tick() {
            var left = end - Date.now();
            if (left <= 0) {
                el.textContent = 'Código expirado';
                if (pay.expiryTimer) {
                    clearInterval(pay.expiryTimer);
                    pay.expiryTimer = null;
                }
                var badge = $('#co-pay-status');
                if (badge && badge.className.indexOf('is-pending') !== -1) setPayStatus('EXPIRED');
                var msg = $('#co-pay-msg');
                if (msg && !state.paid) msg.textContent = 'O código expirou. Gere um novo código para continuar.';
                return;
            }
            var seconds = Math.ceil(left / 1000);
            var minutes = Math.floor(seconds / 60);
            var rest = seconds % 60;
            el.textContent = 'Código válido por ' +
                (minutes < 10 ? '0' : '') + minutes + ':' + (rest < 10 ? '0' : '') + rest;
        }

        tick();
        pay.expiryTimer = setInterval(tick, 1000);
    }

    function showSuccess() {
        stopPayTimers();
        if (state.paid) return;
        state.paid = true;
        setPayStatus('PAID');

        var order = pay.order || {};
        setText('co-pay-success-order', '#' + (order.orderNumber || ''));
        setText('co-pay-success-cliente', (order.customer && order.customer.name) || '-');
        setText('co-pay-success-entrega', order.fulfillment === 'retirada' ? 'Retirada no local' : 'Entrega em domicílio');

        var addressRow = $('#co-pay-success-endereco-row');
        if (addressRow) {
            if (order.address) {
                var a = order.address;
                var parts = [a.street + ', ' + a.number];
                if (a.complement) parts.push(a.complement);
                parts.push(a.district);
                parts.push(a.city + (a.state ? ' - ' + a.state : ''));
                setText('co-pay-success-endereco', parts.join(' · '));
                addressRow.hidden = false;
            } else {
                addressRow.hidden = true;
            }
        }

        setText('co-pay-success-preparo', order.preparoEstimado || '-');
        var itemCount = (order.items || []).reduce(function (sum, item) {
            return sum + (Number(item.quantity) || 0);
        }, 0);
        setText('co-pay-success-itens', itemCount + (itemCount === 1 ? ' item' : ' itens'));
        setText('co-pay-success-total', fmt(order.total));

        setPanelState('success');
        document.body.classList.add('co-paying');

        state.cart = [];
        state.clientRequestId = null;
        saveCart();
        renderItems();
        renderTotals();
        renderEmptyState();
        updateSteps();
    }

    function legacyCopy(area, done) {
        try {
            area.focus();
            area.select();
            area.setSelectionRange(0, 99999);
            if (document.execCommand('copy')) done();
        } catch (e) {}
    }

    function copyPixCode() {
        var area = $('#co-pay-code');
        if (!area || !area.value) return;
        var text = area.value;
        function done() {
            var ok = $('#co-pay-copied');
            if (ok) {
                ok.hidden = false;
                setTimeout(function () {
                    ok.hidden = true;
                }, 2500);
            }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(function () {
                legacyCopy(area, done);
            });
        } else {
            legacyCopy(area, done);
        }
    }

    function loadQrScript(src) {
        return new Promise(function (resolve) {
            if (window.QRCode) {
                resolve(true);
                return;
            }
            var script = document.createElement('script');
            var settled = false;
            function finish(ok) {
                if (settled) return;
                settled = true;
                resolve(ok);
            }
            script.src = src;
            script.onload = function () {
                finish(!!window.QRCode);
            };
            script.onerror = function () {
                finish(false);
            };
            document.head.appendChild(script);
            setTimeout(function () {
                finish(!!window.QRCode);
            }, 8000);
        });
    }

    function renderQr(code) {
        var wrap = $('#co-pay-qr-wrap');
        var box = $('#co-pay-qr-box');
        var fallback = $('#co-pay-qr-fallback');
        if (wrap) wrap.hidden = true;
        if (fallback) fallback.hidden = true;
        if (!code || !box || typeof Promise === 'undefined') {
            if (fallback) fallback.hidden = false;
            if (box) box.innerHTML = '';
            return;
        }

        var sources = [
            'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
            'https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs@master/qrcode.min.js'
        ];

        function tryNext(index) {
            if (index >= sources.length) {
                if (fallback) fallback.hidden = false;
                return;
            }
            loadQrScript(sources[index]).then(function (ok) {
                if (!ok) {
                    tryNext(index + 1);
                    return;
                }
                try {
                    box.innerHTML = '';
                    new window.QRCode(box, {
                        text: code,
                        width: 220,
                        height: 220,
                        colorDark: '#1b2130',
                        colorLight: '#ffffff',
                        correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0
                    });
                    wrap.hidden = false;
                } catch (e) {
                    tryNext(index + 1);
                }
            });
        }

        tryNext(0);
    }

    function changeQuantity(index, delta) {
        var item = state.cart[index];
        if (!item) return;
        var next = qtyOf(item) + delta;
        if (next <= 0) {
            state.cart.splice(index, 1);
        } else {
            item.quantity = next;
        }
        saveCart();
        renderAll();
    }

    function removeItem(index) {
        if (!state.cart[index]) return;
        state.cart.splice(index, 1);
        saveCart();
        renderAll();
    }

    var cepLookupTimer = null;
    var cepLookupToken = 0;

    function maskCep(input) {
        var value = digits(input.value).slice(0, 8);
        input.value = value.length > 5 ? value.slice(0, 5) + '-' + value.slice(5) : value;
    }

    function maskPhone(input) {
        if (typeof window.formatPhoneInput === 'function') {
            window.formatPhoneInput(input);
            return;
        }
        var value = digits(input.value).slice(0, 11);
        if (value.length > 6) {
            input.value = '(' + value.slice(0, 2) + ') ' + value.slice(2, 7) + '-' + value.slice(7);
        } else if (value.length > 2) {
            input.value = '(' + value.slice(0, 2) + ') ' + value.slice(2);
        } else if (value.length > 0) {
            input.value = '(' + value;
        }
    }

    function maskDocument(input) {
        var value = digits(input.value).slice(0, 14);
        if (value.length <= 11) {
            value = value
                .replace(/^(\d{3})(\d)/, '$1.$2')
                .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
                .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
        } else {
            value = value
                .replace(/^(\d{2})(\d)/, '$1.$2')
                .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                .replace(/\.(\d{3})(\d)/, '.$1/$2')
                .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
        }
        input.value = value;
    }

    function setCepStatus(message, kind) {
        var el = $('#co-cep-status');
        if (!el) return;
        el.textContent = message || '';
        el.className = 'co-cep-status' + (kind ? ' is-' + kind : '');
        el.hidden = !message;
    }

    function fillAddressFromCep(data) {
        var fields = [
            ['co-rua', data.logradouro],
            ['co-bairro', data.bairro],
            ['co-cidade', data.localidade],
            ['co-estado', (data.uf || '').toUpperCase()]
        ];
        var result = { filled: 0, skippedManual: 0, missing: 0 };
        fields.forEach(function (pair) {
            var input = document.getElementById(pair[0]);
            var value = (pair[1] || '').trim();
            if (!input) return;
            if (!value) {
                result.missing++;
                return;
            }
            var manual = input.value && input.getAttribute('data-autofill') !== '1';
            if (manual) {
                result.skippedManual++;
                return;
            }
            if (input.value !== value) result.filled++;
            input.value = value;
            input.setAttribute('data-autofill', '1');
            clearFieldError('fw-' + pair[0].replace('co-', ''));
        });
        if (result.filled) updateSteps();
        return result;
    }

    function lookupCep() {
        var input = $('#co-cep');
        if (!input) return;
        var cep = digits(input.value);
        if (cep.length !== 8) {
            setCepStatus('');
            return;
        }
        if (typeof window.fetch !== 'function') return;
        var token = ++cepLookupToken;
        setCepStatus('Consultando CEP…');
        window.fetch('https://viacep.com.br/ws/' + cep + '/json/')
            .then(function (res) {
                if (!res.ok) throw new Error('http ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (token !== cepLookupToken) return;
                if (!data || data.erro) {
                    setCepStatus('CEP não encontrado. Preencha o endereço manualmente.', 'warn');
                    return;
                }
                var filled = fillAddressFromCep(data);
                if (filled.filled) {
                    setCepStatus('Endereço preenchido pelo CEP. Você pode editar.', 'ok');
                } else if (filled.skippedManual) {
                    setCepStatus('Mantivemos o endereço digitado por você.', 'ok');
                } else {
                    setCepStatus('CEP sem dados de rua/bairro. Preencha o endereço manualmente.', 'warn');
                }
            })
            .catch(function () {
                if (token !== cepLookupToken) return;
                setCepStatus('Não foi possível consultar o CEP. Preencha o endereço manualmente.', 'warn');
            });
    }

    function bindEvents() {
        var form = $('#co-form');
        if (form) form.addEventListener('submit', trySubmit);

        var mobileSubmit = $('#co-msubmit');
        if (mobileSubmit) mobileSubmit.addEventListener('click', trySubmit);

        var review = $('#co-review');
        if (review) review.addEventListener('click', reviewAgain);

        var generate = $('#co-generate-pix');
        if (generate) generate.addEventListener('click', generatePix);

        var payBack = $('#co-pay-back');
        if (payBack) payBack.addEventListener('click', reviewAgain);

        var payErrorBack = $('#co-pay-error-back');
        if (payErrorBack) payErrorBack.addEventListener('click', reviewAgain);

        var payRetry = $('#co-pay-retry');
        if (payRetry) {
            payRetry.addEventListener('click', function () {
                state.clientRequestId = null;
                generatePix();
            });
        }

        var payRefresh = $('#co-pay-refresh');
        if (payRefresh) {
            payRefresh.addEventListener('click', function () {
                refreshPaymentStatus(true);
            });
        }

        var payCopy = $('#co-pay-copy');
        if (payCopy) payCopy.addEventListener('click', copyPixCode);

        $$('input[name="co-delivery"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                if (radio.checked) setDelivery(radio.value);
            });
        });

        ['co-nome', 'co-telefone', 'co-email', 'co-documento', 'co-cep', 'co-rua', 'co-numero', 'co-bairro', 'co-cidade', 'co-estado'].forEach(function (id) {
            var input = document.getElementById(id);
            if (!input) return;
            input.addEventListener('input', function (event) {
                if (event.isTrusted && input.getAttribute('data-autofill') === '1') input.removeAttribute('data-autofill');
                clearFieldError('fw-' + id.replace('co-', ''));
                updateSteps();
            });
            input.addEventListener('change', updateSteps);
        });

        var phone = $('#co-telefone');
        if (phone) phone.addEventListener('input', function () {
            maskPhone(phone);
        });

        var docInput = $('#co-documento');
        if (docInput) {
            docInput.addEventListener('input', function () {
                maskDocument(docInput);
            });
        }

        var cep = $('#co-cep');
        if (cep) cep.addEventListener('input', function () {
            maskCep(cep);
            setCepStatus('');
            if (cepLookupTimer) clearTimeout(cepLookupTimer);
            if (digits(cep.value).length === 8) {
                cepLookupTimer = setTimeout(function () {
                    cepLookupTimer = null;
                    lookupCep();
                }, 450);
            }
        });

        var items = $('#co-items');
        if (items) {
            items.addEventListener('click', function (event) {
                var button = event.target.closest ? event.target.closest('button[data-action]') : null;
                if (!button) return;
                var card = button.closest('.co-item');
                if (!card) return;
                var index = Number(card.getAttribute('data-index'));
                if (isNaN(index)) return;
                var action = button.getAttribute('data-action');
                if (action === 'inc') changeQuantity(index, 1);
                else if (action === 'dec') changeQuantity(index, -1);
                else if (action === 'remove') removeItem(index);
            });
        }
    }

    function init() {
        state.cart = loadCart();
        bindEvents();
        setDelivery(null);
        renderAll();
        if (typeof window.updateCartCounter === 'function') window.updateCartCounter();
    }

    document.addEventListener('DOMContentLoaded', init);

    window.FlowCheckout = {
        getState: function () { return state; },
        validate: validate,
        init: init,
        render: renderAll
    };
})();
