# Implementation Plan — Gest-fin Audit

> **Build / run commands**
> - Dev server: `npm run dev` (Vite, porta 5173)
> - Backend: `npm run server` (Node/Express, porta 3333)
> - Não há test runner configurado — verificação é via `npm run build` (sem erros) + inspeção visual no browser.
> - Verificação de build: `npm run build` deve terminar sem erros.

---

## Ordem recomendada de implementação

A ordem abaixo respeita dependências: CSS / estrutura primeiro, depois lógica JS, depois integrações com estado, finalmente ajustes responsivos.

---

## 1. CSS / Responsividade (src/style.css · src/workflow.css · src/theme.css)

### 1.1 — Fade-in no `.page-content` a cada navegação

**O quê:** Adicionar animação `@keyframes fadeIn` e aplicar a classe `.page-content` com `animation: fadeIn .22s ease`.
No `render()` (main.js ~linha 1096) o `app.innerHTML` é substituído inteiro; o fade vai acontecer naturalmente porque `.page-content` é remontado.

**Arquivo:** `src/style.css` — no bloco de `.page-content` (linha ~53) adicionar:
```css
.page-content { animation: page-fade-in .22s ease; }
@keyframes page-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
```

**Verificar:** `npm run build` sem erros. Browser: navegar entre páginas e confirmar transição suave.

---

### 1.2 — Modais funcionam em 360px

**O quê:** O `.modal` tem `max-width: 540px` e `padding: 18px 22px` no workflow.css (~linha 218). Em 360px o modal transborda. Adicionar media query:
```css
@media (max-width: 400px) {
  .modal { max-width: 100%; border-radius: 0 0 8px 8px; }
  .modal-overlay { padding: 0; align-items: flex-end; }
  .modal-form { padding: 14px 14px 18px; }
  .modal-header { padding: 14px 16px 12px; }
  .modal .form-grid { grid-template-columns: 1fr; }
}
```

**Arquivo:** `src/workflow.css` — após o bloco `.modal-overlay` / `.modal` existente.

**Verificar:** `npm run build` + DevTools em 360px → abrir modal de edição → sem scroll horizontal.

---

### 1.3 — `.bills-stats` para 2 colunas no mobile

**O quê:** `.bills-stats` atualmente herda `grid-template-columns:repeat(3,minmax(0,1fr))` no mobile (workflow.css ~linha 310). Com 3 colunas em 360px os cards ficam espremidos. Alterar para 2 colunas no breakpoint ≤680px, com o terceiro card ocupando largura total:

```css
/* dentro do @media(max-width:680px) já existente em workflow.css */
.bills-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.bills-stats .stat-card:last-child { grid-column: 1 / -1; }
```

**Arquivo:** `src/workflow.css` — dentro do `@media(max-width:680px)` final.

**Verificar:** `npm run build` + DevTools 360px na página "Contas a pagar".

---

### 1.4 — `user-select: none` nos botões de navegação

**O quê:** Impede seleção acidental de texto ao clicar rápido nos nav-items.

```css
.nav-item, .month-nav-btn, .primary-button, .text-button, .topbar-btn { user-select: none; }
```

**Arquivo:** `src/style.css` — ao final do bloco de `.nav-item`.

**Verificar:** `npm run build`.

---

## 2. UX / Identidade Visual (src/main.js · src/style.css · src/workflow.css)

### 2.1 — Barra de progresso de meta de gastos mensal

**O quê:** Exibir abaixo dos stat-cards do overview uma barra mostrando `(spending / monthlyBudget) * 100%` com texto "R$ X de R$ Y (ZZ%)". O orçamento vem de `localStorage.getItem('monthlyBudget')`.

**Onde em main.js:**
- Criar função `budgetProgressBar()` (inserir após `categoryBreakdown()`, ~linha 595):
  ```js
  function budgetProgressBar() {
    const budget = Number(localStorage.getItem('monthlyBudget') || 0);
    if (!budget) return '';
    const spending = total(expenses(monthTransactions(currentMonth)).filter(t => t.status === 'paid'));
    const pct = Math.min(100, Math.round(spending / budget * 100));
    const tone = pct >= 100 ? 'negative' : pct >= 80 ? 'warning' : 'positive';
    return `<div class="budget-bar-wrap">
      <div class="budget-bar-header">
        <span class="eyebrow">META DE GASTOS</span>
        <span class="budget-bar-values">${money(spending)} <small>de ${money(budget)}</small></span>
      </div>
      <div class="budget-track">
        <div class="budget-fill budget-fill--${tone}" style="width:${pct}%"></div>
      </div>
      <span class="budget-pct ${tone}">${pct}% do orçamento mensal utilizado</span>
    </div>`;
  }
  ```
