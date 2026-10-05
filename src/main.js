import './style.css';
import './icons.css';
import './theme.css';
import './workflow.css';
import { createIcons, LayoutDashboard, CirclePlus, CalendarDays, WalletCards, ChartNoAxesCombined, CreditCard } from 'lucide';

// ─── CONFIGURAÇÃO DA API ──────────────────────────────────────────────────────
// Em produção o frontend e a API rodam na mesma origem
// Em desenvolvimento aponta para localhost:3333
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3333/api'
  : '/api';

function getToken() {
  return localStorage.getItem('gest-fin-token');
}
function setToken(token) {
  localStorage.setItem('gest-fin-token', token);
}
function clearToken() {
  localStorage.removeItem('gest-fin-token');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const today = new Date();
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const isoDate = (day, month = today.getMonth(), year = today.getFullYear()) =>
  new Date(year, month, day).toISOString().slice(0, 10);
const categories = {
  expense: ['Moradia', 'Alimentacao', 'Transporte', 'Saude', 'Assinaturas', 'Lazer', 'Educacao', 'Outros'],
  income: ['Salario', 'Freelance', 'Investimentos', 'Vendas', 'Outros'],
};

const state = { page: 'overview', authScreen: 'login', transactions: [], cards: [], user: null };
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const monthFormat = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const app = document.querySelector('#app');
document.documentElement.dataset.theme = localStorage.getItem('gest-fin-theme') === 'dark' ? 'dark' : 'light';
const currentMonth = monthKey(today);
const previousDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
const previousMonth = monthKey(previousDate);
const categoryColors = ['#123a5a', '#c89452', '#7fa7b8', '#d87760', '#536d82', '#88a392', '#7188a0', '#c2cad0'];
const money = (value) => currency.format(value);
const safe = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const monthTransactions = (month) => state.transactions.filter((item) => monthKey(new Date(`${item.date}T12:00:00`)) === month);
const expenses = (items) => items.filter((item) => item.type === 'expense');
const incomes = (items) => items.filter((item) => item.type === 'income');
const total = (items) => items.reduce((sum, item) => sum + Number(item.amount), 0);

function cardDate(year, month, day) {
  const clampedDay = Math.min(day, new Date(year, month + 1, 0).getDate());
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}
function firstCardDueDate(purchaseDate, card) {
  const purchase = new Date(`${purchaseDate}T12:00:00`);
  const monthOffset = purchase.getDate() <= Number(card.closingDay) ? 1 : 2;
  const dueMonth = new Date(purchase.getFullYear(), purchase.getMonth() + monthOffset, 1);
  return cardDate(dueMonth.getFullYear(), dueMonth.getMonth(), Number(card.dueDay));
}
function installmentDueDate(firstDueDate, installmentOffset) {
  const firstDue = new Date(`${firstDueDate}T12:00:00`);
  const dueMonth = new Date(firstDue.getFullYear(), firstDue.getMonth() + installmentOffset, 1);
  return cardDate(dueMonth.getFullYear(), dueMonth.getMonth(), firstDue.getDate());
}

// ─── OPERAÇÕES DE DADOS (API) ─────────────────────────────────────────────────

async function readTransactions() {
  return apiFetch('/transactions');
}
async function readCards() {
  return apiFetch('/cards');
}
async function saveTransaction(transaction) {
  return apiFetch('/transactions', { method: 'POST', body: transaction });
}
async function saveCard(card) {
  return apiFetch('/cards', { method: 'POST', body: card });
}
async function deleteTransaction(id) {
  return apiFetch(`/transactions/${id}`, { method: 'DELETE' });
}

function exportTransactions(format) {
  const filename = `gest-fin-lancamentos-${isoDate(today.getDate())}`;
  let content, type, extension;
  if (format === 'json') {
    content = JSON.stringify({ exportedAt: new Date().toISOString(), transactions: state.transactions }, null, 2);
    type = 'application/json';
    extension = 'json';
  } else {
    const headers = ['Descricao', 'Tipo', 'Categoria', 'Valor', 'Data', 'Status', 'Conta', 'Observacao'];
    const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = state.transactions.map((item) => [item.title, item.type, item.category, item.amount, item.date, item.status, item.account, item.note]);
    content = `\uFEFF${[headers, ...rows].map((row) => row.map(quote).join(';')).join('\r\n')}`;
    type = 'text/csv;charset=utf-8';
    extension = 'csv';
  }
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}

async function markPaid(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  await saveTransaction({ ...transaction, status: 'paid' });
  await refresh();
}

// ─── PÁGINAS ──────────────────────────────────────────────────────────────────

function pageName(page) {
  return ({ overview: 'Visao geral', new: 'Novo lancamento', bills: 'Contas a pagar', income: 'Receitas', reports: 'Relatorios', cards: 'Cartoes' })[page];
}
function imageBanner(title, copy, image, eyebrow = 'GEST-FIN / FINANCAS') {
  return `<section class="page-banner" style="--banner-image:url('${image}')"><div class="banner-copy"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${copy}</p></div><span class="banner-mark" aria-hidden="true">GF</span></section>`;
}

// ─── PÁGINAS DE AUTENTICAÇÃO ──────────────────────────────────────────────────

function loginPage() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  return `<main class="login-screen">
    <section class="login-visual" style="--login-image:url('https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1500&q=85')">
      <div class="login-visual-copy">
        <span class="eyebrow">GEST-FIN / GESTAO FINANCEIRA</span>
        <h1>Mais clareza.<br />Melhores decisoes.</h1>
        <p>Organize suas contas, acompanhe seu fluxo e planeje o que vem pela frente.</p>
      </div>
      <span class="login-visual-mark">GF / 01</span>
    </section>
    <section class="login-side">
      <div class="login-side-top">
        <a class="brand" href="#login"><span class="brand-symbol"><img src="/logo.svg" alt="Gest-fin" /></span><span>gest-fin<small>FINANCAS EM FOCO</small></span></a>
        <button class="theme-toggle" data-theme-toggle aria-label="${isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}" title="${isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}"><span aria-hidden="true"></span></button>
      </div>
      <div class="login-form-wrap">
        <span class="eyebrow">ACESSO A SUA CONTA</span>
        <h2>Bem-vindo de volta.</h2>
        <p>Entre para acompanhar suas financas.</p>
        <form class="login-form" id="login-form">
          <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="username" placeholder="voce@gestfin.com" required /></label>
          <label class="field"><span>Senha</span><input type="password" name="password" autocomplete="current-password" placeholder="Sua senha" minlength="4" required /></label>
          <div class="auth-message" id="login-error" hidden></div>
          <button class="primary-button login-submit" type="submit">Entrar no Gest-fin <span>↗</span></button>
        </form>
        <div class="auth-links">
          <button class="auth-link" data-auth-screen="forgot">Esqueci minha senha</button>
          <span class="auth-link-sep">·</span>
          <button class="auth-link" data-auth-screen="register">Criar conta</button>
        </div>
      </div>
      <div class="login-footer">Seus dados financeiros ficam salvos no servidor local.</div>
    </section>
  </main>`;
}

