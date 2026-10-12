// Modal de Personalização - Flow Burger (v2)

const PZ_BACK_SVG =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 19l-7-7 7-7"/></svg>';

const PZ_TRUCK_SVG =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h13v13H1z"/><path d="M14 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>';

const PZ_CHECK_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

const PZ_ICONS = {
    cup: '<path d="M20 22h24l-2.5 24a5 5 0 0 1-5 4.5h-9A5 5 0 0 1 22.5 46z"/><path d="M22 30h20"/><path d="M36 22l3-9"/>',
    bottle: '<path d="M28 12h8v7l4 7v22a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V26l4-7z"/><path d="M24 34h16"/>',
    leaf: '<path d="M14 50C14 30 30 14 50 14c0 20-16 36-36 36z"/><path d="M14 50l22-22"/>',
    egg: '<ellipse cx="32" cy="36" rx="14" ry="18"/><path d="M26 30c2 3 6 5 10 4"/>',
    rings: '<circle cx="32" cy="32" r="17"/><circle cx="32" cy="32" r="8"/>',
    cone: '<path d="M22 28a10 10 0 0 1 20 0z"/><path d="M23 30h18L32 50z"/>',
    burger: '<path d="M14 27c0-8 8-13 18-13s18 5 18 13z"/><path d="M14 34h36"/><path d="M14 41c0 7 8 11 18 11s18-4 18-11"/>'
};

function pzPlaceholder(inner) {
    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#f2f2f4"/><g fill="none" stroke="#a0a0a8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
        inner +
        '</g></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const PZ_BASE = (function () {
    const s =
        document.currentScript ||
        Array.prototype.slice.call(document.scripts).find(function (x) {
            return x.src && x.src.indexOf('modal-personalizacao.js') !== -1;
        });
    return s && s.src ? s.src.replace(/js\/modal-personalizacao\.js.*$/, '') : './';
})();

const PZ_IMG = {
    meat: PZ_BASE + 'imgs/r4.webp',
    bacon: PZ_BASE + 'imgs/r3.webp',
    cheese: PZ_BASE + 'imgs/r6.webp',
    fries: PZ_BASE + 'imgs/r7.webp',
    pork: PZ_BASE + 'imgs/r1.webp',
    cup: pzPlaceholder(PZ_ICONS.cup),
    bottle: pzPlaceholder(PZ_ICONS.bottle),
    leaf: pzPlaceholder(PZ_ICONS.leaf),
    egg: pzPlaceholder(PZ_ICONS.egg),
    rings: pzPlaceholder(PZ_ICONS.rings),
    cone: pzPlaceholder(PZ_ICONS.cone),
    fallback: pzPlaceholder(PZ_ICONS.burger)
};

const PZ_DESC = {
    1: 'Perfeito para compartilhar! Dois deliciosos burgões artesanais com ingredientes frescos e uma generosa porção de batata especial temperada. Ideal para um momento especial a dois.',
    2: 'O combo perfeito para toda a família! Quatro suculentos burgões artesanais e duas generosas porções de batata especial. Diversão e sabor garantidos para todos!',
    3: 'O combo perfeito para você! Um delicioso burgão artesanal, batata frita crocante e refrigerante gelado. Tudo o que você precisa em uma refeição completa.',
    4: 'Nosso hambúrguer artesanal especial com blend de carnes selecionadas, queijo cheddar, alface, tomate, cebola roxa e nosso molho secreto. Um clássico irresistível!',
    5: 'Para quem tem fome de verdade! Dois suculentos hambúrgueres de 120g cada, duplo queijo cheddar, alface, tomate, cebola roxa e nosso molho especial. Pura indulgência!',
    6: 'O desafio supremo! Três hambúrgueres suculentos de 120g cada, triplo queijo cheddar, alface, tomate, cebola roxa e nosso molho especial. Para os verdadeiros corajosos!',
    7: 'Opção mais leve com hambúrguer grelhado, mix de folhas frescas, tomate e molho especial.',
    8: 'Hambúrguer artesanal com cebola caramelizada, queijo suíço e molho barbecue especial.',
    9: 'Clássico com muito cheddar derretido, bacon crocante e molho da casa.',
    10: 'Dois hambúrgueres com generosa camada de cheddar cremoso e temperos especiais.'
};

function pzOpt(name, desc, price, img) {
    return { name: name, desc: desc, price: price, img: img };
}

const PZ_PONTO_STD = [
    pzOpt('Mal passado', 'Carne vermelha no centro, bem suculenta', 0, PZ_IMG.meat),
    pzOpt('Ao ponto', 'Carne rosada no centro, equilibrada', 0, PZ_IMG.meat),
    pzOpt('Bem passado', 'Carne totalmente cozida, sem vermelho', 0, PZ_IMG.meat)
];