- Em `overviewPage()` (~linha 639), inserir `${budgetProgressBar()}` logo após o fechamento da `<div class="stats-grid">` e antes do `<div class="dashboard-grid">`.

**CSS:** em `src/workflow.css` adicionar:
```css
.budget-bar-wrap { margin: 12px 0 14px; padding: 14px 18px; border: 1px solid #e4e8e1; border-radius: 6px; background: #fff; }
.budget-bar-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 9px; }
.budget-bar-values { color: #334653; font-size: 11px; font-weight: 700; }
.budget-bar-values small { color: #8a948e; font-weight: 400; font-size: 9px; }
.budget-track { height: 8px; border-radius: 8px; background: #edf0ec; overflow: hidden; }
.budget-fill { height: 100%; border-radius: inherit; transition: width .4s; }
.budget-fill--positive { background: var(--green); }
.budget-fill--warning { background: var(--gold); }
.budget-fill--negative { background: var(--coral); }
.budget-pct { display: block; margin-top: 7px; font-size: 9px; }
:root[data-theme="dark"] .budget-bar-wrap { background: #0e1f18; border-color: #1e3428; }
:root[data-theme="dark"] .budget-bar-values { color: #c8d8cc; }
:root[data-theme="dark"] .budget-track { background: #1a2f22; }
```

**Verificar:** `npm run build`. Com `monthlyBudget` salvo no localStorage, a barra aparece no overview.

---

### 2.2 — Campo "Valor previsto orçamento mensal" nas Configurações

**O quê:** Não existe uma página de configurações. A solução mais coerente com a arquitetura atual é adicionar um campo inline no overview (abaixo da barra de progresso) e também no `openSettingsModal()`. Optamos por um modal de configurações leve acessível via ícone de engrenagem no profile dropdown.

**Onde em main.js:**
1. Adicionar `'⚙ Configuracoes'` button no `account-menu` (dentro do HTML gerado em `shell()`, ~linha 451):
   ```html
   <button data-open-settings>⚙ Configuracoes</button>
   ```
   Inserir acima do `<hr />` existente.

2. Criar função `openSettingsModal()` (após `openEditCardModal`, ~linha 1030):
   ```js
   function openSettingsModal() {
     closeModal();
     const budget = localStorage.getItem('monthlyBudget') || '';
     const modal = document.createElement('div');
     modal.className = 'modal-overlay';
     modal.id = 'edit-modal';
     modal.innerHTML = `
       <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
         <div class="modal-header">
           <h3 id="modal-title">Configurações</h3>
           <button class="modal-close" id="modal-close" aria-label="Fechar">✕</button>
         </div>
         <form id="settings-form" class="modal-form">
           <div class="form-grid">
             <label class="field field-wide">
               <span>Orçamento mensal de gastos</span>
               <div class="currency-input"><b>R$</b>
                 <input name="monthlyBudget" type="number" min="0" step="0.01" value="${budget}" placeholder="Ex.: 3000" />
               </div>
               <small>Usado para a barra de progresso no painel principal.</small>
             </label>
           </div>
           <div class="modal-footer">
             <button type="button" class="modal-cancel" id="modal-close-btn">Cancelar</button>
             <button type="submit" class="primary-button">Salvar</button>
           </div>
         </form>
       </div>`;
     document.body.appendChild(modal);
     modal.addEventListener('click', (e) => {
       if (e.target === modal || e.target.closest('#modal-close') || e.target.closest('#modal-close-btn')) closeModal();
     });
   }
   ```

3. Em `app.addEventListener('click', ...)` (~linha 1148), adicionar handler antes do bloco `[data-page]`:
   ```js
   if (event.target.closest('[data-open-settings]')) {
     openSettingsModal();
     document.querySelector('.account-menu').hidden = true;
     return;
   }
   ```

