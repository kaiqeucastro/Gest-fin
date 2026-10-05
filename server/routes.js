import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db } from './db.js';
import { generateToken, requireAuth } from './auth.js';

const router = Router();

// ─── AUTH ─────────────────────────────────────────────────────────────────────

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });

    const user = await db.get('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Credenciais inválidas.' });

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.get('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing)
      return res.status(409).json({ error: 'Este email já está cadastrado.' });

    const id = randomUUID();
    const hash = bcrypt.hashSync(password, 10);
    await db.run('INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)',
      [id, name.trim(), normalizedEmail, hash]);

    const user = { id, name: name.trim(), email: normalizedEmail };
    res.status(201).json({ token: generateToken(user), user });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// POST /api/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res.status(400).json({ error: 'Email e nova senha são obrigatórios.' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });

    const user = await db.get('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (user) {
      const hash = bcrypt.hashSync(newPassword, 10);
      await db.run('UPDATE users SET password = $1 WHERE id = $2', [hash, user.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('reset-password error:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// GET /api/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT id, name, email, created_at FROM users WHERE id = $1', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC',
      [req.user.id]
    );
    res.json(rows.map(toTransaction));
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.post('/transactions', requireAuth, async (req, res) => {
  try {
    const t = req.body;
    if (!t.id || !t.title || !t.amount || !t.type || !t.date || !t.status)
      return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });

    await db.run(`
      INSERT INTO transactions
        (id, user_id, title, category, amount, type, date, purchase_date, status,
         account, note, payment_method, card_id, installment_group, installment_number, installment_count)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO UPDATE SET
        title=EXCLUDED.title, category=EXCLUDED.category, amount=EXCLUDED.amount,
        type=EXCLUDED.type, date=EXCLUDED.date, purchase_date=EXCLUDED.purchase_date,
        status=EXCLUDED.status, account=EXCLUDED.account, note=EXCLUDED.note,
        payment_method=EXCLUDED.payment_method, card_id=EXCLUDED.card_id,
        installment_group=EXCLUDED.installment_group,
        installment_number=EXCLUDED.installment_number,
        installment_count=EXCLUDED.installment_count
    `, [
      t.id, req.user.id, t.title, t.category || '', Number(t.amount), t.type, t.date,
      t.purchaseDate || null, t.status, t.account || '', t.note || '',
      t.paymentMethod || 'account', t.cardId || null,
      t.installmentGroup || null, t.installmentNumber || 1, t.installmentCount || 1,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('save transaction error:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.delete('/transactions/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.run(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!result.changes) return res.status(404).json({ error: 'Transação não encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─── CARDS ────────────────────────────────────────────────────────────────────

router.get('/cards', requireAuth, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM cards WHERE user_id = $1 ORDER BY name', [req.user.id]);
    res.json(rows.map(toCard));
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.post('/cards', requireAuth, async (req, res) => {
  try {
    const c = req.body;
    if (!c.id || !c.name || !c.issuer || !c.lastFour)
      return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });

    await db.run(`
      INSERT INTO cards (id, user_id, name, issuer, last_four, card_limit, closing_day, due_day)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, issuer=EXCLUDED.issuer, last_four=EXCLUDED.last_four,
        card_limit=EXCLUDED.card_limit, closing_day=EXCLUDED.closing_day, due_day=EXCLUDED.due_day
    `, [c.id, req.user.id, c.name, c.issuer, c.lastFour, Number(c.limit) || 0, c.closingDay || 20, c.dueDay || 5]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

router.delete('/cards/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.run(
      'DELETE FROM cards WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!result.changes) return res.status(404).json({ error: 'Cartão não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function toTransaction(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    amount: Number(row.amount),
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
    limit: Number(row.card_limit),
    closingDay: row.closing_day,
    dueDay: row.due_day,
  };
}

export default router;
