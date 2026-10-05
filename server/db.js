import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title              TEXT NOT NULL,
      category           TEXT NOT NULL DEFAULT '',
      amount             NUMERIC NOT NULL,
      type               TEXT NOT NULL,
      date               TEXT NOT NULL,
      purchase_date      TEXT,
      status             TEXT NOT NULL,
      account            TEXT DEFAULT '',
      note               TEXT DEFAULT '',
      payment_method     TEXT DEFAULT 'account',
      card_id            TEXT,
      installment_group  TEXT,
      installment_number INTEGER DEFAULT 1,
      installment_count  INTEGER DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cards (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      issuer      TEXT NOT NULL,
      last_four   TEXT NOT NULL,
      card_limit  NUMERIC NOT NULL DEFAULT 0,
      closing_day INTEGER NOT NULL DEFAULT 20,
      due_day     INTEGER NOT NULL DEFAULT 5
    )
  `);

  console.log('✅ Banco de dados PostgreSQL pronto.');
}

// Wrapper simples para manter compatibilidade com o código existente
export const db = {
  async all(sql, params = []) {
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  async get(sql, params = []) {
    const { rows } = await pool.query(sql, params);
    return rows[0] || null;
  },
  async run(sql, params = []) {
    const result = await pool.query(sql, params);
    return { changes: result.rowCount };
  },
};