const PZ_PONTO_TODOS = [
    pzOpt('Todos mal passados', 'Todas as carnes mal passadas', 0, PZ_IMG.meat),
    pzOpt('Todos ao ponto', 'Todas as carnes no ponto ideal', 0, PZ_IMG.meat),
    pzOpt('Todos bem passados', 'Todas as carnes bem cozidas', 0, PZ_IMG.meat),
    pzOpt('Misto', 'Pontos diferentes (detalhe nas observações)', 0, PZ_IMG.meat)
];

function pzPonto(rows) {
    return {
        id: 'ponto',
        title: 'Ponto da carne',
        sub: 'Escolha o ponto do hambúrguer',
        required: true,
        type: 'single',
        min: 1,
        max: 1,
        hidePrice: true,
        hideImg: true,
        options: rows || PZ_PONTO_STD
    };
}

function pzBebida() {
    return {
        id: 'bebida',
        title: 'Refrigerante 350ml',
        sub: 'Incluso no combo — escolha 1 opção',
        required: true,
        type: 'single',
        min: 1,
        max: 1,
        hideImg: true,
        options: [
            pzOpt('Coca-Cola', 'Lata 350ml gelada', 0, PZ_IMG.cup),
            pzOpt('Guaraná Antarctica', 'Lata 350ml gelada', 0, PZ_IMG.cup),
            pzOpt('Fanta Laranja', 'Lata 350ml gelada', 0, PZ_IMG.cup),
            pzOpt('Sprite', 'Lata 350ml gelada', 0, PZ_IMG.cup)
        ]
    };
}

function pzMolhos(max) {
    return {
        id: 'molhos',
        title: 'Molhos',
        sub: 'Até ' + max + ' opções grátis',
        required: false,
        type: 'multi',
        min: 0,
        max: max,
        hideImg: true,
        options: [
            pzOpt('Molho da casa', 'Maionese especial do Flow', 0, PZ_IMG.bottle),
            pzOpt('Barbecue artesanal', 'Levemente adocicado', 0, PZ_IMG.bottle),
            pzOpt('Maionese de alho', 'Cremosa e intensa', 0, PZ_IMG.bottle),
            pzOpt('Chipotle picante', 'Toque defumado e ardido', 0, PZ_IMG.bottle)
        ]
    };
}

function pzAcomp() {
    return {
        id: 'acomp',
        title: 'Acompanhamento',
        sub: 'Opcional — pode escolher mais de um',
        required: false,
        type: 'multi',
        min: 0,
        max: 3,
        hideImg: true,
        options: [
            pzOpt('Batata frita 250g', 'Crocante e temperada', 8.0, PZ_IMG.fries),
            pzOpt('Batata cheddar e bacon', 'Cheddar cremoso e bacon crocante', 12.0, PZ_IMG.fries),
            pzOpt('Onion rings', '6 unidades empanadas', 10.0, PZ_IMG.rings)
        ]
    };
}

function pzAdic(list, max, title, sub) {
    return {
        id: 'adic',
        title: title || 'Adicionais',
        sub: sub || 'Escolha até ' + max + ' itens',
        required: false,
        type: 'multi',
        min: 0,
        max: max,
        hideImg: true,
        options: list
    };
}

const PZ_ADIC_BASE = [
    pzOpt('Bacon crocante', 'Porção extra de bacon', 5.0, PZ_IMG.bacon),
    pzOpt('Queijo cheddar extra', 'Fatia extra de cheddar', 4.0, PZ_IMG.cheese),
    pzOpt('Carne extra 120g', 'Mais uma camada de hambúrguer', 9.0, PZ_IMG.meat),
    pzOpt('Ovo frito', 'Frito na hora', 3.0, PZ_IMG.egg),
    pzOpt('Cebola caramelizada', 'Doce e dourada na manteiga', 4.0, PZ_IMG.leaf)
];

