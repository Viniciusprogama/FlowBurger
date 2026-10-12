// Global JavaScript functions for Flow Burger
document.addEventListener('DOMContentLoaded', function() {
    // Update cart counter in header
    updateCartCounter();
    
    // Initialize animations
    initScrollAnimations();
    
    // Handle mobile menu if exists
    initMobileMenu();
});

// Cart counter functionality
function getCartItems() {
    try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        if (Array.isArray(cart) && cart.length > 0) return cart;
    } catch (e) {}

    try {
        const legacy = JSON.parse(localStorage.getItem('flowburger_cart') || '[]');
        if (Array.isArray(legacy) && legacy.length > 0) {
            const migrated = legacy.map(item => ({
                id: item.id,
                productId: item.productId || item.id,
                productName: item.productName || item.name || 'Produto',
                basePrice: item.basePrice || 0,
                totalPrice: item.totalPrice || item.basePrice || 0,
                quantity: item.quantity || 1,
                selectedOptions: item.selectedOptions || [],
                selectedComplements: item.selectedComplements || [],
                observations: item.observations || '',
                timestamp: item.timestamp || Date.now()
            }));
            localStorage.setItem('cart', JSON.stringify(migrated));
            localStorage.removeItem('flowburger_cart');
            return migrated;
        }
    } catch (e) {}

    return [];
}

function updateCartCounter() {
    const cartCount = getCartItems().reduce((total, item) => total + (item.quantity || 1), 0);
    
    // Update cart counter if element exists
    const cartCounters = document.querySelectorAll('.cart-counter');
    cartCounters.forEach(counter => {
        counter.textContent = cartCount;
        counter.style.display = cartCount > 0 ? 'flex' : 'none';
    });
}

// Add cart counter to header
function addCartCounterToHeader() {
    const cartLink = document.querySelector('a[href*="cart"]');
    if (cartLink && !cartLink.querySelector('.cart-counter')) {
        const counter = document.createElement('span');
        counter.className = 'cart-counter';
        counter.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            background: #ef1d2c;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        `;
        cartLink.style.position = 'relative';
        cartLink.appendChild(counter);
        updateCartCounter();
    }
}

// Scroll animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe product items
    const productItems = document.querySelectorAll('.item, .produto');
    productItems.forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(item);
    });
}

// Mobile menu functionality
function initMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menuToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
                mobileMenu.classList.remove('active');
            }
        });
    }
}

// Add to cart with animation
function addToCartWithAnimation(button) {
    // Add loading state
    const originalText = button.textContent;
    button.textContent = 'Adicionando...';
    button.disabled = true;
    
    // Simulate processing time
    setTimeout(() => {
        button.textContent = '✓ Adicionado!';
        button.style.backgroundColor = '#077c22';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.disabled = false;
            button.style.backgroundColor = '';
            updateCartCounter();
        }, 1500);
    }, 800);
}