4. Em `app.addEventListener('submit', ...)`, adicionar handler para `settings-form`:
   ```js
   if (event.target.id === 'settings-form') {
     event.preventDefault();
     const budget = new FormData(event.target).get('monthlyBudget');
     if (budget) localStorage.setItem('monthlyBudget', budget);
     else localStorage.removeItem('monthlyBudget');
     showToast('Configurações salvas.');
     closeModal();
     if (state.page === 'overview') render();
     return;
   }
   ```

**Verificar:** `npm run build`. Clicar em "..." no perfil → "Configurações" → digitar valor → salvar → barra de progresso aparece.

---

### 2.3 — Cards de stat clicáveis (Despesas → bills, Receitas → income)

**O quê:** A função `statCard()` (~linha 565) retorna um `<article>`. Adicionar parâmetro opcional `page` e envolver em botão/link com `data-page`.

**Onde em main.js:**
1. Alterar assinatura de `statCard`:
   ```js
   function statCard(label, value, note, tone = 'neutral', icon = '-', page = null) {
     const wrapper = page ? `data-page="${page}" role="button" tabindex="0" title="Ir para ${pageName(page)}"` : '';
     return `<article class="stat-card${page ? ' stat-card--link' : ''}" ${wrapper}>...conteúdo existente...</article>`;
   }
   ```
2. Em `overviewPage()`, passar `'bills'` no card "Despesas pagas" e `'income'` no card "Receitas recebidas".
3. O event listener `[data-page]` já está em `app.addEventListener('click')` e funcionará automaticamente, pois `event.target.closest('[data-page]')` vai encontrar o artigo.

**CSS** em `src/style.css` adicionar:
```css
.stat-card--link { cursor: pointer; transition: box-shadow .18s, transform .18s; }
.stat-card--link:hover { box-shadow: 0 10px 32px rgba(34,48,40,.09); transform: translateY(-2px); }
```

**Verificar:** `npm run build`. Clicar card "Despesas pagas" → navega para bills.

---

### 2.4 — Badge colorido por categoria na tabela de transações recentes

**O quê:** Substituir o `<span class="category-pill">` genérico por um pill com cor de fundo derivada do array `categoryColors`.

**Onde em main.js:** A função `transactionRows()` (~linha 622) gera as `<tr>`. Criar helper:
```js
function categoryPill(cat) {
  const allCats = [...categories.expense, ...categories.income];
  const idx = allCats.indexOf(cat);
  const color = categoryColors[idx >= 0 ? idx % categoryColors.length : 0];
  return `<span class="category-pill" style="background:${color}22;color:${color};border:1px solid ${color}44">${safe(cat)}</span>`;
}
```
Substituir `<span class="category-pill">${safe(item.category)}</span>` em `transactionRows()` por `${categoryPill(item.category)}`.

**Verificar:** `npm run build`. Overview → tabela recentes → pills coloridas.

---

### 2.5 — Empty states mais descritivos

**O quê:** Melhorar as mensagens quando não há dados. Pontos a alterar em `main.js`:

| Função | Trecho atual | Substituir por |
|--------|-------------|----------------|
| `billRows()` (~linha 666) | `"Nenhuma conta pendente por aqui."` | `"Você está em dia! Nenhuma conta registrada para este período."` |
| `incomePage()` (~linha 786) | `"Nenhuma receita neste mês."` | `"Nenhuma receita registrada. Clique em '+ Nova receita' para começar."` |
| `cardsPage()` (~linha 830) | `"Cadastre um cartão para controlar suas compras."` | `"Nenhum cartão cadastrado ainda. Clique em '+ Adicionar cartão' acima para começar a controlar suas faturas."` |
| `cardsPage()` installmentRows vazio (~linha 860) | `"Selecione cartão de crédito ao criar um lançamento."` | `"Nenhuma compra no crédito ainda. Ao registrar um lançamento com pagamento em cartão, ele aparecerá aqui com o controle de parcelas."` |

**Verificar:** `npm run build`. Testar em conta nova sem dados.

---

### 2.6 — Reordenar campos do formulário "Novo lançamento"

**Ordem desejada:** Tipo → Descrição → Valor → Data → Categoria → Conta → Status → Forma de pagamento → Recorrência → Parcelas.

