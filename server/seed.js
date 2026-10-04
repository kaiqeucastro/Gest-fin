import bcrypt from 'bcryptjs';
import { db } from './db.js';

const FIXED_USERS = [
  { id: 'user-admin',  name: 'Administrador',  email: 'admin@gestfin.com',  password: 'admin123'  },
  { id: 'user-kaique', name: 'Kaique Castro',   email: 'kaique@gestfin.com', password: 'kaique123' },
  { id: 'user-demo',   name: 'Usuário Demo',    email: 'demo@gestfin.com',   password: 'demo123'   },
];

export function seedUsers() {
  console.log('✅ Usuários disponíveis:');
  for (const user of FIXED_USERS) {
    const existing = db.get('SELECT id FROM users WHERE id = ?', [user.id]);
    if (!existing) {
      const hash = bcrypt.hashSync(user.password, 10);
      db.run('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
        [user.id, user.name, user.email, hash]);
    }
    console.log(`   • ${user.email} / ${user.password}`);
  }
}