// Show notification
function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.flow-notification');
    existingNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'flow-notification';
    notification.textContent = message;
    
    const bgColor = type === 'success' ? '#077c22' : '#ef1d2c';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
    `;
    
    // Add animation keyframes
    if (!document.querySelector('#flow-animations')) {
        const style = document.createElement('style');
        style.id = 'flow-animations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Format price
function formatPrice(price) {
    return `R$ ${price.toFixed(2).replace('.', ',')}`;
}

// Smooth scroll to section
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Initialize cart counter when page loads
document.addEventListener('DOMContentLoaded', () => {
    addCartCounterToHeader();
});

// Loading state for forms
function setLoadingState(element, isLoading) {
    if (isLoading) {
        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.textContent = 'Carregando...';
        element.style.opacity = '0.7';
    } else {
        element.disabled = false;
        element.textContent = element.dataset.originalText || element.textContent;
        element.style.opacity = '1';
    }
}

// Debounce function for search and other inputs
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Validate form inputs
function validateInput(input, rules) {
    const value = input.value.trim();
    const errors = [];
    
    if (rules.required && !value) {
        errors.push('Este campo é obrigatório');
    }
    
    if (rules.minLength && value.length < rules.minLength) {
        errors.push(`Mínimo de ${rules.minLength} caracteres`);
    }
    
    if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`Máximo de ${rules.maxLength} caracteres`);
    }
    
    if (rules.email && value && !isValidEmail(value)) {
        errors.push('Email inválido');
    }
    
    if (rules.phone && value && !isValidPhone(value)) {
        errors.push('Telefone inválido');
    }
    
    // Show/hide error messages
    const errorElement = input.parentNode.querySelector('.error-message');
    if (errors.length > 0) {
        if (!errorElement) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.cssText = 'color: #ef1d2c; font-size: 12px; margin-top: 5px;';
            input.parentNode.appendChild(errorDiv);
        }
        input.parentNode.querySelector('.error-message').textContent = errors[0];
        input.style.borderColor = '#ef1d2c';
    } else {
        if (errorElement) {
            errorElement.remove();
        }
        input.style.borderColor = '';
    }
    
    return errors.length === 0;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^[\d\s\(\)\-\+]{10,}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Auto-format phone input
function formatPhoneInput(input) {
    let value = input.value.replace(/\D/g, '');
    
    if (value.length >= 11) {
        value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (value.length >= 10) {
        value = value.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (value.length >= 6) {
        value = value.replace(/(\d{2})(\d{4})(\d*)/, '($1) $2-$3');
    } else if (value.length >= 2) {
        value = value.replace(/(\d{2})(\d*)/, '($1) $2');
    }
    
    input.value = value;
}

// Image validation system for complements
function validateComplementImages() {
    // Mapeamento de categorias para imagens apropriadas
    const categoryImageMapping = {
        'customization': ['r1.webp', 'r9.webp', 'r11.webp'],
        'protein': ['r2.webp', 'r3.webp', 'r4.webp'],
        'cheese': ['r2.webp'],
        'veggie': ['r1.webp', 'r11.webp'],
        'sauce': ['r5.webp'],
        'side': ['r6.webp', 'r11.webp'],
        'drink': ['r7.webp'],
        'dessert': ['r8.webp'],
        'upgrade': ['4.webp', '5.webp', '6.webp'],
        'extras': ['r10.webp', 'r11.webp', 'r12.webp'],
        'challenge': ['r4.webp', 'r12.webp'],
        'spicy': ['r12.webp']
    };

    // Palavras-chave para diferentes tipos de complementos
    const keywordImageMapping = {
        'queijo': 'r2.webp',
        'bacon': 'r3.webp',
        'carne': 'r4.webp',
        'molho': 'r5.webp',
        'batata': 'r6.webp',
        'bebida': 'r7.webp',
        'refrigerante': 'r7.webp',
        'suco': 'r7.webp',
        'milkshake': 'r7.webp',
        'sobremesa': 'r8.webp',
        'sorvete': 'r8.webp',
        'brownie': 'r8.webp',
        'doce': 'r8.webp',
        'infantil': 'r9.webp',
        'criança': 'r9.webp',
        'brinquedo': 'r10.webp',
        'salada': 'r11.webp',
        'vegetais': 'r1.webp',
        'pimenta': 'r12.webp',
        'picante': 'r12.webp'
    };

    return {
        validateImage: function(complement) {
            const name = complement.name.toLowerCase();
            const description = complement.description.toLowerCase();
            const category = complement.category;
            
            // Verificar palavras-chave específicas
            for (const keyword in keywordImageMapping) {
                if (name.includes(keyword) || description.includes(keyword)) {
                    return keywordImageMapping[keyword];
                }
            }
            
            // Verificar por categoria
            if (category && categoryImageMapping[category]) {
                return categoryImageMapping[category][0];
            }
            
            // Imagem padrão
            return 'r11.webp';
        },
        
        validateAllComplements: function(complements) {
            return complements.map(complement => {
                const suggestedImage = this.validateImage(complement);
                if (complement.image !== suggestedImage) {
                    console.warn(`Imagem possivelmente incorreta para "${complement.name}": usando ${complement.image}, sugerido ${suggestedImage}`);
                }
                return {
                    ...complement,
                    validatedImage: suggestedImage
                };
            });
        }
    };
}

// Export functions globally
window.FlowBurger = window.FlowBurger || {};
window.FlowBurger.imageValidator = validateComplementImages();