function registerPage() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  return `<main class="login-screen">
    <section class="login-visual" style="--login-image:url('https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1500&q=85')">
      <div class="login-visual-copy">
        <span class="eyebrow">GEST-FIN / NOVA CONTA</span>
        <h1>Comece com<br />o pe direito.</h1>
        <p>Crie sua conta e tenha controle total das suas financas a partir de hoje.</p>
      </div>
      <span class="login-visual-mark">GF / 02</span>
    </section>
    <section class="login-side">
      <div class="login-side-top">
        <a class="brand" href="#login"><span class="brand-symbol"><img src="/logo.svg" alt="Gest-fin" /></span><span>gest-fin<small>FINANCAS EM FOCO</small></span></a>
        <button class="theme-toggle" data-theme-toggle aria-label="${isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}" title="${isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}"><span aria-hidden="true"></span></button>
      </div>
      <div class="login-form-wrap">
        <span class="eyebrow">CRIAR CONTA</span>
        <h2>Sua conta Gest-fin.</h2>
        <p>Preencha os dados abaixo para comecar.</p>
        <form class="login-form" id="register-form">
          <label class="field"><span>Nome completo</span><input type="text" name="name" autocomplete="name" placeholder="Seu nome" minlength="2" maxlength="60" required /></label>
          <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="username" placeholder="voce@email.com" required /></label>
          <label class="field"><span>Senha</span><input type="password" name="password" autocomplete="new-password" placeholder="Minimo 6 caracteres" minlength="6" required /></label>
          <label class="field"><span>Confirmar senha</span><input type="password" name="confirm" autocomplete="new-password" placeholder="Repita a senha" minlength="6" required /></label>
          <div class="auth-message" id="register-msg" hidden></div>
          <button class="primary-button login-submit" type="submit">Criar minha conta <span>↗</span></button>
        </form>
        <div class="auth-links">
          <button class="auth-link" data-auth-screen="login">Ja tenho uma conta</button>
        </div>
      </div>
      <div class="login-footer">Seus dados financeiros ficam salvos no servidor local.</div>
    </section>
  </main>`;
}

function forgotPage() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  return `<main class="login-screen">
    <section class="login-visual" style="--login-image:url('https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1500&q=85')">
      <div class="login-visual-copy">
        <span class="eyebrow">GEST-FIN / REDEFINIR ACESSO</span>
        <h1>Redefina sua<br />senha agora.</h1>
        <p>Informe seu email e a nova senha para recuperar o acesso a sua conta.</p>
      </div>
      <span class="login-visual-mark">GF / 03</span>
    </section>
    <section class="login-side">
      <div class="login-side-top">
        <a class="brand" href="#login"><span class="brand-symbol"><img src="/logo.svg" alt="Gest-fin" /></span><span>gest-fin<small>FINANCAS EM FOCO</small></span></a>
        <button class="theme-toggle" data-theme-toggle aria-label="${isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}" title="${isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}"><span aria-hidden="true"></span></button>
      </div>
      <div class="login-form-wrap">
        <span class="eyebrow">ESQUECI MINHA SENHA</span>
        <h2>Redefinir senha.</h2>
        <p>Digite o email da conta e escolha uma nova senha.</p>
        <form class="login-form" id="forgot-form">
          <label class="field"><span>E-mail da conta</span><input type="email" name="email" autocomplete="username" placeholder="voce@email.com" required /></label>
          <label class="field"><span>Nova senha</span><input type="password" name="newPassword" autocomplete="new-password" placeholder="Minimo 6 caracteres" minlength="6" required /></label>
          <label class="field"><span>Confirmar nova senha</span><input type="password" name="confirm" autocomplete="new-password" placeholder="Repita a nova senha" minlength="6" required /></label>
          <div class="auth-message" id="forgot-msg" hidden></div>
          <button class="primary-button login-submit" type="submit">Redefinir senha <span>↗</span></button>
        </form>
        <div class="auth-links">
          <button class="auth-link" data-auth-screen="login">Voltar ao login</button>
        </div>
      </div>
      <div class="login-footer">Seus dados financeiros ficam salvos no servidor local.</div>
    </section>
  </main>`;
}