const PZ_SETS = {
    1: function () {
        return [
            pzPonto(PZ_PONTO_STD),
            pzAdic(PZ_ADIC_BASE, 5, 'Adicionais', 'Escolha até 5 itens'),
            pzMolhos(2)
        ];
    },
    2: function () {
        return [
            pzPonto(PZ_PONTO_TODOS),
            pzAdic(
                [
                    pzOpt('Porção extra de batata 500g', 'Para toda a família', 14.0, PZ_IMG.fries),
                    pzOpt('Bacon extra', 'Bacon crocante para os 4 burgões', 8.0, PZ_IMG.bacon),
                    pzOpt('Queijo cheddar extra', 'Fatia extra em cada burgão', 6.0, PZ_IMG.cheese),
                    pzOpt('Refrigerante 2L', 'Coca-Cola, Guaraná ou Fanta', 9.0, PZ_IMG.cup),
                    pzOpt('Sobremesa', 'Brownie com sorvete para dividir', 14.0, PZ_IMG.cone)
                ],
                8,
                'Adicionais da família',
                'Escolha até 8 itens'
            ),
            pzMolhos(4)
        ];
    },
    3: function () {
        return [
            pzPonto(PZ_PONTO_STD),
            pzBebida(),
            pzAdic(
                [
                    pzOpt('Bacon crocante', 'Porção extra de bacon', 5.0, PZ_IMG.bacon),
                    pzOpt('Queijo cheddar extra', 'Fatia extra de cheddar', 4.0, PZ_IMG.cheese),
                    pzOpt('Ovo frito', 'Frito na hora', 3.0, PZ_IMG.egg),
                    pzOpt('Batata extra 250g', 'Mais uma porção crocante', 8.0, PZ_IMG.fries)
                ],
                4,
                'Adicionais',
                'Escolha até 4 itens'
            ),
            pzMolhos(2)
        ];
    },
    4: function () {
        return [
            pzPonto(PZ_PONTO_STD),
            pzAcomp(),
            pzAdic(PZ_ADIC_BASE, 5, 'Adicionais', 'Escolha até 5 itens'),
            pzMolhos(2)
        ];
    },
    5: function () {
        const ponto = pzPonto(
            PZ_PONTO_STD.concat([
                pzOpt('Misto (1 ao ponto + 1 bem passado)', 'Uma carne em cada ponto', 0, PZ_IMG.meat)
            ])
        );
        return [ponto, pzAcomp(), pzAdic(PZ_ADIC_BASE, 5, 'Adicionais', 'Escolha até 5 itens'), pzMolhos(2)];
    },
    6: function () {
        return [
            pzPonto(PZ_PONTO_TODOS),
            pzAcomp(),
            pzAdic(
                PZ_ADIC_BASE.concat([
                    pzOpt('Pimenta jalapeño', 'Toque picante extra', 3.0, PZ_IMG.leaf)
                ]),
                5,
                'Adicionais',
                'Escolha até 5 itens'
            ),
            pzMolhos(2)
        ];
    },
    7: function () {
        return [
            pzPonto(PZ_PONTO_STD),
            pzAcomp(),
            pzAdic(
                [
                    pzOpt('Abacate', 'Fatias frescas', 5.0, PZ_IMG.leaf),
                    pzOpt('Tomate confitado', 'Assado lentamente', 3.5, PZ_IMG.leaf),
                    pzOpt('Queijo cottage', 'Leve e cremoso', 4.5, PZ_IMG.cheese),
                    pzOpt('Frango grelhado', 'Peito de frango grelhado', 8.0, PZ_IMG.pork),
                    pzOpt('Ovo frito', 'Frito na hora', 3.0, PZ_IMG.egg)
                ],
                5,
                'Adicionais',
                'Escolha até 5 itens'
            ),
            pzMolhos(2)
        ];
    },
    8: function () {
        return [
            pzPonto(PZ_PONTO_STD),
            pzAcomp(),
            pzAdic(
                [
                    pzOpt('Bacon crocante', 'Porção extra de bacon', 5.0, PZ_IMG.bacon),
                    pzOpt('Queijo suíço extra', 'Fatia extra de queijo suíço', 4.5, PZ_IMG.cheese),
                    pzOpt('Cebola extra caramelizada', 'Dose dupla de cebola doce', 3.0, PZ_IMG.leaf),
                    pzOpt('Carne extra 120g', 'Mais uma camada de hambúrguer', 9.0, PZ_IMG.meat),
                    pzOpt('Molho barbecue extra', 'Barbecue artesanal da casa', 2.5, PZ_IMG.bottle)
                ],
                5,
                'Adicionais',
                'Escolha até 5 itens'
            ),
            pzMolhos(2)
        ];
    },
    9: function () {
        return [
            pzPonto(PZ_PONTO_STD),
            pzAcomp(),
            pzAdic(
                [
                    pzOpt('Bacon extra', 'Dose generosa de bacon', 5.0, PZ_IMG.bacon),
                    pzOpt('Cheddar extra', 'Mais cheddar derretido', 4.0, PZ_IMG.cheese),
                    pzOpt('Carne extra 120g', 'Mais uma camada de hambúrguer', 9.0, PZ_IMG.meat),
                    pzOpt('Ovo frito', 'Frito na hora', 3.0, PZ_IMG.egg),
                    pzOpt('Catupiry', 'Requeijão cremoso', 4.0, PZ_IMG.cheese)
                ],
                5,
                'Adicionais',
                'Escolha até 5 itens'
            ),
            pzMolhos(2)
        ];
    },
    10: function () {
        return [
            pzPonto(
                PZ_PONTO_STD.concat([
                    pzOpt('Misto (1 ao ponto + 1 bem passado)', 'Uma carne em cada ponto', 0, PZ_IMG.meat)
                ])
            ),
            pzAcomp(),
            pzAdic(PZ_ADIC_BASE, 5, 'Adicionais', 'Escolha até 5 itens'),
            pzMolhos(2)
        ];
    }
};

