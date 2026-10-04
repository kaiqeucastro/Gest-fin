import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db } from './db.js';
import { generateToken, requireAuth } from './auth.js';

const router = Router();

// ─── AUTH ────────────────────────────────────────────────────────────────────

// POST /api/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });

  const user = db.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!user)
    return res.status(401).json({ error: 'Credenciais inválidas.' });

  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Credenciais inválidas.' });

  const token = generateToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// POST /api/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existing)
    return res.status(409).json({ error: 'Este email já está cadastrado.' });

  const id = randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)', [id, name.trim(), normalizedEmail, hash]);

  const user = { id, name: name.trim(), email: normalizedEmail };
  const token = generateToken(user);
  res.status(201).json({ token, user });
});

// POST /api/reset-password
router.post('/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword)
    return res.status(400).json({ error: 'Email e nova senha são obrigatórios.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });

  const user = db.get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (user) {
    const hash = bcrypt.hashSync(newPassword, 10);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hash, user.id]);
  }
  // Sempre retorna ok (não revela se o email existe)
  res.json({ ok: true });
});

// GET /api/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  res.json(user);
});

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

// GET /api/transactions
router.get('/transactions', requireAuth, (req, res) => {
  const rows = db.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC', [req.user.id]);
  res.json(rows.map(toTransaction));
});

// POST /api/transactions
router.post('/transactions', requireAuth, (req, res) => {
  const t = req.body;
  if (!t.id || !t.title || !t.amount || !t.type || !t.date || !t.status)
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });

  db.run(`
    INSERT OR REPLACE INTO transactions
    (id, user_id, title, category, amount, type, date, purchase_date, status, account, note,
     payment_method, card_id, installment_group, installment_number, installment_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
    t.id, req.user.id, t.title, t.category || '', Number(t.amount), t.type, t.date,
    t.purchaseDate || null, t.status, t.account || '', t.note || '',
    t.paymentMethod || 'account', t.cardId || null,
    t.installmentGroup || null, t.installmentNumber || 1, t.installmentCount || 1,
  ]);
  res.json({ ok: true });
});

// DELETE /api/transactions/:id
router.delete('/transactions/:id', requireAuth, (req, res) => {
  const result = db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.changes) return res.status(404).json({ error: 'Transação não encontrada.' });
  res.json({ ok: true });
});

// ─── CARDS ────────────────────────────────────────────────────────────────────

// GET /api/cards
router.get('/cards', requireAuth, (req, res) => {
  const rows = db.all('SELECT * FROM cards WHERE user_id = ? ORDER BY name', [req.user.id]);
  res.json(rows.map(toCard));
});

// POST /api/cards
router.post('/cards', requireAuth, (req, res) => {
  const c = req.body;
  if (!c.id || !c.name || !c.issuer || !c.lastFour)
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });

  db.run(`
    INSERT OR REPLACE INTO cards (id, user_id, name, issuer, last_four, card_limit, closing_day, due_day)
    VALUES (?,?,?,?,?,?,?,?)
  `, [c.id, req.user.id, c.name, c.issuer, c.lastFour, Number(c.limit) || 0, c.closingDay || 20, c.dueDay || 5]);
  res.json({ ok: true });
});

// DELETE /api/cards/:id
router.delete('/cards/:id', requireAuth, (req, res) => {
  const result = db.run('DELETE FROM cards WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!result.changes) return res.status(404).json({ error: 'Cartão não encontrado.' });
  res.json({ ok: true });
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function toTransaction(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    amount: row.amount,
    type: row.type,
    date: row.date,
    purchaseDate: row.purchase_date,
    status: row.status,
    account: row.account,
    note: row.note,
    paymentMethod: row.payment_method,
    cardId: row.card_id,
    installmentGroup: row.installment_group,
    installmentNumber: row.installment_number,
    installmentCount: row.installment_count,
  };
}

function toCard(row) {
  return {
    id: row.id,
    name: row.name,
    issuer: row.issuer,
    lastFour: row.last_four,
    limit: row.card_limit,
    closingDay: row.closing_day,
    dueDay: row.due_day,
  };
}

export default router;