function shell(content) {
  const items = [['overview', 'Visao geral', '01'], ['new', 'Novo lancamento', '02'], ['bills', 'Contas a pagar', '03'], ['income', 'Receitas', '04'], ['reports', 'Relatorios', '05']];
  const userName = state.user?.name || 'Usuario';
  const userInitials = userName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const isDark = document.documentElement.dataset.theme === 'dark';

  const navItems = items.map(([key, label, number]) => `<button class="nav-item ${state.page === key ? 'active' : ''}" data-page="${key}"><span class="nav-number">${number}</span><span>${label}</span>${state.page === key ? '<i></i>' : ''}</button>`).join('');

  return `<div class="layout">

    <!-- ── Mobile topbar + drawer ── -->
    <div class="mobile-topbar">
      <a class="brand" href="#overview" aria-label="Gest-fin, inicio">
        <span class="brand-symbol"><img src="/logo.svg" alt="Gest-fin" /></span>
        <span>gest-fin<small>FINANCAS EM FOCO</small></span>
      </a>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="theme-toggle" data-theme-toggle aria-label="${isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}"><span aria-hidden="true"></span></button>
        <button class="hamburger" id="hamburger-btn" aria-label="Abrir menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
    <div class="mobile-nav-overlay" id="mobile-overlay"></div>
    <nav class="mobile-nav-drawer" id="mobile-drawer" aria-label="Menu principal">
      <div class="mobile-nav-header">
        <a class="brand" href="#overview"><span class="brand-symbol"><img src="/logo.svg" alt="Gest-fin" /></span><span>gest-fin<small>FINANCAS EM FOCO</small></span></a>
        <button class="mobile-nav-close" id="mobile-close" aria-label="Fechar menu">✕</button>
      </div>
      <div class="mobile-nav-items" id="mobile-nav-items">
        ${navItems}
      </div>
      <div class="mobile-nav-footer">
        <div class="mobile-profile">
          <div class="avatar">${safe(userInitials)}</div>
          <div class="mobile-profile-info">
            <strong>${safe(userName)}</strong>
            <small>${safe(state.user?.email || '')}</small>
          </div>
        </div>
        <button class="mobile-logout" data-logout>Sair da conta</button>
      </div>
    </nav>

    <!-- ── Desktop sidebar ── -->
    <aside class="sidebar">
      <a class="brand" href="#overview" aria-label="Gest-fin, inicio"><span class="brand-symbol"><img src="/logo.svg" alt="Gest-fin" /></span><span>gest-fin<small>FINANCAS EM FOCO</small></span></a>
      <div class="side-label">MENU PRINCIPAL</div>
      <nav class="side-nav" aria-label="Navegacao principal">${navItems}</nav>
      <div class="sidebar-bottom">
        <div class="sidebar-note"><span class="note-dot"></span><span>Dados salvos no<br />banco de dados local.</span></div>
        <div class="profile">
          <div class="avatar">${safe(userInitials)}</div>
          <span class="profile-identity"><strong>${safe(userName)}</strong><small>${safe(state.user?.email || '')}</small></span>
          <button class="profile-more" data-account-menu aria-label="Abrir menu da conta" aria-expanded="false" title="Opcoes da conta">...</button>
          <div class="account-menu" hidden>
            <span class="account-menu-label">DADOS FINANCEIROS</span>
            <button data-export="csv">Exportar CSV</button>
            <button data-export="json">Exportar JSON</button>
            <hr />
            <button class="logout-action" data-logout>Sair da conta</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- ── Main area ── -->
    <main class="main-area">
      <header class="topbar">
        <div>
          <span class="top-date">${new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(today)}</span>
          <span class="breadcrumb">Painel <b>/</b> ${pageName(state.page)}</span>
        </div>
        <div class="top-actions">
          <button class="icon-button search-toggle" aria-label="Buscar lancamentos" title="Buscar">-</button>
          <button class="notification-button" aria-label="Notificacoes" title="Notificacoes"><span>-</span><i></i></button>
          <button class="top-avatar" aria-label="Perfil">${safe(userInitials)}</button>
        </div>
      </header>
      <div class="page-content">${content}</div>
    </main>
  </div>`;
}