**O quê:** A função `newPage()` (~linha 671) já tem o campo Tipo fora do `form-grid`. Dentro do `form-grid` a ordem atual é: Descrição, Valor, Categoria, Data, Conta, Status, Forma de pagamento, Recorrência, Parcelas.

**Reordenar** o HTML dentro do `form-grid` em `newPage()` para: Descrição, Valor, **Data**, **Categoria**, Conta, Status, Forma de pagamento, Recorrência, Parcelas.

A diferença é trocar `Categoria` (posição 3) com `Data` (posição 4). Ajuste simples no template literal.

**Verificar:** `npm run build`. Página "Novo lançamento" → sequência de campos correta.

---

### 2.7 — Seção "Resumo de categorias do mês" no overview (top 3)

**O quê:** Adicionar uma seção compacta abaixo do gráfico mostrando as 3 categorias de maior gasto do mês.

**Onde em main.js:** Criar função `topCategoriesSummary()` (após `categoryBreakdown()`, ~linha 596):
```js
function topCategoriesSummary() {
  const byCategory = expenses(monthTransactions(currentMonth))
    .filter(t => t.status === 'paid')
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + Number(t.amount); return acc; }, {});
  const top3 = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!top3.length) return '';
  return `<div class="top-categories">
    <span class="eyebrow">TOP CATEGORIAS DO MÊS</span>
    <div class="top-cat-list">
      ${top3.map(([cat, val], i) => `<div class="top-cat-row">
        <span class="top-cat-rank">${i + 1}</span>
        ${categoryPill(cat)}
        <span class="top-cat-amount">${money(val)}</span>
      </div>`).join('')}
    </div>
  </div>`;
}
```

Em `overviewPage()` inserir `${topCategoriesSummary()}` após `${monthChart()}` e antes do fechamento do `<section class="panel chart-panel">`.

**CSS** em `src/workflow.css`:
```css
.top-categories { margin-top: 16px; padding-top: 14px; border-top: 1px solid #f0f2ed; }
.top-cat-list { display: grid; gap: 8px; margin-top: 10px; }
.top-cat-row { display: flex; align-items: center; gap: 10px; }
.top-cat-rank { width: 16px; color: #9aa49e; font-size: 9px; font-weight: 700; flex-shrink: 0; }
.top-cat-amount { margin-left: auto; color: #334653; font-size: 10px; font-weight: 700; }
:root[data-theme="dark"] .top-categories { border-color: #1e3428; }
:root[data-theme="dark"] .top-cat-rank { color: #5a7a68; }
:root[data-theme="dark"] .top-cat-amount { color: #c8d8cc; }
```

**Verificar:** `npm run build`. Overview → seção "Top categorias" visível abaixo do gráfico.

---

## 3. Funções Faltando (src/main.js)

### 3.1 — Botão "Marcar todas como pagas" na página de contas a pagar

**O quê:** Adicionar botão na `section-heading` de `billsPage()` (~linha 741) que, ao clicar, chama `markPaid` para todos os itens `pending` do mês selecionado.

**Onde em main.js:**
1. No HTML de `billsPage()`, trocar o `<div class="section-heading">` para incluir um segundo botão:
   ```html
   <div class="section-heading">
     <div><span class="eyebrow">${pending.length} PENDENTES</span><h2>Contas a pagar</h2></div>
     <div style="display:flex;gap:8px;flex-wrap:wrap">
       ${pending.length ? `<button class="settle-button" data-mark-all-paid>✓ Marcar todas como pagas</button>` : ''}
       <button class="primary-button" data-page="new">+ Novo lancamento</button>
     </div>
   </div>
   ```

2. Em `app.addEventListener('click')` (~linha 1148), adicionar handler:
   ```js
   if (event.target.closest('[data-mark-all-paid]')) {
     const pendingBills = expenses(monthTransactions(state.billsMonth))
       .filter(t => t.status === 'pending');
     if (!pendingBills.length) return;
     if (!window.confirm(`Marcar ${pendingBills.length} conta(s) como pagas?`)) return;
     const btn = event.target.closest('[data-mark-all-paid]');
     btn.disabled = true;
     btn.textContent = 'Salvando...';
     try {
       await Promise.all(pendingBills.map(t => saveTransaction({ ...t, status: 'paid' })));
       showToast(`${pendingBills.length} conta(s) marcadas como pagas.`);
       await refresh();
     } catch (err) {
       showToast(err.message, 'error');
       btn.disabled = false;
     }
     return;
   }
   ```

