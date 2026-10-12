# Modal de Personalização - Flow Burger

## 📋 **Documentação Técnica**

### ✨ **Funcionalidades Implementadas**

**Modal Responsivo**
- 📱 **Mobile**: Ocupa toda a tela com cantos superiores arredondados
- 💻 **Desktop**: Modal centralizado (600-700px de largura)
- 🎨 **Design**: Inspirado no iFood, mantendo identidade visual do Flow Burger

**Análise Automática de Produtos**
- 🔍 **Leitura dinâmica** dos nomes e descrições dos produtos
- 🧠 **Inteligência** para criar complementos apropriados
- 📊 **Categorização** automática por tipo de produto

**Grupos de Personalização**
- ✅ **Obrigatórios**: Ponto da carne, bebidas inclusas
- 🔄 **Opcionais**: Complementos, adicionais, upgrades
- 📝 **Campo de observações** livre para instruções especiais

### 🎯 **Produtos Suportados**

**Combos**
- **Combo Casal**: Ponto das carnes + Complementos duplos
- **Combo Família**: Ponto das carnes (individual/misto) + Complementos familiares
- **Combo Individual**: Ponto da carne + Escolha de refrigerante

**Lanches Individuais**
- **Burgão Especial**: Ponto + Complementos básicos
- **Burgão Duplo/Triplo**: Ponto + Complementos premium
- **Burgão Salada**: Ponto + Complementos saudáveis
- **Demais Lanches**: Personalizações específicas por tipo

### 🖼️ **Sistema de Imagens**

**Mapeamento Inteligente**
- `r1.webp` - Vegetais, ingredientes frescos, saladas
- `r2.webp` - Queijos (cheddar, suíço, gorgonzola)
- `r3.webp` - Bacon, proteínas extras
- `r4.webp` - Carnes, pontos, blends premium
- `r5.webp` - Molhos artesanais, condimentos
- `r6.webp` - Batatas, acompanhamentos fritos
- `r7.webp` - Bebidas, refrigerantes, milkshakes
- `r8.webp` - Sobremesas, doces, sorvetes
- `r9.webp` - Opções infantis
- `r10.webp` - Brindes, certificados
- `r11.webp` - Saladas, utensílios, healthy
- `r12.webp` - Pimentas, opções picantes

### ⚙️ **Controles de Seleção**

**Seleção Única (Radio)**
- Ponto da carne
- Escolha de bebida inclusa
- Sabores específicos

**Seleção Múltipla (Checkbox + Quantidade)**
- Complementos opcionais
- Adicionais pagos
- Upgrades de ingredientes

### 💰 **Sistema de Preços**

**Cálculo Automático**
- ➕ Preço base do produto
- ➕ Valor de cada complemento × quantidade
- 🔄 **Atualização em tempo real** conforme seleções
- 💯 **Validação** antes de adicionar ao carrinho

### 🛒 **Integração com Carrinho**

**LocalStorage**
- 💾 **Persistência** das personalizações
- 🔢 **Contador dinâmico** no header
- 📦 **Estrutura completa** do item personalizado

**Dados Salvos**
```json
{
  "id": 1,
  "name": "Combo Casal",
  "basePrice": 32.90,
  "totalPrice": 39.90,
  "customizations": {
    "group-0": {
      "1": { "quantity": 1, "price": 0 }
    },
    "group-1": {
      "0": { "quantity": 2, "price": 4.00 }
    }
  },
  "observations": "Sem cebola no primeiro",
  "quantity": 1,
  "timestamp": 1728053423123
}
```

### 🎨 **Estilos e Animações**

**Transições Suaves**
- 📱 **Slide up** no mobile
- 🖥️ **Scale in** no desktop
- ⚡ **Fade in** sequencial dos grupos

**Estados Visuais**
- ✅ **Selecionado**: Borda laranja + fundo claro
- 🚫 **Desabilitado**: Opacidade reduzida
- ⏳ **Loading**: Spinner durante processamento

### 🔐 **Validações**

**Obrigatoriedades**
- ⚠️ **Botão bloqueado** até completar seleções obrigatórias
- 📝 **Mensagens claras** sobre pendências
- ✅ **Habilitação automática** quando completo

**Limites de Quantidade**
- 🔢 **Máximo por grupo** respeitado
- ➖➕ **Controles de quantidade** com validação
- 📊 **Contador visual** (Ex: 2/5 selecionados)

### 🎯 **Experiência do Usuário**

**Feedback Visual**
- 🎉 **Notificação de sucesso** ao adicionar
- ❌ **Alertas de erro** quando necessário
- 🔄 **Loading states** durante processamento

**Navegação**
- ❌ **Botão de fechar** sempre visível
- ⌨️ **ESC** para fechar rapidamente
- 📱 **Scroll interno** otimizado para mobile

### 🔧 **Configuração Técnica**

**Arquivos**
- `css/modal-personalizacao.css` - Estilos completos
- `js/modal-personalizacao.js` - Lógica do modal
- Integração no `index.html`

**Dependências**
- SweetAlert2 (para notificações)
- FontAwesome (ícones)
- CSS Grid/Flexbox (layout responsivo)

### 📊 **Métricas de Implementação**

**Cobertura**
- ✅ **10 produtos** com personalização completa
- ✅ **50+ opções** de complementos mapeadas
- ✅ **12 categorias** de imagens organizadas
- ✅ **100%** responsivo (mobile + desktop)

**Performance**
- ⚡ **Carregamento instant
âneo** via JavaScript
- 💾 **Cache local** das preferências
- 🔄 **Sincronização** com carrinho existente

### 🚀 **Próximos Passos Sugeridos**

**Melhorias Futuras**
1. 📷 **Upload de imagens** personalizadas por complemento
2. 🎯 **Recomendações** baseadas em histórico
3. 💳 **Integração** com gateway de pagamento
4. 📈 **Analytics** de preferências dos clientes
5. 🔄 **Sincronização** com sistema de pedidos real

---

## 🎯 **Como Usar**

1. **Usuário clica** em qualquer produto da página principal
2. **Modal abre** com personalizações específicas do produto
3. **Usuário seleciona** opções obrigatórias e opcionais
4. **Preço atualiza** automaticamente em tempo real
5. **Adiciona ao carrinho** com todas as personalizações
6. **Contador do header** atualiza instantaneamente

**Resultado**: Experiência fluida e profissional, similar ao iFood, mas com a identidade única do Flow Burger! 🍔✨