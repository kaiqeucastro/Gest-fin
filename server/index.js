import express from 'express';
import cors from 'cors';
import { initDatabase } from './db.js';
import routes from './routes.js';
import { seedUsers } from './seed.js';

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:8080'] }));
app.use(express.json());

app.use('/api', routes);
app.get('/health', (_req, res) => res.json({ ok: true }));

// Inicializa o banco antes de aceitar conexões
initDatabase().then(() => {
  seedUsers();
  app.listen(PORT, () => {
    console.log(`\n🚀 Gest-fin API rodando em http://localhost:${PORT}`);
    console.log(`   Banco de dados: server/gest-fin.db\n`);
  });
}).catch((err) => {
  console.error('❌ Erro ao inicializar banco:', err);
  process.exit(1);
});
