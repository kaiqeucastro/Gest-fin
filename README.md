# Gest-fin

Painel executivo de gestao financeira em portugues. O app oferece visao geral, lancamentos, contas a pagar, receitas e comparativos mensais.

## Executar

Requer Node.js 20.19+ ou 22.12+.

```sh
npm install
npm run dev
```

Para validar a versao de producao: `npm run build`.

## Dados

Lancamentos sao armazenados no IndexedDB do navegador, no banco `gest-fin`. Os dados de demonstracao sao inseridos apenas na primeira abertura. O armazenamento e local a este navegador e dispositivo; nao ha sincronizacao entre dispositivos.
