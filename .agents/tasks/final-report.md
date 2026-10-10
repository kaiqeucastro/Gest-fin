# Relatório Final — Gest-fin

**Commit final:** `67ff9de`  
**Branch:** `master` → `origin/master` (push realizado com sucesso)

---

## Funcionalidades Implementadas

### Lançamentos
- **Editar lançamento** — modal de edição para transações existentes
- **Parcelas / vendas a receber** — campo de parcelamento no formulário de novo lançamento (tipo: receita futura)
- **Status pendente não soma ao saldo** — lançamentos com status `pendente` são excluídos dos totais; só entram no saldo quando marcados como `pago`
- **Reordenação de campos no formulário** — Data aparece antes de Categoria

### Cartões de Crédito
- **Editar cartão** — modal de edição para cartões existentes
- **Apagar cartão** — botão de exclusão com confirmação, remove o cartão e suas faturas
- **Valor da fatura atual no card** — o card do cartão exibe o valor total das parcelas do mês corrente como "Fatura Atual"
- **Botão amarelo removido** — ação de destaque desnecessária removida da interface

### Contas a Pagar / Receitas
- **Separação por mês** — extrato exibe apenas contas do mês selecionado
- **Navegação mensal** — setas para avançar/retroceder mês em Contas a Pagar e Receitas
- **Filtro por status** (Todas / Pendentes / Pagas) em Contas a Pagar
- **Filtro por categoria** em Receitas
- **Contador de dias para vencimento** — badge colorido indicando dias restantes/vencido
- **Marcar todas como pagas** — botão para quitar todas as contas do mês de uma vez
- **Filho em contas a pagar** — suporte a sub-itens vinculados a uma conta pai

### Dashboard / UX
- **Barra de progresso de orçamento mensal** — visual com tom por faixa (verde / amarelo / vermelho)
- **Campo de orçamento nas Configurações** — usuário define o orçamento mensal no modal de configurações
- **Stat-cards clicáveis** — cada card de totais navega para a página correspondente
- **Badge colorido por categoria** — pílula de cor distinta por categoria em lançamentos e receitas
- **Top 3 categorias** — painel de resumo das 3 categorias com maior gasto no mês
- **Busca com scroll e highlight** — resultado de busca rola até o item e aplica destaque visual
- **Empty states descritivos** — mensagens explicativas quando listas estão vazias
- **Banner dinâmico** — aviso contextual no topo do dashboard

### Segurança / Qualidade
- **Guards em `enhanceTransactionForm`** — null-checks antes de acessar `.hidden` evitam erros em páginas sem o formulário
- **Reset de estado ao navegar** — ao trocar de página, filtros e mês selecionado voltam ao corrente
- **Rename `isFutureIncome` → `isFuture`** — nomenclatura corrigida para uso genérico
- **Timeout na API** — chamadas com timeout para evitar travamento silencioso
- **Loading state** — indicador de carregamento durante requisições

---

## Correções de Bugs

| Bug | Correção |
|-----|----------|
| `ReferenceError: currentMonth used before declaration` | Declaração movida para antes do primeiro uso |
| Site quebrado após commit de auditoria | Revertido para estado estável e reaplicado incrementalmente |
| Saldo incluía lançamentos pendentes | Filtro `status === 'paid'` aplicado em todos os cálculos de totais |
| Navegação de mês resetava filtros ativos | Reset de filtros movido para troca de página, não de mês |
| `isFuture` mal nomeado causava confusão em receitas | Renomeado consistentemente |

---

## Melhorias de CSS / Responsividade

| Item | Detalhe |
|------|---------|
| Animação `page-fade-in` | Entrada suave `.22s ease` em `.page-content` |
| Modal responsivo 360px | `@media(max-width:400px)` em `workflow.css` |
| `.bills-stats` 2 colunas mobile | Grid de 2 colunas em telas ≤680px (com último item centralizado) |
| `user-select: none` nos botões de nav | Evita seleção acidental de texto ao clicar |
| `stat-card--link` hover | Cursor pointer e elevação visual nos cards clicáveis |
| CSS para filter-bar, due-badge, highlight-row | Estilos dedicados para os novos componentes |
| Barra de progresso de orçamento | Gradiente dinâmico por percentual com transição CSS |

---

## Arquivos Alterados

- `src/main.js` — +228 / -27 linhas
- `src/style.css` — 7 linhas alteradas
- `src/workflow.css` — +67 linhas

---

## Notas de Qualidade (itens baixo risco identificados na auditoria)

1. **Conflito de especificidade `.bills-stats` entre 481–680px** — a regra `@media(max-width:680px)` existente ainda define `repeat(3,…)`; o fix de 2 colunas só atua abaixo de 480px. Impacto visual em tablets pequenos. Baixa prioridade.
2. **`item.status` / `item.type` sem `safe()` em atributos de classe** — padrão pré-existente mantido; valores são enumerações restritas do banco. Baixo risco real.
3. **Encoding do ícone ⚙ no botão Configurações** — renderiza corretamente em UTF-8 mas o código-fonte exibe `ÔÜÖ`. Substituir por `&#9881;` para legibilidade.