**Verificar:** `npm run build`. Página bills com pendências → botão visível → clicar → todas marcadas pagas.

---

### 3.2 — Filtro por status na página de contas a pagar

**O quê:** Adicionar filtro radio/select "Todos | Pendentes | Pagos" que filtra a lista exibida sem alterar `state`.

**Onde em main.js:** Adicionar `state.billsFilter = 'all'` à inicialização do state (~linha 67). Na `billsPage()` (~linha 716):

1. Antes do `const groupedHTML`, adicionar:
   ```js
   const filterState = state.billsFilter || 'all';
   const filteredBills = filterState === 'pending' ? pending
     : filterState === 'paid' ? paid
     : bills;
   ```
   E usar `filteredBills` em vez de `bills` no `grouped`.

2. No HTML, adicionar barra de filtro antes do `<section class="panel bills-panel">`:
   ```html
   <div class="filter-bar">
     <button class="filter-btn ${filterState === 'all' ? 'active' : ''}" data-bills-filter="all">Todos (${bills.length})</button>
     <button class="filter-btn ${filterState === 'pending' ? 'active' : ''}" data-bills-filter="pending">Pendentes (${pending.length})</button>
     <button class="filter-btn ${filterState === 'paid' ? 'active' : ''}" data-bills-filter="paid">Pagos (${paid.length})</button>
   </div>
   ```

3. Em `app.addEventListener('click')`:
   ```js
   const billsFilterBtn = event.target.closest('[data-bills-filter]');
   if (billsFilterBtn) { state.billsFilter = billsFilterBtn.dataset.billsFilter; render(); return; }
   ```

4. Ao navegar de página (`[data-page]` handler, ~linha 1265), resetar: `state.billsFilter = 'all';`.

**CSS** em `src/workflow.css`:
```css
.filter-bar { display: flex; gap: 6px; margin: 0 0 12px; flex-wrap: wrap; }
.filter-btn { padding: 6px 12px; border: 1px solid #e0e4de; border-radius: 20px; background: #f7f9f6; color: #5a6660; font-size: 9px; font-weight: 700; transition: background .12s, border-color .12s; }
.filter-btn:hover { background: #eef1ec; border-color: #c8d4c9; }
.filter-btn.active { background: var(--green); border-color: var(--green); color: #fff; }
:root[data-theme="dark"] .filter-bar .filter-btn { background: #142618; border-color: #2b3f32; color: #8aaa96; }
:root[data-theme="dark"] .filter-bar .filter-btn.active { background: var(--green); border-color: var(--green); color: #fff; }
```

**Mobile:** dentro de `@media(max-width:680px)` do workflow.css adicionar:
```css
.filter-bar { gap: 4px; }
.filter-btn { font-size: 8px; padding: 5px 9px; }
```

**Verificar:** `npm run build`. Bills → filtrar por "Pendentes" → lista filtra corretamente.

---

### 3.3 — Filtro por categoria na página de receitas

**O quê:** Adicionar `state.incomeCategory = 'all'` e um `<select>` de categorias de receita acima da tabela em `incomePage()`.

**Onde em main.js:**
1. Adicionar ao `state` inicial: `incomeCategory: 'all'`.
2. Em `incomePage()` (~linha 780), filtrar `records` antes de renderizar:
   ```js
   const catFilter = state.incomeCategory || 'all';
   const displayRecords = catFilter === 'all' ? records : records.filter(t => t.category === catFilter);
   ```
   Usar `displayRecords` no `tbody`.

3. No HTML da `incomePage()`, antes da `<section class="panel table-panel income-table">`, adicionar:
   ```html
   <div class="filter-bar">
     <button class="filter-btn ${catFilter === 'all' ? 'active' : ''}" data-income-cat="all">Todas</button>
     ${categories.income.map(c => `<button class="filter-btn ${catFilter === c ? 'active' : ''}" data-income-cat="${safe(c)}">${safe(c)}</button>`).join('')}
   </div>
   ```