function pzEsc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
}

function pzMoney(value) {
    return 'R$ ' + Number(value || 0).toFixed(2).replace('.', ',');
}

function pzParsePrice(text) {
    if (!text) return 0;
    const cleaned = String(text)
        .replace(/\s|\u00a0/g, '')
        .replace(/[^\d.,]/g, '')
        .replace(/\.(?=\d{3}\b)/g, '')
        .replace(',', '.');
    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : value;
}

class ProductCustomizationModal {
    constructor() {
        this.isOpen = false;
        this.state = null;
        this.trigger = null;
        this.drafts = {};
        this.hintOverride = null;
        this.hintTimer = null;
        this.closeTimer = null;
        this.initModal();
        this.bindEvents();
    }

    initModal() {
        const html =
            '<div class="pz-overlay" id="pz-overlay" aria-hidden="true">' +
            '<div class="pz-modal" role="dialog" aria-modal="true" aria-labelledby="pz-title">' +
            '<header class="pz-header">' +
            '<button type="button" class="pz-back" id="pz-back" aria-label="Voltar">' + PZ_BACK_SVG + '</button>' +
            '<h2 class="pz-title" id="pz-title"></h2>' +
            '<span class="pz-header-spacer"></span>' +
            '</header>' +
            '<div class="pz-body" id="pz-body">' +
            '<figure class="pz-hero">' +
            '<img class="pz-hero-img" id="pz-hero" alt="">' +
            '</figure>' +
            '<section class="pz-info">' +
            '<p class="pz-delivery" id="pz-delivery"></p>' +
            '<p class="pz-notice" id="pz-notice" hidden></p>' +
            '<div class="pz-price-row">' +
            '<span class="pz-price" id="pz-price"></span>' +
            '<span class="pz-price-old" id="pz-price-old" hidden></span>' +
            '<span class="pz-badge" id="pz-badge" hidden></span>' +
            '</div>' +
            '<p class="pz-desc" id="pz-desc"></p>' +
            '</section>' +
            '<div id="pz-sections"></div>' +
            '<section class="pz-notes">' +
            '<h3 class="pz-notes-title">Observações</h3>' +
            '<p class="pz-notes-sub">Alguma preferência? Ex.: tirar cebola, ponto da carne, molho à parte...</p>' +
            '<textarea class="pz-notes-field" id="pz-notes" maxlength="200" placeholder="Ex: sem cebola, capricha no molho..."></textarea>' +
            '</section>' +
            '<div class="pz-body-tail"></div>' +
            '</div>' +
            '<footer class="pz-footer">' +
            '<p class="pz-hint" id="pz-hint" role="status" aria-live="polite" hidden></p>' +
            '<div class="pz-bar">' +
            '<div class="pz-qty">' +
            '<button type="button" class="pz-qty-btn" id="pz-minus" aria-label="Diminuir quantidade">&#8722;</button>' +
            '<span class="pz-qty-value" id="pz-qty-value">1</span>' +
            '<button type="button" class="pz-qty-btn" id="pz-plus" aria-label="Aumentar quantidade">+</button>' +
            '</div>' +
            '<button type="button" class="pz-add" id="pz-add" disabled>' +
            '<span class="pz-add-label" id="pz-add-label">Adicionar</span>' +
            '<span class="pz-add-total" id="pz-add-total">R$ 0,00</span>' +
            '</button>' +
            '</div>' +
            '</footer>' +
            '</div>' +
            '</div>';
        document.body.insertAdjacentHTML('beforeend', html);

        this.el = {
            overlay: document.getElementById('pz-overlay'),
            back: document.getElementById('pz-back'),
            title: document.getElementById('pz-title'),
            body: document.getElementById('pz-body'),
            hero: document.getElementById('pz-hero'),
            delivery: document.getElementById('pz-delivery'),
            notice: document.getElementById('pz-notice'),
            price: document.getElementById('pz-price'),
            priceOld: document.getElementById('pz-price-old'),
            badge: document.getElementById('pz-badge'),
            desc: document.getElementById('pz-desc'),
            sections: document.getElementById('pz-sections'),
            notes: document.getElementById('pz-notes'),
            hint: document.getElementById('pz-hint'),
            minus: document.getElementById('pz-minus'),
            plus: document.getElementById('pz-plus'),
            qtyValue: document.getElementById('pz-qty-value'),
            add: document.getElementById('pz-add'),
            addLabel: document.getElementById('pz-add-label'),
            addTotal: document.getElementById('pz-add-total')
        };

        this.el.hero.addEventListener('error', () => {
            if (this.el.hero.src !== PZ_IMG.fallback) this.el.hero.src = PZ_IMG.fallback;
        });
    }

