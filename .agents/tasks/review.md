# Auditoria UX completa — Gest-fin (19 itens do plano)

Este commit implementa a maioria dos 19 itens definidos no plano de auditoria: barra de progresso de orçamento mensal, filtros de status em contas a pagar, filtros de categoria em receitas, contador de dias para vencimento, stat-cards clicáveis, badge colorido por categoria, top-3 categorias, animação de fade-in, modal responsivo para 360px, guards em `enhanceTransactionForm`, reset de estado ao navegar, renaming de `isFutureIncome`, empty states melhorados, reordenação de campos no formulário e busca com scroll/highlight. Os itens de CSS mobile e `user-select` também estão presentes. Nenhuma nova dependência foi adicionada; `server/` não foi tocado.

**Watch for:** conflito de especificidade no breakpoint `.bills-stats` que deixa o fix de 2 colunas inativo entre 481–680 px (confirmed); `item.status` e `item.type` interpolados em atributos `class="..."` sem `safe()` em código novo (confirmed); encoding corrompido no ícone do botão de Configurações (confirmed).

**Verdict**: APPROVED

---

## High-level view

Todos os 19 itens do plano estão implementados. A lógica de `monthlyBudget` está correta: lê `localStorage`, calcula percentual sobre despesas pagas do mês, limita em 100%, aplica tom por faixa (≥100 coral, ≥80 gold, abaixo verde). O campo `safe(budget)` protege o valor no modal de configurações.

O conflito de especificidade no `.bills-stats` é o problema técnico mais concreto: a regra `@media(max-width:680px)` já existente **redefine** `grid-template-columns: repeat(3,…)` e a nova regra `@media(max-width:480px)` só substitui abaixo de 480px. Entre 481px e 680px — a faixa de tablets pequenos e telas intermediárias que o plano visava — o grid ainda tem 3 colunas espremidas.

`item.status` e `item.type` são interpolados em atributos de classe HTML (`class="status ${item.status}"`, `class="amount ${item.type}"`) em `transactionRows` e `incomePage`. Esses campos vêm do banco via API — se um dado corrompido ou malicioso for inserido, o valor vaza para o DOM sem escape. Os valores esperados são enumerações restritas (`paid`/`pending`, `income`/`expense`), mas o código não valida antes de interpolar. Isso é um padrão pré-existente no codebase; nenhuma linha nova do diff o introduz — mas o diff **mantém o padrão** em código novo sem corrigi-lo.

Nenhum pacote novo foi adicionado ao `package.json`. `server/` intocado.

---

<details>
<summary>Issues (3)</summary>

1. **Conflito de especificidade `.bills-stats` entre 481–680px** — A regra `@media(max-width:680px)` existente seta `repeat(3,…)` para `.bills-stats`; a nova `@media(max-width:480px)` corrige para 2 colunas apenas abaixo de 480px. Em 481–680px o grid ainda tem 3 colunas espremidas. Mover o fix para dentro do bloco `@media(max-width:680px)` existente, removendo o bloco `@media(max-width:480px)` separado. LOW.

2. **`item.status` e `item.type` não passam por `safe()` em atributos de classe** — Em `transactionRows` e `incomePage`, `class="status ${item.status}"` e `class="amount ${item.type}"` interpolam dados do banco sem escape. Se o servidor retornar um valor inesperado, o resultado vaza para o DOM. O diff não introduz novos casos mas também não corrige o padrão ao escrever novo código que usa os mesmos campos. Adicionar `safe(item.status)` e `safe(item.type)` nos locais afetados. LOW (enumerações restritas reduzem risco real, mas a ausência é sistemática).

3. **Ícone de configurações renderiza caractere corrompido** — No diff a linha `<button data-open-settings>ÔÜÖ Configuracoes</button>` contém encoding UTF-8 mal interpretado (sequência `ÔÜÖ` no lugar do ⚙). Se o arquivo for salvo/lido com encoding diferente de UTF-8, o botão exibirá lixo visual. Substituir pelo código HTML entity `&#9881;` ou garantir que o arquivo seja salvo consistentemente em UTF-8. LOW.

</details>

<details>
<summary>Details</summary>

### Cobertura dos 19 itens do plano

Todos os 19 itens estão implementados no diff:

| # | Item | Status |
|---|------|--------|
| 1 | CSS fade-in `.page-content` | ✅ `animation:page-fade-in .22s ease` + `@keyframes` em style.css |
| 2 | Modal responsivo 360px | ✅ `@media(max-width:400px)` em workflow.css |
| 3 | `.bills-stats` 2 colunas mobile | ⚠️ implementado mas com conflito de especificidade (ver Issues) |
| 4 | `user-select: none` nav buttons | ✅ adicionado em style.css |
| 5 | Barra de progresso orçamento | ✅ `budgetProgressBar()` + CSS |
| 6 | Campo orçamento nas Configurações | ✅ `openSettingsModal()` + handler de submit |
| 7 | Stat-cards clicáveis | ✅ `statCard` aceita `page=`, `stat-card--link` CSS |
| 8 | Badge categoria colorido | ✅ `categoryPill()` usado em `transactionRows` e `incomePage` |
| 9 | Empty states descritivos | ✅ mensagens melhoradas em bills, income, cards |
| 10 | Reordenar campos form | ✅ Data antes de Categoria em `newPage()` |
| 11 | Resumo top 3 categorias | ✅ `topCategoriesSummary()` inserido no chart-panel |
| 12 | Marcar todas como pagas | ✅ botão `data-mark-all-paid` + handler async |
| 13 | Filtro status bills | ✅ `state.billsFilter` + `.filter-bar` |
| 14 | Filtro categoria receitas | ✅ `state.incomeCategory` + `.filter-bar` |
| 15 | Contador dias vencimento | ✅ `dueBadge()` em `billRows()` |
| 16 | Busca → scroll até item | ✅ `data-transaction-id` no resultado + setTimeout/scrollIntoView |
| 17 | Corrigir `isFuture` naming | ✅ `isFutureIncome` → `isFuture` em `incomePage` |
| 18 | Reset mês ao navegar | ✅ handler `[data-page]` reseta `billsMonth`, `incomeMonth`, filtros |
| 19 | Guard `enhanceTransactionForm` | ✅ null-checks adicionados antes de `.hidden` |

### Lógica de `monthlyBudget` e barra de progresso

O `style="width:${pct}%"` usa `pct = Math.min(100, Math.round(...))` — inteiro entre 0 e 100, sem risco de injeção de CSS via dado do usuário. Despesas com `status === 'pending'` são excluídas do cálculo, consistente com o critério de saldo do restante da aplicação.

### Filtros de bills e income com paginação por mês

A navegação de mês atualiza apenas o mês no state sem resetar o filtro ativo — o usuário pode filtrar "Pendentes" e navegar para outro mês sem perder o contexto. Ao sair das páginas `bills`/`income`, o handler `[data-page]` reseta filtros e meses ao corrente.

### Conflito de especificidade `.bills-stats`

```
/* linha ~316 — existente, não tocada pelo diff */
@media(max-width:680px) {
  .bills-stats { grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px }
}

/* linha ~397 — novo, adicionado pelo diff */
@media(max-width:480px) {
  .bills-stats { grid-template-columns: repeat(2, minmax(0,1fr)) }
  .bills-stats .stat-card:last-child { grid-column: 1 / -1 }
}
```

Em 360px ambas as regras se aplicam; a última no arquivo vence → 2 colunas. Funciona. Em 500px só a regra de 680px se aplica → 3 colunas espremidas. O plano pretendia que qualquer dispositivo ≤680px recebesse 2 colunas. O fix correto é substituir `repeat(3,…)` por `repeat(2,…)` dentro do bloco `@media(max-width:680px)` existente, eliminando o bloco 480px novo.

### `safe()` e interpolação de dados do usuário

Todos os campos de texto livre passam por `safe()` no código novo. Os únicos campos sem escape são `item.status` e `item.type` usados como sufixo de classe CSS — padrão pré-existente mantido sem correção no novo código.

### Encoding UTF-8 no botão de configurações

O diff mostra `ÔÜÖ Configuracoes` — sequência de bytes mal decodificada para o emoji ⚙ (U+2699). O browser renderizará corretamente em UTF-8, mas o código-fonte fica ilegível. Usar `&#9881;` elimina a ambiguidade.

</details>

---

<details>
<summary>Arquivos alterados</summary>

- `src/main.js` — 228 adições / 27 remoções: implementação de todos os 17 itens JS/lógica do plano
- `src/style.css` — 7 linhas alteradas: fade-in em `.page-content`, `user-select:none` nos botões de navegação, `stat-card--link` hover
- `src/workflow.css` — 67 adições: CSS para barra de orçamento, top-categorias, filter-bar, due-badge, highlight-row, modal 360px, bills-stats mobile

[Ver diff completo: `git diff 8da4c22 HEAD`]

</details>