4. Em `app.addEventListener('click')`:
   ```js
   const incomeCatBtn = event.target.closest('[data-income-cat]');
   if (incomeCatBtn) { state.incomeCategory = incomeCatBtn.dataset.incomeCat; render(); return; }
   ```

5. Ao navegar de página, resetar: `state.incomeCategory = 'all';`.

**CSS:** Aproveita `.filter-bar` / `.filter-btn` já definidos no item 3.2.

**Verificar:** `npm run build`. Receitas → filtrar por "Salario" → lista filtra corretamente.

---

### 3.4 — Contador de dias para vencimento nas bill-rows

**O quê:** Adicionar texto "Vence em X dias" / "Venceu há X dias" / "Vence hoje" abaixo do `<small>` da `.bill-info`.

**Onde em main.js:** Na função `billRows()` (~linha 666), criar helper interno:
```js
function dueBadge(dateStr) {
  const due = new Date(`${dateStr}T12:00:00`);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((due - todayStart) / 86400000);
  if (diff === 0) return `<span class="due-badge due-badge--today">Vence hoje</span>`;
  if (diff > 0) return `<span class="due-badge due-badge--soon">Vence em ${diff} dia${diff !== 1 ? 's' : ''}</span>`;
  return `<span class="due-badge due-badge--overdue">Venceu há ${Math.abs(diff)} dia${Math.abs(diff) !== 1 ? 's' : ''}</span>`;
}
```
Adicionar `${item.status === 'pending' ? dueBadge(item.date) : ''}` dentro do `.bill-info` de cada item, após o `<small>`.

**CSS** em `src/workflow.css`:
```css
.due-badge { display: inline-block; margin-top: 3px; padding: 2px 6px; border-radius: 3px; font-size: 7px; font-weight: 700; }
.due-badge--today { background: #fff3cd; color: #856404; }
.due-badge--soon { background: #e8f5e9; color: #2e7d32; }
.due-badge--overdue { background: #fdecea; color: #c62828; }
:root[data-theme="dark"] .due-badge--today { background: #3d2c00; color: #f0c967; }
:root[data-theme="dark"] .due-badge--soon { background: #1a3428; color: #6aaa82; }
:root[data-theme="dark"] .due-badge--overdue { background: #3b1010; color: #fca5a5; }
```

**Verificar:** `npm run build`. Bills → contas com status "pending" → badge de dias visível.

---

### 3.5 — Busca: clicar no resultado navega E faz scroll até o item

**O quê:** Os `<button class="search-result-item">` no painel de busca (gerado no `app.addEventListener('input')`, ~linha 1305) têm `data-page` mas **não** associam o `id` da transação. O click handler `[data-page]` navega corretamente, mas não faz scroll.

**Solução:**
1. No HTML gerado dentro de `app.addEventListener('input')`, adicionar `data-transaction-id` ao botão:
   ```js
   <button class="search-result-item" data-page="${...}" data-transaction-id="${safe(t.id)}">
   ```

2. Em `app.addEventListener('click')`, o handler `[data-page]` (~linha 1265) já chama `render()`. Após o `render()`, adicionar lógica de scroll:
   ```js
   const pageButton = event.target.closest('[data-page]');
   if (pageButton) {
     const txId = pageButton.dataset.transactionId;
     state.page = pageButton.dataset.page;
     // fecha drawer / panel...
     render();
     window.scrollTo({ top: 0, behavior: 'smooth' });
     if (txId) {
       setTimeout(() => {
         const el = document.querySelector(`[data-transaction-id="${txId}"]`);
         if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('highlight-row'); setTimeout(() => el.classList.remove('highlight-row'), 1800); }
       }, 200);
     }
     return;
   }
   ```

**CSS** em `src/workflow.css`:
```css
.highlight-row { animation: row-highlight 1.8s ease forwards; }
@keyframes row-highlight { 0% { background: rgba(49,93,76,.18); } 100% { background: transparent; } }
```

**Verificar:** `npm run build`. Buscar um lançamento → clicar no resultado → navega para página e destaca a linha.

---

## 4. Correções de Código (src/main.js)

### 4.1 — Verificar referências cruzadas de `isFuture` entre overviewPage e billsPage

**Achado:** `billsPage()` (~linha 722) usa `isFuture = nextMonth > currentMonth` corretamente para desabilitar o botão "Próximo". A mesma lógica está em `incomePage()` (~linha 770) como `isFutureIncome`. **Não há cross-reference bug** — as variáveis são locais às funções e independentes.

