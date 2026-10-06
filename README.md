# Gest-fin

Painel executivo de gestão financeira em português. Oferece visão geral, lançamentos, contas a pagar, receitas, cartões de crédito com parcelamento e relatórios comparativos mensais.

## Acesso online

O projeto está deployado no Render e acessível de qualquer dispositivo com internet:

```
https://gest-fin.onrender.com
```

> No plano gratuito do Render, o servidor pode levar até 50 segundos para acordar após inatividade.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | Vite + JavaScript vanilla |
| Backend | Node.js + Express |
| Banco de dados | PostgreSQL (Supabase) |
| Autenticação | JWT (jsonwebtoken + bcryptjs) |
| Ícones | Lucide |
| Deploy | Render |

## Funcionalidades

- Login, cadastro de conta e redefinição de senha
- Cada usuário vê apenas seus próprios dados
- Lançamentos de receitas e despesas
- Cartões de crédito com suporte a parcelamento
- Contas a pagar com marcação de pagamento
- Relatórios com gráfico de barras e distribuição por categoria
- Exportação de dados em CSV e JSON
- Tema claro e escuro
- Layout responsivo com menu hamburguer no mobile
- Sidebar colapsável no desktop

## Executar localmente

Requer Node.js 20.19+ ou 22.12+.

**1. Instalar dependências:**
```sh
npm install
```

**2. Configurar variáveis de ambiente:**

Crie um arquivo `.env` na raiz com:
```
DATABASE_URL=postgresql://...  # Connection string do Supabase
JWT_SECRET=sua-chave-secreta
NODE_ENV=development
```

**3. Iniciar o backend:**
```sh
node server/index.js
```

**4. Em outro terminal, iniciar o frontend:**
```sh
npm run dev
```

Acesse em `http://localhost:5173`.

## Deploy

O projeto usa dois serviços:

- **Render** — hospeda o servidor Node.js e serve o frontend buildado
- **Supabase** — hospeda o banco de dados PostgreSQL

Para atualizar em produção após alterações no código:

```sh
git add .
git commit -m "descricao das mudancas"
git push
```

Depois acesse o painel do Render e clique em **Manual Deploy → Deploy latest commit**.

## Banco de dados

Os dados são armazenados no PostgreSQL hospedado no Supabase. As tabelas são criadas automaticamente na primeira execução:

- `users` — contas de usuário com senha em hash (bcrypt)
- `transactions` — lançamentos financeiros isolados por usuário
- `cards` — cartões de crédito cadastrados por usuário

Os dados persistem entre deploys e são acessíveis de qualquer dispositivo.
