import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'gest-fin.db');

// Inicializa o sql.js e carrega (ou cria) o banco em disco
let _db = null;

export async function initDatabase() {
  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  // Criar tabelas se não existirem
  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL,
      title              TEXT NOT NULL,
      category           TEXT NOT NULL,
      amount             REAL NOT NULL,
      type               TEXT NOT NULL,
      date               TEXT NOT NULL,
      purchase_date      TEXT,
      status             TEXT NOT NULL,
      account            TEXT,
      note               TEXT,
      payment_method     TEXT DEFAULT 'account',
      card_id            TEXT,
      installment_group  TEXT,
      installment_number INTEGER DEFAULT 1,
      installment_count  INTEGER DEFAULT 1
    )
  `);

  _db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      name        TEXT NOT NULL,
      issuer      TEXT NOT NULL,
      last_four   TEXT NOT NULL,
      card_limit  REAL NOT NULL DEFAULT 0,
      closing_day INTEGER NOT NULL DEFAULT 20,
      due_day     INTEGER NOT NULL DEFAULT 5
    )
  `);

  persist();
  console.log('✅ Banco de dados pronto:', DB_PATH);
  return _db;
}

// Salva o banco em disco após cada escrita
export function persist() {
  if (!_db) return;
  const data = _db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

// Wrapper que imita a API do better-sqlite3 para manter o routes.js simples
export const db = {
  // Executa uma query e retorna todos os resultados
  all(sql, params = []) {
    const stmt = _db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  },

  // Retorna apenas o primeiro resultado
  get(sql, params = []) {
    const results = this.all(sql, params);
    return results[0] || null;
  },

  // Executa uma query de escrita (INSERT, UPDATE, DELETE)
  run(sql, params = []) {
    _db.run(sql, params);
    persist();
    return { changes: _db.getRowsModified() };
  },
};