**Ação:** Renomear `isFutureIncome` para `isFuture` em `incomePage()` para consistência estilística (não causa bug, apenas normaliza o nome).

**Verificar:** `npm run build`.

---

### 4.2 — Garantir reset de `state.billsMonth` e `state.incomeMonth` ao trocar de página

**Achado:** O handler `[data-page]` (~linha 1265) não reseta `billsMonth` / `incomeMonth` ao navegar para fora dessas páginas. Isso significa que se o usuário estava em "outubro" e volta, o mês persiste — o que pode ser o comportamento desejado. Mas se ele navegar de volta para a mesma página mas vindo de outra seção, o mês desejado seria o atual.

**Decisão:** Resetar para `currentMonth` somente quando a navegação sair das páginas `bills` / `income` (i.e., quando o destino não é `bills`/`income`). Adicionar ao handler `[data-page]`:
```js
if (pageButton.dataset.page !== 'bills') state.billsMonth = currentMonth;
if (pageButton.dataset.page !== 'income') state.incomeMonth = currentMonth;
if (pageButton.dataset.page !== 'bills') state.billsFilter = 'all';
if (pageButton.dataset.page !== 'income') state.incomeCategory = 'all';
```

**Verificar:** `npm run build`. Navegar para outubro em bills → ir para overview → voltar para bills → deve estar em mês atual.

---

### 4.3 — Verificar campos `data-expense-only` no formulário

**Achado:** `enhanceTransactionForm()` (~linha 966) faz:
```js
form.querySelector('[data-expense-only]').hidden = !isExpense;
form.querySelector('[data-income-installments]').hidden = isExpense;
```
O `render()` chama `enhanceTransactionForm()` apenas quando `state.page === 'new'`. O `app.addEventListener('change')` (~linha 1325) também atualiza esses campos na mudança de tipo.

**Problema identificado:** `enhanceTransactionForm()` usa `querySelector` sem verificar se o elemento existe. Se por algum motivo o DOM não estiver pronto, lança `TypeError: Cannot set properties of null`. Adicionar guard:
```js
function enhanceTransactionForm() {
  const form = app.querySelector('#transaction-form');
  if (!form) return;
  const typeInput = form.querySelector('[name="type"]:checked');
  if (!typeInput) return;
  const isExpense = typeInput.value === 'expense';
  const expOnly = form.querySelector('[data-expense-only]');
  const incomeInst = form.querySelector('[data-income-installments]');
  if (expOnly) expOnly.hidden = !isExpense;
  if (incomeInst) incomeInst.hidden = isExpense;
}
```

**Verificar:** `npm run build`. Página "Novo lançamento" → trocar tipo → campos aparecem/somem sem erro no console.

---

## Resumo da ordem de implementação

| # | Item | Arquivo(s) | Prioridade |
|---|------|-----------|-----------|
| 1 | CSS fade-in `.page-content` | style.css | Alta |
| 2 | Modal responsivo 360px | workflow.css | Alta |
| 3 | `.bills-stats` 2 colunas mobile | workflow.css | Alta |
| 4 | `user-select: none` nav buttons | style.css | Baixa |
| 5 | Barra de progresso orçamento | main.js + workflow.css | Alta |
| 6 | Campo orçamento nas Configurações | main.js | Alta |
| 7 | Stat-cards clicáveis | main.js + style.css | Média |
| 8 | Badge categoria colorido | main.js | Média |
| 9 | Empty states descritivos | main.js | Baixa |
| 10 | Reordenar campos form | main.js | Baixa |
| 11 | Resumo top 3 categorias | main.js + workflow.css | Média |
| 12 | Marcar todas como pagas | main.js | Alta |
| 13 | Filtro status bills | main.js + workflow.css | Alta |
| 14 | Filtro categoria receitas | main.js | Média |
| 15 | Contador dias vencimento | main.js + workflow.css | Alta |
| 16 | Busca → scroll até item | main.js + workflow.css | Média |
| 17 | Corrigir `isFuture` naming | main.js | Baixa |
| 18 | Reset mês ao navegar | main.js | Média |
| 19 | Guard `enhanceTransactionForm` | main.js | Alta |
