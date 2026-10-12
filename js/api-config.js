(function () {
    'use strict';

    // Base da API de pedidos/Pix.
    // - Producao (mesmo host/servidor): deixe '' (mesma origem).
    // - Desenvolvimento local (site em http://127.0.0.1:5503): aponta para a API.
    // Pode ser sobrescrito antes deste script com: window.FLOW_API_BASE = 'https://api.loja.com';
    var base = '';
    try {
        if (typeof window.FLOW_API_BASE === 'string') {
            base = window.FLOW_API_BASE;
        } else if (window.location && window.location.port === '5503') {
            base = 'http://127.0.0.1:4017';
        }
    } catch (e) {
        base = '';
    }

    base = String(base || '').replace(/\/+$/, '');

    window.FLOW_API_BASE = base;
    window.flowApiUrl = function (path) {
        return base + path;
    };
})();
