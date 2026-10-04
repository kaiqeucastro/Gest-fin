import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import routes from './routes.js';
import { seedUsers } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3333;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// Rotas da API
app.use('/api', routes);
app.get('/health', (_req, res) => res.json({ ok: true }));

// Em produção, serve o frontend buildado
if (isProd) {
  const distPath = join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  // Todas as rotas não-API retornam o index.html (SPA)
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// Inicializa o banco antes de aceitar conexões
initDatabase().then(() => {
  seedUsers();
  app.listen(PORT, () => {
    console.log(`\n🚀 Gest-fin API rodando em http://localhost:${PORT}`);
    console.log(`   Modo: ${isProd ? 'produção' : 'desenvolvimento'}`);
    console.log(`   Banco de dados: server/gest-fin.db\n`);
  });
}).catch((err) => {
  console.error('❌ Erro ao inicializar banco:', err);
  process.exit(1);
});