function statCard(label, value, note, tone = 'neutral', icon = '-') {
  return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><strong class="stat-value">${value}</strong><div class="stat-note ${tone}">${note}</div></article>`;
}

function monthChart() {
  const months = Array.from({ length: 6 }, (_, index) => new Date(today.getFullYear(), today.getMonth() - 5 + index, 1));
  const values = months.map((date) => {
    const records = monthTransactions(monthKey(date));
    return { label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', ''), income: total(incomes(records)), expense: total(expenses(records)) };
  });
  const max = Math.max(1, ...values.flatMap((item) => [item.income, item.expense]));
  return `<div class="chart-legend"><span><i class="legend-income"></i>Entradas</span><span><i class="legend-expense"></i>Saidas</span><strong>${monthFormat.format(today)}</strong></div><div class="bar-chart">${values.map((item) => `<div class="bar-column"><div class="bar-pair"><i class="bar income-bar" style="height:${Math.max(3, item.income / max * 100)}%" title="Entradas: ${money(item.income)}"></i><i class="bar expense-bar" style="height:${Math.max(3, item.expense / max * 100)}%" title="Saidas: ${money(item.expense)}"></i></div><span>${item.label}</span></div>`).join('')}</div>`;
}

function categoryBreakdown() {
  const byCategory = expenses(monthTransactions(currentMonth)).reduce((result, item) => {
    result[item.category] = (result[item.category] || 0) + Number(item.amount);
    return result;
  }, {});
  const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const spent = rows.reduce((sum, row) => sum + row[1], 0) || 1;
  let offset = 0;
  const stops = rows.map(([, value], index) => {
    const start = offset;
    offset += value / spent * 100;
    return `${categoryColors[index % categoryColors.length]} ${start}% ${offset}%`;
  });
  const segments = rows.map(([category, value], index) => `<div class="category-row"><span class="category-dot" style="--dot:${categoryColors[index % categoryColors.length]}"></span><span class="category-name">${safe(category)}</span><span class="category-amount">${money(value)}</span><span class="category-share">${Math.round(value / spent * 100)}%</span></div>`).join('');
  return `<div class="category-layout"><div class="donut" style="--donut:${stops.length ? `conic-gradient(${stops.join(',')})` : 'conic-gradient(#dfe4dc 0 100%)'}"><div><strong>${money(spent)}</strong><span>consumido</span></div></div><div class="category-list">${segments || '<p class="empty-note">Sem despesas neste mes.</p>'}</div></div>`;
}

function transactionRows(items, limit = 6) {
  return [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit).map((item) => `<tr data-transaction-id="${safe(item.id)}"><td><span class="table-title">${safe(item.title)}</span><small>${safe(item.account || 'Conta principal')}</small></td><td><span class="category-pill">${safe(item.category)}</span></td><td>${dateFormat.format(new Date(`${item.date}T12:00:00`))}</td><td><span class="status ${item.status}"><i></i>${item.status === 'paid' ? 'Pago' : 'Pendente'}</span></td><td class="amount ${item.type}">${item.type === 'income' ? '+' : '-'} ${money(item.amount)}</td></tr>`).join('');
}

function upcomingBills(limit = 4) {
  return expenses(state.transactions).filter((item) => item.status === 'pending').sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

function overviewPage() {
  const current = monthTransactions(currentMonth);
  const priorSpending = total(expenses(monthTransactions(previousMonth)));
  const spending = total(expenses(current));
  const variance = priorSpending ? Math.round((spending - priorSpending) / priorSpending * 100) : 0;
  const dueSoon = upcomingBills().length;
  const balance = total(incomes(current)) - total(expenses(current));
  const recent = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date));
  return `${imageBanner('Clareza para decidir.<br />Controle para crescer.', 'Uma visao objetiva do seu fluxo financeiro, compromissos e oportunidades.', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1500&q=85', 'PAINEL EXECUTIVO / OUTUBRO 2026')}<div class="section-heading"><div><span class="eyebrow">RESUMO DO PERIODO</span><h2>Visao geral</h2></div><button class="text-button" data-page="reports">Ver relatorios <span>-</span></button></div><div class="stats-grid">${statCard('Saldo disponivel', money(balance), '<span class="up">Atualizado agora</span>', 'positive', 'R$')}${statCard('Despesas do mes', money(spending), `${variance > 0 ? '<span class="down">+' : '<span class="up">'}${Math.abs(variance)}%</span> vs. mes anterior`, variance > 0 ? 'negative' : 'positive', '-')}${statCard('Receitas recebidas', money(total(incomes(current))), `<span class="up">${incomes(current).length} entradas</span> neste mes`, 'positive', '+')}${statCard('Contas em aberto', String(dueSoon).padStart(2, '0'), '<span class="neutral-tag">Proximos vencimentos</span>', 'neutral', '-')}</div><div class="dashboard-grid"><section class="panel chart-panel"><div class="panel-heading"><div><span class="eyebrow">FLUXO DE CAIXA</span><h3>Entradas e saidas</h3></div></div>${monthChart()}</section><section class="panel category-panel"><div class="panel-heading"><div><span class="eyebrow">ONDE SEU DINHEIRO VAI</span><h3>Consumo por categoria</h3></div></div>${categoryBreakdown()}</section></div><div class="dashboard-grid lower-grid"><section class="panel table-panel"><div class="panel-heading"><div><span class="eyebrow">MOVIMENTACOES</span><h3>Recentes</h3></div><button class="text-button" data-page="new">Novo lancamento <span>+</span></button></div><div class="table-wrap"><table><thead><tr><th>DESCRICAO</th><th>CATEGORIA</th><th>DATA</th><th>STATUS</th><th class="align-right">VALOR</th></tr></thead><tbody>${transactionRows(recent, 5)}</tbody></table></div></section><section class="panel due-panel"><div class="panel-heading"><div><span class="eyebrow">AGENDA FINANCEIRA</span><h3>Proximos vencimentos</h3></div><button class="text-button" data-page="bills">Ver todas <span>-</span></button></div><div class="due-list">${billRows(upcomingBills(3), true)}</div></section></div>`;
}

function billRows(items, compact = false) {
  if (!items.length) return '<div class="empty-state small-empty"><span class="empty-check">-</span><strong>Tudo em dia</strong><p>Nenhuma conta pendente por aqui.</p></div>';
  return items.map((item) => `<article class="bill-row" data-transaction-id="${safe(item.id)}"><div class="bill-date"><strong>${new Date(`${item.date}T12:00:00`).getDate()}</strong><span>${new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${item.date}T12:00:00`)).replace('.', '')}</span></div><div class="bill-info"><strong>${safe(item.title)}</strong><small>${safe(item.category)} - ${safe(item.account || 'Conta principal')}</small></div><div class="bill-value"><strong>${money(item.amount)}</strong><small>${item.status === 'paid' ? 'Pago' : 'A vencer'}</small></div>${compact ? '' : `<div class="bill-actions">${item.status === 'pending' ? `<button class="settle-button" data-paid="${safe(item.id)}">Marcar pago</button>` : '<span class="status paid"><i></i>Pago</span>'}<button class="delete-action" data-delete="${safe(item.id)}" aria-label="Excluir ${safe(item.title)}" title="Excluir lancamento">-</button></div>`}</article>`).join('');
}

function newPage() {
  return `${imageBanner('Registre com<br />intencao.', 'Cada lancamento conta uma parte da sua historia financeira.', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1500&q=85', 'MOVIMENTACOES / NOVO REGISTRO')}<div class="section-heading form-intro"><div><span class="eyebrow">NOVO REGISTRO</span><h2>Adicionar lancamento</h2><p>Os dados ficam salvos no banco de dados.</p></div></div><section class="panel form-panel"><form id="transaction-form"><div class="form-type"><label class="type-choice"><input type="radio" name="type" value="expense" checked /><span>Saida</span></label><label class="type-choice"><input type="radio" name="type" value="income" /><span>Entrada</span></label></div><div class="form-grid"><label class="field field-wide"><span>Descricao</span><input name="title" required maxlength="80" placeholder="Ex.: Fornecedores, salario, aluguel" /></label><label class="field"><span>Valor</span><div class="currency-input"><b>R$</b><input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00" /></div></label><label class="field"><span>Categoria</span><select name="category" required>${categories.expense.map((item) => `<option>${item}</option>`).join('')}</select></label><label class="field"><span>Data de vencimento / recebimento</span><input name="date" type="date" value="${isoDate(today.getDate())}" required /></label><label class="field"><span>Conta</span><select name="account"><option>Conta principal</option><option>Cartao corporativo</option><option>Reserva</option></select></label><label class="field"><span>Status</span><select name="status"><option value="pending">Pendente</option><option value="paid">Pago / recebido</option></select></label><label class="field field-wide"><span>Observacao <small>OPCIONAL</small></span><textarea name="note" rows="3" placeholder="Detalhes adicionais"></textarea></label></div><div class="form-footer"><span><i class="secure-dot"></i>Registro salvo no banco de dados</span><button class="primary-button" type="submit">Salvar lancamento <span>-</span></button></div></form></section>`;
}

function billsPage() {
  const bills = expenses(state.transactions).sort((a, b) => a.date.localeCompare(b.date));
  const pending = bills.filter((item) => item.status === 'pending');
  return `${imageBanner('Antecipe seus<br />compromissos.', 'Vencimentos organizados para voce manter o controle e a tranquilidade.', 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1500&q=85', 'AGENDA / CONTAS A PAGAR')}<div class="section-heading"><div><span class="eyebrow">${pending.length} PENDENTES</span><h2>Contas a pagar</h2></div><button class="primary-button" data-page="new">+ Novo lancamento</button></div><section class="panel bills-panel"><div class="list-head"><span>VENCIMENTO / DESCRICAO</span><span>VALOR</span><span>ACAO</span></div><div class="due-list full-list">${billRows(bills)}</div></section>`;
}

function incomePage() {
  const records = incomes(state.transactions).sort((a, b) => b.date.localeCompare(a.date));
  const thisMonth = total(incomes(monthTransactions(currentMonth)));
  return `${imageBanner('Receita bem cuidada<br />vira possibilidade.', 'Acompanhe entradas confirmadas e valores previstos para o periodo.', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1500&q=85', 'FLUXO DE CAIXA / RECEITAS')}<div class="stats-grid income-stats">${statCard('Recebido no mes', money(thisMonth), '<span class="up">Entradas confirmadas</span>', 'positive', '+')}${statCard('Total de registros', String(records.length).padStart(2, '0'), 'No historico financeiro', 'neutral', '#')}${statCard('Total pendente', money(total(records.filter((item) => item.status === 'pending'))), '<span class="neutral-tag">A receber</span>', 'neutral', '-')}</div><section class="panel table-panel income-table"><div class="panel-heading"><div><span class="eyebrow">HISTORICO</span><h3>Receitas registradas</h3></div><button class="primary-button" data-page="new">+ Nova receita</button></div><div class="table-wrap"><table><thead><tr><th>DESCRICAO</th><th>ORIGEM</th><th>DATA</th><th>STATUS</th><th class="align-right">VALOR</th></tr></thead><tbody>${records.map((item) => `<tr data-transaction-id="${safe(item.id)}"><td><span class="table-title">${safe(item.title)}</span><small>${safe(item.account || 'Conta principal')}</small></td><td><span class="category-pill">${safe(item.category)}</span></td><td>${dateFormat.format(new Date(`${item.date}T12:00:00`))}</td><td><span class="status ${item.status}"><i></i>${item.status === 'paid' ? 'Recebido' : 'Previsto'}</span></td><td class="amount income">+ ${money(item.amount)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-note">Nenhuma receita registrada.</td></tr>'}</tbody></table></div></section>`;
}

function reportsPage() {
  const currentExpense = total(expenses(monthTransactions(currentMonth)));
  const previousExpense = total(expenses(monthTransactions(previousMonth)));
  const difference = currentExpense - previousExpense;
  return `${imageBanner('Decisoes melhores<br />com dados claros.', 'Compare periodos, entenda seus habitos e escolha o proximo passo.', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1500&q=85', 'ANALISE / RELATORIOS')}<div class="section-heading"><div><span class="eyebrow">ANALISE MENSAL</span><h2>Relatorios</h2></div><span class="period-label">${monthFormat.format(today)}</span></div><div class="stats-grid report-stats">${statCard('Despesas atuais', money(currentExpense), `Este mes - <span class="${difference <= 0 ? 'up' : 'down'}">${difference <= 0 ? '-' : '+'} ${money(Math.abs(difference))}</span>`, difference <= 0 ? 'positive' : 'negative', '-')}${statCard('Despesas anteriores', money(previousExpense), `${monthFormat.format(previousDate)}`, 'neutral', '-')}${statCard('Variacao mensal', `${previousExpense ? Math.round((difference / previousExpense) * 100) : 0}%`, difference <= 0 ? '<span class="up">Reducao no periodo</span>' : '<span class="down">Acima do periodo anterior</span>', difference <= 0 ? 'positive' : 'negative', '-')}</div><div class="dashboard-grid report-grid"><section class="panel chart-panel"><div class="panel-heading"><div><span class="eyebrow">COMPARATIVO</span><h3>Fluxo dos ultimos meses</h3></div></div>${monthChart()}</section><section class="panel category-panel"><div class="panel-heading"><div><span class="eyebrow">DISTRIBUICAO</span><h3>Despesas por categoria</h3></div></div>${categoryBreakdown()}</section></div>`;
}

function cardsPage() {
  const cards = state.cards.map((card, index) => {
    const charges = state.transactions.filter((item) => item.cardId === card.id);
    const openCharges = charges.filter((item) => item.status === 'pending');
    const currentInvoice = total(charges.filter((item) => monthKey(new Date(`${item.date}T12:00:00`)) === currentMonth));
    const committed = total(openCharges);
    const utilization = card.limit ? Math.min(100, Math.round(committed / Number(card.limit) * 100)) : 0;
    const nextDue = [...openCharges].sort((a, b) => a.date.localeCompare(b.date))[0];
    return `<article class="credit-card-card"><div class="credit-card-face card-tone-${index % 3}"><div class="card-face-top"><span>${safe(card.issuer)}</span><i data-lucide="credit-card"></i></div><span class="card-number">•••• &nbsp;•••• &nbsp;•••• &nbsp;${safe(card.lastFour)}</span><div class="card-face-bottom"><span>${safe(card.name)}<small>CARTÃO DE CRÉDITO</small></span><span>CRÉDITO</span></div></div><div class="card-details"><div class="card-limit-label"><span>Limite comprometido</span><strong>${money(committed)} <small>de ${money(card.limit)}</small></strong></div><div class="limit-track"><i style="width:${utilization}%"></i></div><div class="card-stat-pair"><div><span>Fatura neste mês</span><strong>${money(currentInvoice)}</strong></div><div><span>Próximo vencimento</span><strong>${nextDue ? dateFormat.format(new Date(`${nextDue.date}T12:00:00`)) : 'Sem pendências'}</strong></div></div><p class="cycle-note">Fecha dia ${card.closingDay} · Vence dia ${card.dueDay}</p></div></article>`;
  }).join('');
  const installments = state.transactions.filter((item) => item.paymentMethod === 'credit').sort((a, b) => a.date.localeCompare(b.date));
  const installmentRows = installments.map((item) => {
    const card = state.cards.find((entry) => entry.id === item.cardId);
    const installmentLabel = item.installmentCount > 1 ? `Parcela ${item.installmentNumber} de ${item.installmentCount}` : 'À vista';
    return `<article class="installment-row"><div class="bill-date"><strong>${new Date(`${item.date}T12:00:00`).getDate()}</strong><span>${new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${item.date}T12:00:00`)).replace('.', '')}</span></div><div class="installment-info"><strong>${safe(item.title)}</strong><small>${safe(card?.name || 'Cartão removido')} · ${installmentLabel}</small></div><div class="installment-value"><strong>${money(item.amount)}</strong><small class="status ${item.status}"><i></i>${item.status === 'paid' ? 'Pago' : 'Em aberto'}</small></div><div class="bill-actions">${item.status === 'pending' ? `<button class="settle-button" data-paid="${safe(item.id)}">Marcar pago</button>` : ''}<button class="delete-action" data-delete="${safe(item.id)}" aria-label="Excluir ${safe(item.title)}" title="Excluir compra">-</button></div></article>`;
  }).join('');
  return `${imageBanner('Cartões sob controle.<br />Parcelas sem surpresa.', 'Acompanhe faturas, limite comprometido e vencimentos de cada compra.', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1500&q=85', 'CRÉDITO / CARTÕES')}<div class="section-heading"><div><span class="eyebrow">CARTEIRA DE CRÉDITO</span><h2>Cartões</h2></div><button class="primary-button" data-toggle-card-form>+ Adicionar cartão</button></div><form id="card-form" class="panel card-form" hidden><div class="panel-heading"><div><span class="eyebrow">NOVO MEIO DE PAGAMENTO</span><h3>Cadastrar cartão</h3></div></div><div class="form-grid"><label class="field"><span>Nome do cartão</span><input name="cardName" maxlength="40" placeholder="Ex.: Cartão principal" required /></label><label class="field"><span>Emissor</span><input name="issuer" maxlength="30" placeholder="Ex.: Banco Horizonte" required /></label><label class="field"><span>Quatro últimos dígitos</span><input name="lastFour" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="1234" required /></label><label class="field"><span>Limite total</span><input name="limit" type="number" min="1" step="0.01" placeholder="10000" required /></label><label class="field"><span>Dia de fechamento</span><input name="closingDay" type="number" min="1" max="28" value="20" required /></label><label class="field"><span>Dia do vencimento</span><input name="dueDay" type="number" min="1" max="28" value="5" required /></label></div><div class="form-footer"><span>Datas de fechamento e vencimento usadas para projetar as parcelas.</span><button class="primary-button" type="submit">Salvar cartão</button></div></form><div class="credit-card-grid">${cards || '<div class="panel empty-note">Cadastre um cartão para controlar suas compras.</div>'}</div><section class="panel installments-panel"><div class="panel-heading"><div><span class="eyebrow">FATURAS FUTURAS</span><h3>Compras e parcelas</h3></div><span class="period-label">${installments.length} lançamentos</span></div><div class="installment-list">${installmentRows || '<div class="empty-state small-empty"><span class="empty-check">-</span><strong>Nenhuma compra no crédito</strong><p>Selecione cartão de crédito ao criar um lançamento.</p></div>'}</div></section>`;
}

function enhanceTransactionForm() {
  const form = app.querySelector('#transaction-form');
  if (!form) return;
  const grid = form.querySelector('.form-grid');
  const options = state.cards.map((card) => `<option value="${safe(card.id)}">${safe(card.name)} · final ${safe(card.lastFour)}</option>`).join('');
  grid.insertAdjacentHTML('beforeend', `<label class="field" data-expense-only><span>Forma de pagamento</span><select name="paymentMethod"><option value="account">Conta ou débito</option><option value="credit">Cartão de crédito</option></select></label><div class="card-fields field-wide" data-card-fields hidden><label class="field"><span>Cartão</span><select name="cardId" ${state.cards.length ? 'required' : 'disabled'}>${options || '<option value="">Cadastre um cartão primeiro</option>'}</select></label><label class="field"><span>Parcelas</span><input name="installments" type="number" min="1" max="24" value="1" required /></label></div>`);
  const isExpense = form.querySelector('[name="type"]:checked').value === 'expense';
  form.querySelector('[data-expense-only]').hidden = !isExpense;
}

async function saveCardPurchase(data) {
  const card = state.cards.find((item) => item.id === data.get('cardId'));
  if (!card) throw new Error('Selecione um cartão cadastrado.');
  const installmentCount = Math.max(1, Math.min(24, Number(data.get('installments')) || 1));
  const totalCents = Math.round(Number(data.get('amount')) * 100);
  const baseCents = Math.floor(totalCents / installmentCount);
  const extraCents = totalCents % installmentCount;
  const groupId = crypto.randomUUID();
  const firstDueDate = firstCardDueDate(data.get('date'), card);
  const transactions = Array.from({ length: installmentCount }, (_, index) => ({
    id: crypto.randomUUID(),
    title: data.get('title').trim(),
    category: data.get('category'),
    amount: (baseCents + (index < extraCents ? 1 : 0)) / 100,
    type: 'expense',
    date: installmentDueDate(firstDueDate, index),
    purchaseDate: data.get('date'),
    status: 'pending',
    account: card.name,
    paymentMethod: 'credit',
    cardId: card.id,
    installmentGroup: groupId,
    installmentNumber: index + 1,
    installmentCount,
    note: data.get('note').trim(),
  }));
  await Promise.all(transactions.map(saveTransaction));
}

function addNavigationIcons() {
  const iconsByPage = { overview: 'layout-dashboard', new: 'circle-plus', bills: 'calendar-days', income: 'wallet-cards', reports: 'chart-no-axes-combined' };
  const nav = app.querySelector('.side-nav');
  nav.querySelectorAll('.nav-item').forEach((button) => {
    const icon = iconsByPage[button.dataset.page];
    const number = button.querySelector('.nav-number');
    if (icon && number) number.outerHTML = `<span class="nav-icon" data-lucide="${icon}" aria-hidden="true"></span>`;
  });
  const cardButton = document.createElement('button');
  cardButton.className = `nav-item ${state.page === 'cards' ? 'active' : ''}`;
  cardButton.dataset.page = 'cards';
  cardButton.innerHTML = `<span class="nav-icon" data-lucide="credit-card" aria-hidden="true"></span><span>Cartoes</span>${state.page === 'cards' ? '<i class="nav-active-marker"></i>' : ''}`;
  nav.insertBefore(cardButton, nav.querySelector('[data-page="reports"]'));
  createIcons({ icons: { LayoutDashboard, CirclePlus, CalendarDays, WalletCards, ChartNoAxesCombined, CreditCard }, attrs: { 'stroke-width': 1.8 } });
}

function render() {
  if (!state.user) {
    const screenMap = { login: loginPage, register: registerPage, forgot: forgotPage };
    const screen = screenMap[state.authScreen] || loginPage;
    app.innerHTML = screen();
    return;
  }
  const pages = { overview: overviewPage, new: newPage, bills: billsPage, income: incomePage, reports: reportsPage, cards: cardsPage };
  app.innerHTML = shell(pages[state.page]());
  if (state.page === 'new') enhanceTransactionForm();
  addNavigationIcons();
  app.querySelectorAll('table').forEach((table) => {
    const rows = table.querySelectorAll('tbody tr[data-transaction-id]');
    if (!rows.length) return;
    table.querySelector('thead tr')?.insertAdjacentHTML('beforeend', '<th class="align-right">ACAO</th>');
    rows.forEach((row) => {
      const transaction = state.transactions.find((item) => item.id === row.dataset.transactionId);
      row.insertAdjacentHTML('beforeend', `<td class="table-action"><button class="delete-action" data-delete="${safe(row.dataset.transactionId)}" aria-label="Excluir ${safe(transaction?.title || 'lancamento')}" title="Excluir lancamento">-</button></td>`);
    });
  });
  const themeButton = document.createElement('button');
  const isDark = document.documentElement.dataset.theme === 'dark';
  themeButton.type = 'button';
  themeButton.className = 'theme-toggle';
  themeButton.dataset.themeToggle = '';
  themeButton.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
  themeButton.title = isDark ? 'Ativar tema claro' : 'Ativar tema escuro';
  themeButton.innerHTML = '<span aria-hidden="true"></span>';
  document.querySelector('.top-avatar').before(themeButton);
}

async function refresh() {
  [state.transactions, state.cards] = await Promise.all([readTransactions(), readCards()]);
  render();
}

// ─── HELPERS DE AUTH UI ───────────────────────────────────────────────────────

function showAuthMsg(id, text, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `auth-message auth-message--${type}`;
  el.hidden = false;
}

// ─── EVENTOS ──────────────────────────────────────────────────────────────────

app.addEventListener('click', async (event) => {
  // ── Hamburguer mobile ──
  const hamburger = document.getElementById('hamburger-btn');
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('mobile-overlay');

  function openDrawer() {
    drawer?.classList.add('open');
    overlay?.classList.add('open');
    hamburger?.classList.add('open');
    hamburger?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawer?.classList.remove('open');
    overlay?.classList.remove('open');
    hamburger?.classList.remove('open');
    hamburger?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (event.target.closest('#hamburger-btn')) { openDrawer(); return; }
  if (event.target.closest('#mobile-close') || event.target.closest('#mobile-overlay')) { closeDrawer(); return; }
  if (event.target.closest('[data-theme-toggle]')) {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem('gest-fin-theme', nextTheme);
    render();
    return;
  }

  // Navegação entre telas de autenticação
  const authScreenBtn = event.target.closest('[data-auth-screen]');
  if (authScreenBtn) {
    state.authScreen = authScreenBtn.dataset.authScreen;
    render();
    return;
  }
  const menuToggle = event.target.closest('[data-account-menu]');
  if (menuToggle) {
    const menu = document.querySelector('.account-menu');
    menu.hidden = !menu.hidden;
    menuToggle.setAttribute('aria-expanded', String(!menu.hidden));
    return;
  }
  const exportButton = event.target.closest('[data-export]');
  if (exportButton) {
    exportTransactions(exportButton.dataset.export);
    document.querySelector('.account-menu').hidden = true;
    document.querySelector('[data-account-menu]').setAttribute('aria-expanded', 'false');
    return;
  }
  if (event.target.closest('[data-logout]')) {
    clearToken();
    state.user = null;
    state.transactions = [];
    state.cards = [];
    render();
    return;
  }
  const cardFormToggle = event.target.closest('[data-toggle-card-form]');
  if (cardFormToggle) {
    const form = document.querySelector('#card-form');
    form.hidden = !form.hidden;
    if (!form.hidden) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton) {
    const transaction = state.transactions.find((item) => item.id === deleteButton.dataset.delete);
    if (transaction && window.confirm(`Excluir o lancamento "${transaction.title}"?`)) {
      await deleteTransaction(transaction.id);
      await refresh();
    }
    return;
  }
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) {
    state.page = pageButton.dataset.page;
    // Fecha drawer mobile ao navegar
    document.getElementById('mobile-drawer')?.classList.remove('open');
    document.getElementById('mobile-overlay')?.classList.remove('open');
    document.getElementById('hamburger-btn')?.classList.remove('open');
    document.body.style.overflow = '';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const paidButton = event.target.closest('[data-paid]');
  if (paidButton) await markPaid(paidButton.dataset.paid);
  if (event.target.closest('.search-toggle')) {
    const search = document.querySelector('.quick-search');
    if (search) search.remove();
    else document.querySelector('.topbar').insertAdjacentHTML('beforeend', '<input class="quick-search" placeholder="Buscar lancamento..." aria-label="Buscar lancamento" />');
  }
});

app.addEventListener('change', (event) => {
  if (event.target.name === 'type') {
    document.querySelector('[name="category"]').innerHTML = categories[event.target.value].map((item) => `<option>${safe(item)}</option>`).join('');
    const isExpense = event.target.value === 'expense';
    document.querySelector('[data-expense-only]').hidden = !isExpense;
    if (!isExpense) document.querySelector('[data-card-fields]').hidden = true;
  }
  if (event.target.name === 'paymentMethod') {
    const usingCard = event.target.value === 'credit';
    document.querySelector('[data-card-fields]').hidden = !usingCard;
    document.querySelector('[name="date"]').closest('.field').querySelector('span').textContent = usingCard ? 'Data da compra' : 'Data de vencimento / recebimento';
  }
});

app.addEventListener('submit', async (event) => {
  // ── Login ──
  if (event.target.id === 'login-form') {
    event.preventDefault();
    const btn = event.target.querySelector('[type="submit"]');
    const errorEl = document.getElementById('login-error');
    btn.disabled = true;
    btn.textContent = 'Entrando...';
    errorEl.hidden = true;
    try {
      const email = new FormData(event.target).get('email').trim().toLowerCase();
      const password = new FormData(event.target).get('password');
      const data = await apiFetch('/login', { method: 'POST', body: { email, password } });
      setToken(data.token);
      state.user = data.user;
      state.authScreen = 'login';
      await refresh();
    } catch (err) {
      showAuthMsg('login-error', err.message || 'Email ou senha incorretos.', 'error');
      btn.disabled = false;
      btn.innerHTML = 'Entrar no Gest-fin <span>↗</span>';
    }
    return;
  }

  // ── Cadastro ──
  if (event.target.id === 'register-form') {
    event.preventDefault();
    const fd = new FormData(event.target);
    const name = fd.get('name').trim();
    const email = fd.get('email').trim().toLowerCase();
    const password = fd.get('password');
    const confirm = fd.get('confirm');
    const btn = event.target.querySelector('[type="submit"]');

    if (password !== confirm) {
      showAuthMsg('register-msg', 'As senhas não coincidem.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Criando conta...';
    document.getElementById('register-msg').hidden = true;

    try {
      const data = await apiFetch('/register', { method: 'POST', body: { name, email, password } });
      setToken(data.token);
      state.user = data.user;
      state.authScreen = 'login';
      await refresh();
    } catch (err) {
      showAuthMsg('register-msg', err.message || 'Erro ao criar conta.', 'error');
      btn.disabled = false;
      btn.innerHTML = 'Criar minha conta <span>↗</span>';
    }
    return;
  }

  // ── Esqueci senha ──
  if (event.target.id === 'forgot-form') {
    event.preventDefault();
    const fd = new FormData(event.target);
    const email = fd.get('email').trim().toLowerCase();
    const newPassword = fd.get('newPassword');
    const confirm = fd.get('confirm');
    const btn = event.target.querySelector('[type="submit"]');

    if (newPassword !== confirm) {
      showAuthMsg('forgot-msg', 'As senhas não coincidem.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Redefinindo...';
    document.getElementById('forgot-msg').hidden = true;

    try {
      await apiFetch('/reset-password', { method: 'POST', body: { email, newPassword } });
      showAuthMsg('forgot-msg', 'Senha redefinida com sucesso! Faça login com a nova senha.', 'success');
      btn.disabled = false;
      btn.innerHTML = 'Redefinir senha <span>↗</span>';
      // Redireciona ao login após 2s
      setTimeout(() => {
        state.authScreen = 'login';
        render();
      }, 2000);
    } catch (err) {
      showAuthMsg('forgot-msg', err.message || 'Erro ao redefinir senha.', 'error');
      btn.disabled = false;
      btn.innerHTML = 'Redefinir senha <span>↗</span>';
    }
    return;
  }

  // ── Cartão ──
  if (event.target.id === 'card-form') {
    event.preventDefault();
    const data = new FormData(event.target);
    await saveCard({
      id: crypto.randomUUID(),
      name: data.get('cardName').trim(),
      issuer: data.get('issuer').trim(),
      lastFour: data.get('lastFour'),
      limit: Number(data.get('limit')),
      closingDay: Number(data.get('closingDay')),
      dueDay: Number(data.get('dueDay')),
    });
    await refresh();
    return;
  }

  // ── Transação ──
  if (event.target.id !== 'transaction-form') return;
  event.preventDefault();
  const data = new FormData(event.target);
  if (data.get('type') === 'expense' && data.get('paymentMethod') === 'credit') {
    await saveCardPurchase(data);
    state.page = 'cards';
    await refresh();
    return;
  }
  const transaction = {
    id: crypto.randomUUID(),
    title: data.get('title').trim(),
    amount: Number(data.get('amount')),
    type: data.get('type'),
    category: data.get('category'),
    date: data.get('date'),
    status: data.get('status'),
    account: data.get('account'),
    note: data.get('note').trim(),
    paymentMethod: 'account',
  };
  await saveTransaction(transaction);
  state.page = transaction.type === 'income' ? 'income' : 'overview';
  await refresh();
});

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────

async function start() {
  const token = getToken();
  if (token) {
    try {
      // Valida o token existente buscando o usuário
      const user = await apiFetch('/me');
      state.user = user;
      await refresh();
      return;
    } catch {
      // Token expirado ou inválido — limpa e exibe login
      clearToken();
    }
  }
  render(); // exibe login
}

start();
