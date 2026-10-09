import bcrypt from 'bcryptjs';
import { db } from './db.js';

const FIXED_USERS = [
  { id: 'user-admin',  name: 'Administrador',  email: 'admin@gestfin.com',  password: 'admin123'  },
  { id: 'user-kaique', name: 'Kaique Castro',   email: 'kaique@gestfin.com', password: 'kaique123' },
  { id: 'user-demo',   name: 'Usuário Demo',    email: 'demo@gestfin.com',   password: 'demo123'   },
];

export async function seedUsers() {
  let created = 0;
  for (const user of FIXED_USERS) {
    const existing = await db.get('SELECT id FROM users WHERE id = $1', [user.id]);
    if (!existing) {
      const hash = bcrypt.hashSync(user.password, 10);
      await db.run(
        'INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)',
        [user.id, user.name, user.email, hash]
      );
      created++;
    }
  }
  console.log(`✅ Usuários padrão verificados. ${created > 0 ? `${created} novo(s) criado(s).` : 'Nenhuma alteração.'}`);
}