    bindEvents() {
        this.el.back.addEventListener('click', () => this.closeModal());

        this.el.overlay.addEventListener('click', (e) => {
            if (e.target === this.el.overlay) this.closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.closeModal();
        });

        this.el.sections.addEventListener('click', (e) => this.onSectionsClick(e));
        this.el.sections.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            if (e.target.closest('button')) return;
            const row = e.target.closest('.pz-option');
            if (!row) return;
            e.preventDefault();
            row.click();
        });

        this.el.notes.addEventListener('input', () => {
            if (this.state) {
                this.state.notes = this.el.notes.value;
                this.saveDraft();
            }
        });

        this.el.minus.addEventListener('click', () => this.changeOrderQty(-1));
        this.el.plus.addEventListener('click', () => this.changeOrderQty(1));
        this.el.add.addEventListener('click', () => this.addToCart());

        this.interceptProductClicks();
    }

    interceptProductClicks() {
        document.querySelectorAll('.item a[href*="product/"]').forEach((link) => {
            link.addEventListener('click', (e) => {
                const productId = this.extractProductId(link.href);
                if (!productId) return;
                e.preventDefault();
                this.openModal(productId, link);
            });
        });
    }

    extractProductId(href) {
        const match = href.match(/product\/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    extractProductInfo(productId, link) {
        const card = link.closest('.item') || link.parentElement;
        const name = (card.querySelector('h3') ? card.querySelector('h3').textContent : '').trim() || 'Produto';
        const currentPrice = pzParsePrice(card.querySelector('.preco') ? card.querySelector('.preco').textContent : '');
        const rawOld = pzParsePrice(
            card.querySelector('.precoPromocao') ? card.querySelector('.precoPromocao').textContent : ''
        );
        const oldPrice = rawOld > currentPrice ? rawOld : 0;

        let delivery = '';
        card.querySelectorAll('span').forEach((span) => {
            if (!delivery && /frete/i.test(span.textContent || '')) delivery = span.textContent.trim();
        });
        if (!delivery) delivery = 'Entrega com frete grátis';

        const estoque = card.querySelector('.estoque');
        const notice = estoque ? (estoque.textContent || '').replace(/\s+/g, ' ').trim() : '';

        const cardImg = card.querySelector('img');
        const cardSrc = cardImg ? cardImg.currentSrc || cardImg.src || '' : '';
        const image = cardSrc || PZ_BASE + 'imgs/' + productId + '.webp';

        return {
            id: productId,
            name: name,
            currentPrice: currentPrice,
            oldPrice: oldPrice,
            delivery: delivery,
            notice: notice,
            image: image,
            description: PZ_DESC[productId] || 'Delicioso hambúrguer artesanal preparado com ingredientes frescos e selecionados.'
        };
    }

    buildGroups(info) {
        const factory = PZ_SETS[info.id];
        if (factory) return factory();

        const text = (info.name + ' ' + info.description).toLowerCase();
        const groups = [pzPonto(PZ_PONTO_STD)];
        if (/refrigerante|bebida/.test(text)) groups.push(pzBebida());
        if (/combo/.test(text)) {
            groups.push(pzAdic(PZ_ADIC_BASE, 6, 'Adicionais', 'Escolha até 6 itens'));
        } else {
            groups.push(pzAcomp());
            groups.push(pzAdic(PZ_ADIC_BASE, 5, 'Adicionais', 'Escolha até 5 itens'));
        }
        groups.push(pzMolhos(2));
        return groups;
    }

    openModal(productId, trigger) {
        const info = this.extractProductInfo(productId, trigger);
        this.trigger = trigger || null;
        this.state = {
            info: info,
            groups: this.buildGroups(info),
            selection: {},
            qty: 1,
            notes: ''
        };
        this.applyDraft(this.drafts[productId]);

        this.el.title.textContent = info.name;
        this.renderInfo(info);
        this.renderSections();
        this.el.notes.value = this.state.notes;
        this.el.qtyValue.textContent = String(this.state.qty);
        this.el.add.classList.remove('is-done');
        this.el.addLabel.textContent = 'Adicionar';
        this.hintOverride = null;

        this.el.overlay.classList.add('is-open');
        this.el.overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        this.el.body.scrollTop = 0;
        this.isOpen = true;

        this.sync();
        this.el.back.focus({ preventScroll: true });
    }

    closeModal() {
        if (!this.isOpen) return;
        this.saveDraft();
        this.isOpen = false;
        this.el.overlay.classList.remove('is-open');
        this.el.overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        clearTimeout(this.hintTimer);
        this.hintOverride = null;
        if (this.trigger && typeof this.trigger.focus === 'function') {
            this.trigger.focus({ preventScroll: true });
        }
        this.trigger = null;
    }

    renderInfo(info) {
        this.el.hero.alt = info.name;
        this.el.hero.src = info.image;

        this.el.delivery.innerHTML = PZ_TRUCK_SVG + '<span>' + pzEsc(info.delivery) + '</span>';

        if (info.notice) {
            this.el.notice.hidden = false;
            this.el.notice.textContent = info.notice;
        } else {
            this.el.notice.hidden = true;
            this.el.notice.textContent = '';
        }

        this.el.price.textContent = pzMoney(info.currentPrice);

        if (info.oldPrice > 0) {
            this.el.priceOld.hidden = false;
            this.el.priceOld.textContent = pzMoney(info.oldPrice);
            const percent = Math.round((1 - info.currentPrice / info.oldPrice) * 100);
            if (percent > 0) {
                this.el.badge.hidden = false;
                this.el.badge.textContent = '-' + percent + '%';
            } else {
                this.el.badge.hidden = true;
            }
        } else {
            this.el.priceOld.hidden = true;
            this.el.badge.hidden = true;
        }

        this.el.desc.textContent = info.description;
    }

    renderSections() {
        const html = this.state.groups
            .map((group) => {
                const badge = group.required
                    ? '<span class="pz-required">Obrigatório</span>'
                    : '<span class="pz-optional">Opcional</span>';
                const counter =
                    '<span class="pz-counter" data-counter="' +
                    pzEsc(group.id) +
                    '">' +
                    this.countOf(group) +
                    '/' +
                    group.max +
                    '</span>';
                const rows = group.options
                    .map((opt, index) => this.rowHTML(group, opt, index))
                    .join('');
                return (
                    '<section class="pz-group" data-group="' +
                    pzEsc(group.id) +
                    '">' +
                    '<div class="pz-group-head">' +
                    '<h3 class="pz-group-title">' +
                    pzEsc(group.title) +
                    '</h3>' +
                    '<p class="pz-group-sub">' +
                    pzEsc(group.sub) +
                    '</p>' +
                    '<div class="pz-group-meta">' +
                    badge +
                    counter +
                    '</div>' +
                    '</div>' +
                    '<ul class="pz-list" role="' +
                    (group.type === 'single' ? 'radiogroup' : 'group') +
                    '" aria-label="' +
                    pzEsc(group.title) +
                    '">' +
                    rows +
                    '</ul>' +
                    '</section>'
                );
            })
            .join('');
        this.el.sections.innerHTML = html;
    }

    rowHTML(group, opt, index) {
        const onerror = "this.onerror=null;this.src='" + PZ_IMG.fallback + "'";
        let priceHtml = '';
        if (!group.hidePrice) {
            const free = opt.price <= 0;
            priceHtml =
                '<span class="pz-opt-price' +
                (free ? ' is-free' : '') +
                '">' +
                (free ? 'Grátis' : '+ ' + pzMoney(opt.price)) +
                '</span>';
        }

        let ctrl;
        if (group.type === 'single') {
            ctrl =
                '<button type="button" class="pz-plus" data-act="select" aria-label="Selecionar ' +
                pzEsc(opt.name) +
                '">+</button>';
            if (group.required) {
                ctrl += '<span class="pz-radio" aria-hidden="true">' + PZ_CHECK_SVG + '</span>';
            } else {
                ctrl +=
                    '<button type="button" class="pz-radio" data-act="deselect" aria-label="Remover ' +
                    pzEsc(opt.name) +
                    '">' +
                    PZ_CHECK_SVG +
                    '</button>';
            }
        } else {
            ctrl =
                '<button type="button" class="pz-plus" data-act="inc" aria-label="Adicionar ' +
                pzEsc(opt.name) +
                '">+</button>' +
                '<div class="pz-stepper">' +
                '<button type="button" class="pz-step-btn" data-act="dec" aria-label="Diminuir ' +
                pzEsc(opt.name) +
                '">&#8722;</button>' +
                '<span class="pz-step-value">0</span>' +
                '<button type="button" class="pz-step-btn" data-act="inc" aria-label="Aumentar ' +
                pzEsc(opt.name) +
                '">+</button>' +
                '</div>';
        }

        const imgHtml = group.hideImg
            ? ''
            : '<img class="pz-opt-img" src="' +
              pzEsc(opt.img) +
              '" alt="" loading="lazy" onerror="' +
              onerror +
              '">';

        return (
            '<li class="pz-option" data-group="' +
            pzEsc(group.id) +
            '" data-opt="' +
            index +
            '" role="' +
            (group.type === 'single' ? 'radio' : 'checkbox') +
            '" aria-checked="false" tabindex="0">' +
            '<div class="pz-opt-text">' +
            '<span class="pz-opt-name">' +
            pzEsc(opt.name) +
            '</span>' +
            '<span class="pz-opt-desc">' +
            pzEsc(opt.desc) +
            '</span>' +
            priceHtml +
            '</div>' +
            imgHtml +
            '<div class="pz-opt-ctrl">' +
            ctrl +
            '</div>' +
            '</li>'
        );
    }

    groupById(groupId) {
        return this.state.groups.find((group) => group.id === groupId);
    }

    selectionOf(group) {
        return (this.state.selection && this.state.selection[group.id]) || {};
    }

    qtyOf(group, index) {
        return this.selectionOf(group)[index] || 0;
    }

    countOf(group) {
        const selection = this.selectionOf(group);
        return Object.keys(selection).reduce((sum, key) => sum + (selection[key] || 0), 0);
    }

    onSectionsClick(e) {
        if (!this.state) return;
        const row = e.target.closest('.pz-option');
        if (!row) return;
        const group = this.groupById(row.dataset.group);
        if (!group) return;
        const index = parseInt(row.dataset.opt, 10);
        const button = e.target.closest('[data-act]');

        let act;
        if (button) {
            act = button.dataset.act;
        } else if (group.type === 'single') {
            act = 'select';
        } else {
            act = 'inc';
        }

        if (act === 'select') {
            this.selectSingle(group, index);
        } else if (act === 'deselect') {
            if (!group.required) this.deselectSingle(group);
        } else if (act === 'inc') {
            this.changeOption(group, index, 1);
        } else if (act === 'dec') {
            this.changeOption(group, index, -1);
        }
    }

    selectSingle(group, index) {
        this.state.selection[group.id] = { [index]: 1 };
        this.persist();
    }

    deselectSingle(group) {
        delete this.state.selection[group.id];
        this.persist();
    }

    changeOption(group, index, delta) {
        const selection = Object.assign({}, this.selectionOf(group));
        const current = selection[index] || 0;

        if (delta > 0) {
            if (this.countOf(group) >= group.max) {
                this.flashHint(
                    'Escolha no máximo ' +
                        group.max +
                        (group.max === 1 ? ' item' : ' itens') +
                        ' em "' +
                        group.title +
                        '"'
                );
                return;
            }
            selection[index] = current + 1;
        } else {
            if (current <= 1) delete selection[index];
            else selection[index] = current - 1;
        }

        if (Object.keys(selection).length) this.state.selection[group.id] = selection;
        else delete this.state.selection[group.id];
        this.persist();
    }

    changeOrderQty(delta) {
        if (!this.state) return;
        const next = this.state.qty + delta;
        if (next < 1) return;
        if (next > 20) {
            this.flashHint('Quantidade máxima é 20');
            return;
        }
        this.state.qty = next;
        this.el.qtyValue.textContent = String(next);
        this.persist();
        this.sync();
    }

    unitTotal() {
        if (!this.state) return 0;
        let total = this.state.info.currentPrice;
        this.state.groups.forEach((group) => {
            const selection = this.selectionOf(group);
            Object.keys(selection).forEach((key) => {
                const opt = group.options[parseInt(key, 10)];
                if (opt) total += opt.price * selection[key];
            });
        });
        return total;
    }

    validate() {
        const missing = [];
        this.state.groups.forEach((group) => {
            if (group.required && this.countOf(group) < (group.min || 1)) missing.push(group.title);
        });
        return { ok: missing.length === 0, missing: missing };
    }

    flashHint(message) {
        this.hintOverride = message;
        clearTimeout(this.hintTimer);
        this.hintTimer = setTimeout(() => {
            this.hintOverride = null;
            if (this.state) this.sync();
        }, 2600);
        this.sync();
    }

    sync() {
        if (!this.state) return;

        this.state.groups.forEach((group) => {
            const count = this.countOf(group);
            const atMax = count >= group.max;
            const counter = this.el.sections.querySelector('[data-counter="' + group.id + '"]');
            if (counter) {
                counter.textContent = count + '/' + group.max;
                const done = group.required ? count >= (group.min || 1) : count > 0;
                counter.classList.toggle('is-done', done);
            }

            group.options.forEach((opt, index) => {
                const row = this.el.sections.querySelector(
                    '.pz-option[data-group="' + group.id + '"][data-opt="' + index + '"]'
                );
                if (!row) return;
                const qty = this.qtyOf(group, index);
                const selected = qty > 0;
                row.classList.toggle('is-selected', selected);
                row.classList.toggle('is-blocked', !selected && atMax && group.type === 'multi');
                row.setAttribute('aria-checked', selected ? 'true' : 'false');

                const stepValue = row.querySelector('.pz-step-value');
                if (stepValue) stepValue.textContent = String(qty);

                const plus = row.querySelector('.pz-plus');
                if (plus) plus.disabled = group.type === 'multi' && atMax && qty === 0;

                const incBtn = row.querySelector('.pz-step-btn[data-act="inc"]');
                if (incBtn) incBtn.disabled = atMax;
            });
        });

        const validation = this.validate();
        const unit = this.unitTotal();
        this.el.addTotal.textContent = pzMoney(unit * this.state.qty);
        this.el.add.disabled = !validation.ok;
        this.el.minus.disabled = this.state.qty <= 1;
        this.el.plus.disabled = this.state.qty >= 20;

        let hint;
        if (this.hintOverride) hint = this.hintOverride;
        else if (!validation.ok) hint = 'Selecione: ' + validation.missing.join(', ');
        else hint = '';

        if (hint) {
            this.el.hint.hidden = false;
            this.el.hint.textContent = hint;
        } else {
            this.el.hint.hidden = true;
            this.el.hint.textContent = '';
        }
    }

    persist() {
        this.saveDraft();
        this.sync();
    }

    saveDraft() {
        if (!this.state) return;
        this.drafts[this.state.info.id] = {
            selection: JSON.parse(JSON.stringify(this.state.selection)),
            qty: this.state.qty,
            notes: this.state.notes
        };
    }

    applyDraft(draft) {
        if (!draft || !this.state) return;
        this.state.groups.forEach((group) => {
            const saved = draft.selection && draft.selection[group.id];
            if (!saved) return;
            const restored = {};
            let total = 0;
            Object.keys(saved).forEach((key) => {
                const index = parseInt(key, 10);
                const wanted = saved[key] || 0;
                if (isNaN(index) || index < 0 || index >= group.options.length || wanted <= 0) return;
                const allowed = Math.min(wanted, group.max - total);
                if (allowed > 0) {
                    restored[index] = allowed;
                    total += allowed;
                }
            });
            if (Object.keys(restored).length) this.state.selection[group.id] = restored;
        });
        if (draft.qty >= 1 && draft.qty <= 20) this.state.qty = draft.qty;
        if (typeof draft.notes === 'string') this.state.notes = draft.notes;
    }

    buildCartSelections() {
        const options = [];
        const complements = [];
        this.state.groups.forEach((group) => {
            const selection = this.selectionOf(group);
            Object.keys(selection).forEach((key) => {
                const opt = group.options[parseInt(key, 10)];
                const qty = selection[key];
                if (!opt || !qty) return;
                if (group.type === 'single' || opt.price <= 0) {
                    options.push({ name: opt.name, price: opt.price, quantity: qty });
                } else {
                    complements.push({ name: opt.name, price: opt.price, quantity: qty });
                }
            });
        });
        return { options: options, complements: complements };
    }

    readCart() {
        if (typeof window.getCartItems === 'function') return window.getCartItems();
        try {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            return Array.isArray(cart) ? cart : [];
        } catch (e) {
            return [];
        }
    }

    addToCart() {
        if (!this.state) return;
        const validation = this.validate();
        if (!validation.ok) {
            this.flashHint('Selecione: ' + validation.missing.join(', '));
            return;
        }

        const selections = this.buildCartSelections();
        const item = {
            id: this.state.info.id,
            productId: this.state.info.id,
            productName: this.state.info.name,
            basePrice: this.state.info.currentPrice,
            totalPrice: this.unitTotal(),
            quantity: this.state.qty,
            selectedOptions: selections.options,
            selectedComplements: selections.complements,
            observations: this.el.notes.value.trim(),
            timestamp: Date.now()
        };

        const cart = this.readCart();
        cart.push(item);
        localStorage.setItem('cart', JSON.stringify(cart));
        delete this.drafts[this.state.info.id];

        if (typeof updateCartCounter === 'function') updateCartCounter();

        this.el.add.disabled = true;
        this.el.add.classList.add('is-done');
        this.el.addLabel.textContent = '✓ Adicionado';
        this.el.hint.hidden = true;

        clearTimeout(this.closeTimer);
        this.closeTimer = setTimeout(() => {
            this.el.add.classList.remove('is-done');
            this.el.addLabel.textContent = 'Adicionar';
            this.closeModal();
        }, 900);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!window.__pzModal) window.__pzModal = new ProductCustomizationModal();
});
